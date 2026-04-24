#!/usr/bin/env python3
"""
PyOrchestrator Agent Client
============================

Microsservico cliente que roda na maquina destino, conecta-se ao
Orquestrador, envia heartbeats periodicos e executa projetos Python
recebidos pela fila de execucoes.

Instalacao:
    pip install requests pyyaml psutil

Uso:
    python agent.py --orchestrator http://seu-host:8080 --token <agent_token> --machine "VM-Producao-01"

Ou usando variaveis de ambiente:
    export ORCH_URL=http://seu-host:8080
    export ORCH_TOKEN=...
    export ORCH_MACHINE="VM-Producao-01"
    python agent.py
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import zipfile
from pathlib import Path
from typing import Any, Dict, Optional

try:
    import requests  # type: ignore
except ImportError:
    print("ERRO: instale 'requests' com: pip install requests")
    sys.exit(1)

try:
    import yaml  # type: ignore
except ImportError:
    yaml = None  # opcional

try:
    import psutil  # type: ignore
except ImportError:
    psutil = None  # opcional - sem psutil, nao envia metricas de CPU/RAM


VERSION = "1.0.0"
HEARTBEAT_INTERVAL_SEC = 15
POLL_INTERVAL_SEC = 5
DEFAULT_WORKDIR = Path.home() / ".pyorchestrator"


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("agent")


class AgentConfig:
    def __init__(self, url: str, token: str, machine: str, workdir: Path) -> None:
        self.url = url.rstrip("/")
        self.token = token
        self.machine = machine
        self.workdir = workdir
        self.workdir.mkdir(parents=True, exist_ok=True)

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "X-Agent-Machine": self.machine,
            "X-Agent-Version": VERSION,
            "Content-Type": "application/json",
        }


class Agent:
    def __init__(self, cfg: AgentConfig) -> None:
        self.cfg = cfg
        self.stop_event = threading.Event()

    # ─────────────────────────────────────────────────────────────────
    # Heartbeat
    # ─────────────────────────────────────────────────────────────────
    def _machine_metrics(self) -> Dict[str, Any]:
        if psutil is None:
            return {"cpuPercent": None, "memoryPercent": None}
        return {
            "cpuPercent": psutil.cpu_percent(interval=0.1),
            "memoryPercent": psutil.virtual_memory().percent,
        }

    def heartbeat_loop(self) -> None:
        while not self.stop_event.is_set():
            try:
                payload = {
                    "machine": self.cfg.machine,
                    "version": VERSION,
                    "status": "online",
                    **self._machine_metrics(),
                }
                r = requests.post(
                    f"{self.cfg.url}/api/agent/heartbeat",
                    json=payload,
                    headers=self.cfg.headers,
                    timeout=10,
                )
                if r.status_code >= 400:
                    log.warning("Heartbeat falhou (%s): %s", r.status_code, r.text[:200])
                else:
                    log.debug("Heartbeat OK")
            except Exception as e:  # pragma: no cover
                log.warning("Erro no heartbeat: %s", e)
            self.stop_event.wait(HEARTBEAT_INTERVAL_SEC)

    # ─────────────────────────────────────────────────────────────────
    # Polling de execucoes
    # ─────────────────────────────────────────────────────────────────
    def fetch_next_execution(self) -> Optional[Dict[str, Any]]:
        try:
            r = requests.get(
                f"{self.cfg.url}/api/agent/next-execution",
                params={"machine": self.cfg.machine},
                headers=self.cfg.headers,
                timeout=10,
            )
            if r.status_code == 204:
                return None
            if r.status_code >= 400:
                log.warning("Falha ao buscar execucao (%s)", r.status_code)
                return None
            return r.json()
        except Exception as e:
            log.warning("Erro ao consultar execucoes: %s", e)
            return None

    def report_log(self, execution_id: int, level: str, message: str) -> None:
        try:
            requests.post(
                f"{self.cfg.url}/api/executions/{execution_id}/logs",
                json={"level": level, "message": message},
                headers=self.cfg.headers,
                timeout=10,
            )
        except Exception:
            pass

    def report_status(self, execution_id: int, status: str, exit_code: Optional[int] = None) -> None:
        try:
            requests.patch(
                f"{self.cfg.url}/api/executions/{execution_id}",
                json={"status": status, "exitCode": exit_code},
                headers=self.cfg.headers,
                timeout=10,
            )
        except Exception:
            pass

    # ─────────────────────────────────────────────────────────────────
    # Execucao de projetos
    # ─────────────────────────────────────────────────────────────────
    def prepare_project(self, execution: Dict[str, Any]) -> Optional[Path]:
        """Baixa o projeto (zip) ou clona o repositorio para o workdir."""
        exec_id = execution["id"]
        project_dir = self.cfg.workdir / f"exec-{exec_id}"
        if project_dir.exists():
            shutil.rmtree(project_dir)
        project_dir.mkdir(parents=True)

        deploy_method = execution.get("deployMethod", "zip")
        if deploy_method == "git":
            repo = execution.get("repositoryUrl")
            branch = execution.get("repositoryBranch") or "main"
            if not repo:
                self.report_log(exec_id, "error", "URL do repositorio nao fornecida")
                return None
            self.report_log(exec_id, "info", f"Clonando repositorio {repo}@{branch}")
            res = subprocess.run(
                ["git", "clone", "--depth", "1", "--branch", branch, repo, str(project_dir)],
                capture_output=True, text=True, timeout=120,
            )
            if res.returncode != 0:
                self.report_log(exec_id, "error", res.stderr[-2000:])
                return None
        else:
            version = execution.get("activeVersion")
            project_name = execution.get("projectName")
            if not version or not project_name:
                self.report_log(exec_id, "error", "Versao ativa do projeto nao definida")
                return None
            zip_url = f"{self.cfg.url}/api/projects/{project_name}/versions/{version}/download"
            self.report_log(exec_id, "info", f"Baixando pacote {zip_url}")
            r = requests.get(zip_url, headers=self.cfg.headers, stream=True, timeout=60)
            if r.status_code != 200:
                self.report_log(exec_id, "error", f"Falha no download: HTTP {r.status_code}")
                return None
            tmp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
            with tmp_zip as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            try:
                self._safe_extract_zip(tmp_zip.name, project_dir, exec_id)
            finally:
                try:
                    os.unlink(tmp_zip.name)
                except OSError:
                    pass

        return project_dir

    def _safe_extract_zip(self, zip_path: str, dest_dir: Path, exec_id: int) -> None:
        """Extracao defensiva contra Zip Slip (path traversal)."""
        dest_resolved = dest_dir.resolve()
        with zipfile.ZipFile(zip_path) as zf:
            for member in zf.infolist():
                # rejeita caminhos absolutos e travessias
                member_name = member.filename.replace("\\", "/")
                if member_name.startswith("/") or ".." in member_name.split("/"):
                    raise RuntimeError(f"Caminho inseguro no zip: {member.filename}")
                target = (dest_resolved / member_name).resolve()
                if not str(target).startswith(str(dest_resolved) + os.sep) and target != dest_resolved:
                    raise RuntimeError(f"Zip Slip detectado em {member.filename}")
                zf.extract(member, dest_resolved)
        self.report_log(exec_id, "info", "Pacote extraido com sucesso")

    def install_requirements(self, project_dir: Path, exec_id: int) -> bool:
        req_file = project_dir / "requirements.txt"
        if not req_file.exists():
            return True
        self.report_log(exec_id, "info", "Instalando dependencias (requirements.txt)")
        res = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", str(req_file)],
            capture_output=True, text=True
        )
        if res.returncode != 0:
            self.report_log(exec_id, "error", res.stderr[-2000:])
            return False
        return True

    def load_project_yaml(self, project_dir: Path) -> Dict[str, Any]:
        yaml_path = project_dir / "projeto.yaml"
        if not yaml_path.exists() or yaml is None:
            return {}
        try:
            with open(yaml_path) as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            log.warning("Erro lendo projeto.yaml: %s", e)
            return {}

    def fetch_assets(self, asset_names: list) -> Dict[str, str]:
        """Solicita os valores em texto claro dos assets ao orquestrador."""
        if not asset_names:
            return {}
        try:
            r = requests.post(
                f"{self.cfg.url}/api/agent/assets",
                json={"names": asset_names},
                headers=self.cfg.headers,
                timeout=10,
            )
            if r.status_code != 200:
                return {}
            return r.json()
        except Exception:
            return {}

    def run_execution(self, execution: Dict[str, Any]) -> None:
        exec_id = execution["id"]
        log.info("▶ Iniciando execucao #%s", exec_id)
        self.report_status(exec_id, "running")

        project_dir = self.prepare_project(execution)
        if project_dir is None:
            self.report_status(exec_id, "error", exit_code=1)
            return

        if not self.install_requirements(project_dir, exec_id):
            self.report_status(exec_id, "error", exit_code=1)
            return

        cfg = self.load_project_yaml(project_dir)
        entry = cfg.get("entrypoint", "main.py")
        asset_env = self.fetch_assets(cfg.get("assets", []))

        env = os.environ.copy()
        env.update(asset_env)
        env["ORCH_EXECUTION_ID"] = str(exec_id)

        log.info("Executando %s/%s", project_dir, entry)
        proc = subprocess.Popen(
            [sys.executable, entry],
            cwd=str(project_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.rstrip()
            if line:
                level = "error" if "ERROR" in line.upper() else "info"
                self.report_log(exec_id, level, line)

        proc.wait()
        status = "completed" if proc.returncode == 0 else "error"
        log.info("⏹ Execucao #%s terminou (%s, code=%s)", exec_id, status, proc.returncode)
        self.report_status(exec_id, status, exit_code=proc.returncode)

    # ─────────────────────────────────────────────────────────────────
    # Loop principal
    # ─────────────────────────────────────────────────────────────────
    def poll_loop(self) -> None:
        while not self.stop_event.is_set():
            execution = self.fetch_next_execution()
            if execution:
                try:
                    self.run_execution(execution)
                except Exception as e:
                    log.exception("Erro durante execucao: %s", e)
            self.stop_event.wait(POLL_INTERVAL_SEC)

    def run(self) -> None:
        log.info("PyOrchestrator Agent v%s", VERSION)
        log.info("Orquestrador: %s", self.cfg.url)
        log.info("Maquina:      %s", self.cfg.machine)

        signal.signal(signal.SIGTERM, lambda *_: self.stop_event.set())
        signal.signal(signal.SIGINT, lambda *_: self.stop_event.set())

        hb = threading.Thread(target=self.heartbeat_loop, daemon=True, name="heartbeat")
        hb.start()

        try:
            self.poll_loop()
        finally:
            self.stop_event.set()
            log.info("Agente encerrado.")


def parse_args() -> AgentConfig:
    p = argparse.ArgumentParser(description="PyOrchestrator Agent Client")
    p.add_argument("--orchestrator", "-u",
                   default=os.environ.get("ORCH_URL", "http://localhost:8080"),
                   help="URL do orquestrador (ex: http://10.0.0.5:8080)")
    p.add_argument("--token", "-t",
                   default=os.environ.get("ORCH_TOKEN", ""),
                   help="Token de autenticacao do agente")
    p.add_argument("--machine", "-m",
                   default=os.environ.get("ORCH_MACHINE", os.uname().nodename if hasattr(os, "uname") else "host"),
                   help="Nome desta maquina conforme cadastrada")
    p.add_argument("--workdir", "-w",
                   default=os.environ.get("ORCH_WORKDIR", str(DEFAULT_WORKDIR)),
                   help="Diretorio de trabalho local")
    args = p.parse_args()

    if not args.token:
        print("ERRO: forneca o token via --token ou ORCH_TOKEN", file=sys.stderr)
        sys.exit(2)

    return AgentConfig(args.orchestrator, args.token, args.machine, Path(args.workdir))


if __name__ == "__main__":
    Agent(parse_args()).run()
