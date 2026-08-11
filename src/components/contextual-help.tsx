"use client";

import { useEffect, useRef } from "react";
import type { CockpitView } from "@/lib/cockpit-navigation";

const helpByView: Record<CockpitView, { purpose: string; action: string; governance: string }> = {
  intake: { purpose: "Turn documents and written updates into evidence-bound proposals.", action: "Select the smallest justified specialist route, then inspect its routing receipt.", governance: "Agent output does not change canonical project data until accountable review." },
  review: { purpose: "Compare proposed field changes with the current governed value.", action: "Accept or reject each proposal and record a reviewer rationale.", governance: "Only accepted, version-current proposals can reach the governed publisher." },
  operations: { purpose: "Trace runs, versions, budgets and recovery lineage.", action: "Assign failures before retrying or replaying; use cancellation as a request only.", governance: "Retries preserve source lineage. Replays use current bindings and never overwrite the original run." },
  health: { purpose: "Verify workflow releases, live bindings and quality gates.", action: "Resolve critical incidents and pending reviews before promotion.", governance: "Availability labels come from the checked release inventory, not an inferred live state." },
  overview: { purpose: "See the current project health and decision pressure in one place.", action: "Open a signal to reach its governed source records.", governance: "Unknown means evidence is missing; it is never silently treated as green." },
  portfolio: { purpose: "Compare programme value, capacity, finance and scenario impacts.", action: "Review critical path and baseline-versus-candidate evidence before deciding.", governance: "Scenario comparison never mutates the approved baseline." },
  plan: { purpose: "Manage milestones, deliverables and workstream commitments.", action: "Keep owners, dates and status current; investigate blocked dependencies.", governance: "Every saved change creates normal audit and object-version lineage." },
  risks: { purpose: "Prioritise risk exposure and mitigation accountability.", action: "Use probability and impact together; link evidence before closure.", governance: "RAG colour is always accompanied by text and governed source data." },
  registers: { purpose: "Control first-class PMO objects and their relationships.", action: "Use saved views, guarded bulk actions and previewed import/export.", governance: "Stale object versions fail closed and imports cannot create unknown records." },
  meetings: { purpose: "Connect meetings to decisions, actions and evidence.", action: "Capture accountable outcomes instead of relying on narrative notes alone.", governance: "Linked decisions and actions remain separate governed objects." },
  steerco: { purpose: "Create an evidence-linked executive decision pack.", action: "Assign a reviewer and decision request before approval and publication.", governance: "Published views are immutable snapshots with source fingerprints and receipts." },
  activity: { purpose: "Review chronological human and automation changes.", action: "Use object references to investigate the current governed state.", governance: "The audit trail records who changed what; it does not replace object-version history." },
};

export function ContextualHelp({ view, onClose }: { view: CockpitView; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const content = helpByView[view];
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  return <aside className="context-help" role="dialog" aria-modal="false" aria-labelledby="context-help-title">
    <header><div><span className="section-kicker">CONTEXTUAL HELP</span><h2 id="context-help-title">Understand this workspace</h2></div><button ref={closeRef} className="icon-button" aria-label="Close contextual help" onClick={onClose}>×</button></header>
    <section><span className="help-view-label">CURRENT VIEW · {view.replaceAll("_", " ")}</span><h3>{content.purpose}</h3><p>{content.action}</p><strong>{content.governance}</strong></section>
    <section><h3>Governance in plain English</h3><ol><li><b>Draft</b><span>Edits stay in the current workspace until published.</span></li><li><b>Proposal</b><span>AI suggestions are evidence-linked but have no write authority.</span></li><li><b>Review</b><span>An accountable person accepts or rejects material changes.</span></li><li><b>Publish</b><span>A version-checked revision and audit receipt become canonical.</span></li></ol></section>
    <section><h3>Status meaning</h3><div className="help-statuses"><span><i className="status-green"/><b>Green</b>Within tolerance</span><span><i className="status-amber"/><b>Amber</b>Attention required</span><span><i className="status-red"/><b>Red</b>Decision or recovery required</span><span><i className="status-unknown"/><b>Unknown</b>Evidence missing or stale</span></div></section>
    <section><h3>Keyboard</h3><dl><div><dt>Ctrl/⌘ + K</dt><dd>Search project</dd></div><div><dt>Tab / Shift+Tab</dt><dd>Move between controls</dd></div><div><dt>Escape</dt><dd>Close this help panel</dd></div></dl></section>
  </aside>;
}

export function FirstUseGuide({ onDismiss }: { onDismiss: () => void }) {
  return <section className="first-use-guide" aria-labelledby="first-use-title"><header><div><span className="section-kicker">FIRST USE</span><h2 id="first-use-title">Three controls keep the cockpit trustworthy.</h2></div><button className="button ghost" onClick={onDismiss}>Dismiss guide</button></header><ol><li><span>1</span><div><b>Establish governed evidence</b><p>Start with owners, dates and source records. Missing evidence remains visibly unknown.</p></div></li><li><span>2</span><div><b>Review agent proposals</b><p>AI assists with analysis; an accountable human decides what may change.</p></div></li><li><span>3</span><div><b>Publish a versioned revision</b><p>Publication checks object versions and creates audit lineage you can reproduce.</p></div></li></ol></section>;
}
