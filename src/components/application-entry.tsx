"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";
import { IdentityEntry } from "./identity-entry";
import { LocalIdentityProvider } from "@/lib/local-identity-provider";
import type { IdentityProvider, IdentityResult } from "@/lib/identity-provider";
import { LocalWorkspaceRepository } from "@/lib/local-workspace-repository";
import type { WorkspaceRepository } from "@/lib/workspace-repository";
import { WorkspaceHome } from "./workspace-home";

type PublicView = "landing" | "signin" | "register" | "invite";

const AuthenticatedCockpit = lazy(() => import("./authenticated-cockpit"));

function viewFromLocation(): PublicView {
  if (typeof window === "undefined") return "landing";
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested === "signin" || requested === "register" || requested === "invite" ? requested : "landing";
}

export default function ApplicationEntry() {
  const [view, setView] = useState<PublicView>("landing");
  const [provider, setProvider] = useState<IdentityProvider | null>(null);
  const [identity, setIdentity] = useState<IdentityResult | null>(null);
  const [workspaceRepository, setWorkspaceRepository] = useState<WorkspaceRepository | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [cockpitOpen, setCockpitOpen] = useState(false);

  useEffect(() => {
    const syncView = () => setView(viewFromLocation());
    syncView();
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

  useEffect(() => {
    const localWorkspace = new LocalWorkspaceRepository(window.localStorage);
    const localProvider = new LocalIdentityProvider(window.localStorage, () => new Date(), localWorkspace);
    queueMicrotask(() => { setProvider(localProvider); setWorkspaceRepository(localWorkspace); });
    void localProvider.currentSession().then(setIdentity).finally(() => setIdentityReady(true));
  }, []);

  function navigate(next: PublicView) {
    const url = new URL(window.location.href);
    if (next === "landing") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.pushState({}, "", url);
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (view !== "landing" && (!provider || !workspaceRepository || !identityReady)) return <EntryLoading />;

  if (view === "invite" && provider) return <IdentityEntry provider={provider} mode="invite" onAuthenticated={(result) => { setIdentity(result); navigate("signin"); }} onNavigate={navigate} onBack={() => navigate("landing")} />;

  if (view !== "landing" && identity && provider && workspaceRepository && !cockpitOpen) return <WorkspaceHome account={identity.account} repository={workspaceRepository} onOpenCockpit={() => setCockpitOpen(true)} onAcceptInvitation={() => navigate("invite")} onSignOut={() => void provider.signOut().then(() => { setIdentity(null); navigate("signin"); })} />;

  if (view !== "landing" && identity && provider && cockpitOpen) {
    return (
      <Suspense fallback={<EntryLoading />}>
        <div className="authenticated-entry-bar">
          <button type="button" onClick={() => setCockpitOpen(false)} aria-label="Back to organisation workspace">← Organisation workspace</button>
          <span>{identity.account.displayName} · local demonstration identity</span>
          <button type="button" onClick={() => navigate("invite")}>Accept invitation</button>
          <button type="button" onClick={() => void provider.signOut().then(() => { setIdentity(null); setCockpitOpen(false); navigate("signin"); })}>Sign out</button>
        </div>
        <AuthenticatedCockpit />
      </Suspense>
    );
  }

  if (view !== "landing" && provider) return <IdentityEntry provider={provider} mode={view} onAuthenticated={(result) => { setIdentity(result); setCockpitOpen(false); }} onNavigate={navigate} onBack={() => navigate("landing")} />;

  return (
    <div className="public-site">
      <a className="skip-link" href="#public-content">Skip to main content</a>
      <header className="public-header">
        <button className="public-brand" type="button" onClick={() => navigate("landing")} aria-label="Transformation Cockpit home">
          <BrandMark surface="light" />
        </button>
        <nav aria-label="Public navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#governance">Governance</a>
          <a href="#security">Security</a>
        </nav>
        <div className="public-header-actions">
          <button className="public-text-action" type="button" onClick={() => navigate("signin")}>Sign in</button>
          <button className="public-button" type="button" onClick={() => navigate("register")}>Create account</button>
        </div>
      </header>

      <main id="public-content" tabIndex={-1}>
        <LandingPage onSignIn={() => navigate("signin")} onRegister={() => navigate("register")} />
      </main>

      <footer className="public-footer">
        <BrandMark compact surface="light" />
        <p>Transformation Cockpit is part of the OET AI Suite.</p>
        <nav aria-label="Legal navigation">
          <a href="#privacy">Privacy</a><a href="#legal">Legal</a><a href="#security">Security</a><a href="mailto:transformation-cockpit@eraneos.com">Contact</a>
        </nav>
      </footer>
    </div>
  );
}

function LandingPage({ onSignIn, onRegister }: { onSignIn: () => void; onRegister: () => void }) {
  return <>
    <section className="public-hero">
      <div className="public-hero-copy">
        <span className="public-kicker">OET AI SUITE · TRANSFORMATION GOVERNANCE</span>
        <h1>Turn transformation signals into accountable decisions.</h1>
        <p>One governed cockpit for portfolio leaders, project teams and AI-supported PMO work—from evidence intake to steering decisions.</p>
        <div className="public-hero-actions"><button className="public-button public-button-large" type="button" onClick={onRegister}>Create your workspace</button><button className="public-outline-button" type="button" onClick={onSignIn}>Sign in to the cockpit</button></div>
        <small>Public MVP · local demonstration identity · no production authentication claim</small>
      </div>
      <div className="public-hero-visual" aria-label="Transformation Cockpit governance overview">
        <div className="signal-card signal-card-main"><span>PORTFOLIO PULSE</span><strong>Decisions, evidence and delivery in one view</strong><div className="signal-bars" aria-hidden="true"><i /><i /><i /><i /><i /></div><div className="signal-meta"><span><b>12</b> active decisions</span><span><b>94%</b> evidence linked</span></div></div>
        <div className="signal-card signal-card-agent"><span>GOVERNED AI</span><b>Proposal ready for human review</b><em>Evidence verified</em></div><div className="signal-orbit" aria-hidden="true" />
      </div>
    </section>
    <section className="public-proof" aria-label="Product principles"><p>Built for transformation offices that need speed <span>and</span> accountability.</p><div><span>Evidence-bound</span><span>Human-governed</span><span>Portfolio-ready</span><span>Audit-aware</span></div></section>
    <section className="public-section" id="capabilities"><div className="public-section-heading"><span className="public-kicker">THE COCKPIT</span><h2>A common operating picture for every level of change.</h2><p>Move from programme signal to governed action without losing source, ownership or decision lineage.</p></div><div className="capability-grid">
      <article><span>01</span><h3>Executive steering</h3><p>Portfolio health, critical path, scenarios and SteerCo-ready narratives grounded in the live PMO record.</p></article>
      <article><span>02</span><h3>Delivery control</h3><p>First-class risks, issues, actions, decisions, dependencies, assumptions and change requests.</p></article>
      <article><span>03</span><h3>Agent workbench</h3><p>Route evidence through specialised agents while people retain review and publication authority.</p></article>
      <article><span>04</span><h3>Operational trust</h3><p>Trace agent runs, versions, evidence, proposals, reviews and safe recovery from one governed surface.</p></article>
    </div></section>
    <section className="governance-section" id="governance"><div><span className="public-kicker">GOVERNED BY DESIGN</span><h2>AI proposes. Accountable people decide.</h2><p>The cockpit separates generated insight from canonical project truth. Every proposed change carries its evidence and remains reviewable before publication.</p></div><ol>
      <li><b>01</b><span><strong>Ingest evidence</strong>Capture structured updates and source material.</span></li><li><b>02</b><span><strong>Analyse transparently</strong>See selected agents, versions, outputs and warnings.</span></li><li><b>03</b><span><strong>Review changes</strong>Accept or reject field-level proposals with rationale.</span></li><li><b>04</b><span><strong>Publish accountably</strong>Create a traceable revision of governed project truth.</span></li>
    </ol></section>
    <section className="trust-section" id="security"><span className="public-kicker">TRUST BOUNDARY</span><h2>Production-shaped, honest about the current boundary.</h2><div><p>This public MVP uses clearly labelled local demonstration access. Production identity, MFA, recovery and server-side tenant enforcement remain gated until the approved Azure platform is connected.</p><ul><li>No credentials embedded in the public bundle</li><li>Proposal-only agent publishing</li><li>Versioned evidence, review and audit contracts</li><li>Fail-closed production adapter plan</li></ul></div></section>
    <section className="public-cta"><span className="public-kicker">START WITH ONE TRANSFORMATION</span><h2>Give every decision its evidence, owner and next action.</h2><div><button className="public-button public-button-large" type="button" onClick={onRegister}>Create account</button><button className="public-text-action" type="button" onClick={onSignIn}>Already have access? Sign in →</button></div></section>
  </>;
}

function EntryLoading() {
  return <div className="entry-loading" role="status"><BrandMark surface="light" /><span>Preparing secure workspace entry…</span></div>;
}
