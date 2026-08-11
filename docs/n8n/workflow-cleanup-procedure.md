# Safe n8n workflow cleanup

This inventory is advisory and never authorizes automatic deletion or archival.

1. Compare the live binding manifest, release manifest and visible n8n workflow list.
2. Confirm each candidate is unpublished, unreferenced and has no execution after replacement.
3. Preserve execution evidence required by an incident, release or recovery rehearsal.
4. Ask for explicit confirmation listing exact workflow IDs and whether archive or deletion is intended.
5. Prefer archive. Delete only after retention obligations expire and recovery evidence exists in Git.
6. Record operator, timestamp, IDs, action, reason and recovery release.

Never copy credential values, execution inputs or raw evidence into the cleanup record.
