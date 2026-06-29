import { eq } from "drizzle-orm";
import { db, machinesTable } from "@workspace/db";

export type AuthenticatedMachine = typeof machinesTable.$inferSelect;

export function extractBearer(req: any): string | null {
  const h = req.headers["authorization"] || req.headers["Authorization"];
  if (!h || typeof h !== "string") return null;
  const match = h.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Resolves the machine name from the request (query, header, or body) so agent
// endpoints can authenticate regardless of the HTTP verb used.
export function extractMachineName(req: any): string {
  return String(
    req.query?.machine ?? req.headers["x-agent-machine"] ?? req.body?.machine ?? "",
  ).trim();
}

// Validates a machine-bound agent token. Returns the machine row on success or
// null when the machine is unknown or the token does not match.
export async function authenticateAgent(
  machineName: string,
  token: string | null,
): Promise<AuthenticatedMachine | null> {
  if (!machineName || !token) return null;
  const [m] = await db.select().from(machinesTable).where(eq(machinesTable.name, machineName));
  if (!m) return null;
  if (m.agentToken !== token) return null;
  return m;
}

// Express helper: authenticates the request and responds 401 when invalid.
// Returns the machine on success, or null after sending the error response.
export async function requireAgent(req: any, res: any): Promise<AuthenticatedMachine | null> {
  const machineName = extractMachineName(req);
  if (!machineName) {
    res.status(400).json({ error: "missing machine identity (X-Agent-Machine header)" });
    return null;
  }
  const m = await authenticateAgent(machineName, extractBearer(req));
  if (!m) {
    res.status(401).json({ error: "invalid agent token" });
    return null;
  }
  return m;
}
