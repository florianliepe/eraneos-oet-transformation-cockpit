"use client";

import { useState } from "react";
import { previewEncryptedLocalBackup, restoreEncryptedLocalBackup, type BackupPreview } from "@/lib/local-workspace-backup";
import { replaceAgentOperationRecords } from "@/lib/agent-operations-store";

export function BackupRestoreControl({ onRestored, compact = false }: { onRestored: () => void; compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null); const [passphrase, setPassphrase] = useState(""); const [preview, setPreview] = useState<BackupPreview | null>(null); const [serialized, setSerialized] = useState(""); const [replace, setReplace] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function inspect(event: React.FormEvent) { event.preventDefault(); if (!file) return; setBusy(true); setError(""); setPreview(null); try { const content = await file.text(); const result = await previewEncryptedLocalBackup(window.localStorage, content, passphrase); setSerialized(content); setPreview(result.preview); } catch (reason) { setError(reason instanceof Error ? reason.message : "Backup preview failed."); } finally { setBusy(false); } }
  async function restore() { if (!preview || !serialized) return; setBusy(true); setError(""); try { await restoreEncryptedLocalBackup(window.localStorage, serialized, passphrase, replace ? "replace" : "empty_only", replaceAgentOperationRecords); onRestored(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Backup restore failed."); } finally { setBusy(false); } }
  return <section className={compact ? "backup-restore compact" : "backup-restore"} aria-labelledby={compact ? "signin-restore-title" : "workspace-restore-title"}>
    <header><div><span className="public-kicker">RESTORE</span><h3 id={compact ? "signin-restore-title" : "workspace-restore-title"}>Restore an encrypted local backup</h3></div></header>
    <p>Preview and validate the file before any local data changes. The original account password is still required after restore.</p>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <form onSubmit={inspect}><label><span>Encrypted backup file</span><input type="file" accept=".oetbackup,application/json" required onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }} /></label><label><span>Dedicated backup passphrase</span><input type="password" minLength={12} required value={passphrase} onChange={(event) => { setPassphrase(event.target.value); setPreview(null); }} autoComplete="off" /></label><button className="public-outline-button" disabled={busy}>{busy ? "Validating…" : "Preview backup"}</button></form>
    {preview && <div className="backup-preview" role="status"><b>Validated backup from {new Date(preview.exportedAt).toLocaleString("en-GB")}</b><span>{preview.accounts} account(s) · {preview.organisations} organisation(s) · {preview.projects} project(s) · {preview.projectDocuments} PMO document(s) · {preview.agentOperations} agent record(s)</span>{preview.conflicts.length > 0 && <label><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} /><span>Replace {preview.conflicts.length} conflicting local storage record(s). This cannot be undone.</span></label>}<button className="public-button" type="button" disabled={busy || (preview.conflicts.length > 0 && !replace)} onClick={() => void restore()}>Restore validated backup</button></div>}
  </section>;
}
