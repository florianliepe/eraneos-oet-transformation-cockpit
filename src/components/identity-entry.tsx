"use client";

import { useState } from "react";
import type { IdentityProvider, IdentityResult } from "@/lib/identity-provider";
import { BrandMark } from "./brand-mark";

type IdentityMode = "signin" | "register" | "invite";

export function IdentityEntry({ provider, mode, onAuthenticated, onNavigate, onBack }: { provider: IdentityProvider; mode: IdentityMode; onAuthenticated: (identity: IdentityResult) => void; onNavigate: (mode: IdentityMode) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const values = new FormData(event.currentTarget);
    try {
      if (mode === "register") {
        const result = await provider.register({ displayName: String(values.get("displayName") || ""), email: String(values.get("email") || ""), password: String(values.get("password") || ""), termsAccepted: values.get("terms") === "on" });
        onAuthenticated(result);
      } else if (mode === "signin") {
        onAuthenticated(await provider.signIn(String(values.get("email") || ""), String(values.get("password") || "")));
      } else {
        await provider.acceptInvitation(String(values.get("invitationCode") || ""));
        const current = await provider.currentSession();
        if (current) onAuthenticated(current);
        setSuccess("Invitation accepted. Your organisation access is ready.");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The identity request could not be completed."); }
    finally { setBusy(false); }
  }

  const copy = mode === "register"
    ? { kicker: "CREATE ACCOUNT", title: "Start your transformation workspace.", intro: "Create a local demonstration account. Organisation setup follows in the next step.", action: "Create local account" }
    : mode === "invite"
      ? { kicker: "INVITATION", title: "Join an organisation workspace.", intro: "Sign in first, then enter the one-time invitation code issued by a workspace owner.", action: "Accept invitation" }
      : { kicker: "WELCOME BACK", title: "Sign in to your cockpit.", intro: "Use the local account you created on this device.", action: "Sign in" };

  return <div className="identity-page">
    <aside><button className="public-brand" type="button" onClick={onBack}><BrandMark surface="light" /></button><div><span>LOCAL DEVELOPMENT MODE</span><p>This browser-only identity boundary is for MVP evaluation. It is not Microsoft Entra authentication and must not be used as a production security boundary.</p></div></aside>
    <main>
      <button className="public-text-action" type="button" onClick={onBack}>← Public overview</button>
      <form className="identity-form" onSubmit={submit}>
        <span className="public-kicker">{copy.kicker}</span><h1>{copy.title}</h1><p>{copy.intro}</p>
        {error && <div className="error-banner" role="alert">{error}</div>}{success && <div className="success-banner" role="status">{success}</div>}
        {mode === "register" && <label><span>Display name</span><input name="displayName" autoComplete="name" required minLength={2} /></label>}
        {mode !== "invite" && <><label><span>Email</span><input name="email" type="email" autoComplete="email" required /></label><label><span>Local demonstration password</span><input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={10} /><small>Stored only as a one-way browser-local verifier. Never reuse a production password.</small></label></>}
        {mode === "register" && <label className="identity-check"><input name="terms" type="checkbox" required /><span>I accept the applicable terms and understand this is a local MVP identity.</span></label>}
        {mode === "invite" && <label><span>Invitation code</span><input name="invitationCode" autoComplete="one-time-code" required minLength={8} /><small>Codes are never embedded in the public application or URL.</small></label>}
        <button className="public-button public-button-large" disabled={busy}>{busy ? "Please wait…" : copy.action}</button>
        <footer>{mode !== "signin" && <button type="button" onClick={() => onNavigate("signin")}>Already registered? Sign in</button>}{mode === "signin" && <><button type="button" onClick={() => onNavigate("register")}>Create account</button><button type="button" onClick={() => onNavigate("invite")}>Accept invitation</button></>}</footer>
      </form>
    </main>
  </div>;
}
