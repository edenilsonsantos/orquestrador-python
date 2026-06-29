---
name: Trigger runtime (scheduler)
description: How schedule triggers become jobs in the orchestrator, and the cross-table constraint it introduces
---
Schedules fire jobs via an in-process polling scheduler in the api-server (started after the server listens), not on-demand. Each trigger type (cron, interval, queue-threshold) is one branch that inserts a `pending` job; webhooks are pushed through a dedicated endpoint rather than polled.

**Why:** code review treated "gatilho → job" runtime as a core requirement of the remodel, not just structural relinking of schedules to automations.

**Key durable constraints (not obvious from one file):**
- Jobs carry the originating `scheduleId`, and that FK has no ON DELETE behavior — so deleting a schedule must first null `jobs.scheduleId`, or the delete 500s on the FK.
- Cron/interval scheduling is driven by a persisted `nextRunAt`; a null `nextRunAt` is initialized (not fired) on first sight, so a brand-new schedule never double-fires on boot.
- Queue-threshold triggers must dedup against existing pending/running jobs for the same schedule, or every tick re-fires while the queue stays above threshold.
