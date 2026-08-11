"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceRepository } from "@/lib/workspace-repository";
import type { Invitation, MembershipAuditEvent, Organisation, OrganisationMembership, ProjectWorkspace, UserAccount, WorkspaceRole } from "@/lib/workspace-schema";
import type { WorkspaceScope } from "@/lib/project-data-repository";
import { BrandMark } from "./brand-mark";

const roles: WorkspaceRole[] = ["owner", "portfolio_lead", "project_lead", "contributor", "viewer"];
const roleLabel = (role: WorkspaceRole) => role.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");

export function WorkspaceHome({ account, repository, onOpenCockpit, onAcceptInvitation, onSignOut }: { account: UserAccount; repository: WorkspaceRepository; onOpenCockpit: (scope: WorkspaceScope) => void; onAcceptInvitation: () => void; onSignOut: () => void }) {
  const [organisations, setOrganisations] = useState<Organisation[]>([]); const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState<OrganisationMembership[]>([]); const [invitations, setInvitations] = useState<Invitation[]>([]); const [audit, setAudit] = useState<MembershipAuditEvent[]>([]);
  const [projects, setProjects] = useState<ProjectWorkspace[]>([]); const [selectedProjectId, setSelectedProjectId] = useState("");
  const [issuedCode, setIssuedCode] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const selected = organisations.find((item) => item.id === selectedId);

  const refresh = useCallback(async (preferredId?: string) => {
    try {
      const available = await repository.listOrganisations(account.id); setOrganisations(available);
      const id = preferredId || selectedId || available[0]?.id || ""; setSelectedId(id);
      if (id) {
        setMembers(await repository.listMemberships(id, account.id));
        const availableProjects = await repository.listProjects(id, account.id, true); setProjects(availableProjects);
        const retainedProject = window.localStorage.getItem(`oet:workspace:v1:selection:${account.id}:${id}`);
        setSelectedProjectId((retainedProject && availableProjects.some((item) => item.id === retainedProject && item.status === "active") ? retainedProject : availableProjects.find((item) => item.status === "active")?.id) || "");
        try { setInvitations(await repository.listInvitations(id, account.id)); } catch { setInvitations([]); }
        try { setAudit(await repository.listAudit(id, account.id)); } catch { setAudit([]); }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Workspace data is unavailable."); }
    finally { setLoading(false); }
  }, [account.id, repository, selectedId]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  async function createOrganisation(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const form = new FormData(event.currentTarget); try { const created = await repository.createOrganisation(account, String(form.get("organisationName") || "")); await refresh(created.organisation.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Organisation creation failed."); } }
  async function invite(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; setError(""); const formElement = event.currentTarget; const form = new FormData(formElement); try { const issued = await repository.createInvitation(selected.id, account.id, String(form.get("inviteEmail") || ""), String(form.get("inviteRole")) as WorkspaceRole); setIssuedCode(issued.code); formElement.reset(); await refresh(selected.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Invitation could not be created."); } }
  async function changeRole(membership: OrganisationMembership, role: WorkspaceRole) { if (!selected) return; try { await repository.updateMembershipRole(selected.id, account.id, membership.id, role); await refresh(selected.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Role change denied."); } }
  async function createProject(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const element = event.currentTarget; const form = new FormData(element); try { const project = await repository.createProject(selected.id, account.id, String(form.get("projectName") || "")); element.reset(); setSelectedProjectId(project.id); window.localStorage.setItem(`oet:workspace:v1:selection:${account.id}:${selected.id}`, project.id); await refresh(selected.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Project creation denied."); } }
  function openProject(project: ProjectWorkspace) { if (!selected) return; setSelectedProjectId(project.id); window.localStorage.setItem(`oet:workspace:v1:selection:${account.id}:${selected.id}`, project.id); onOpenCockpit({ organisationId: selected.id, projectId: project.id, projectName: project.name }); }

  if (loading) return <div className="entry-loading" role="status"><BrandMark surface="light" /><span>Loading organisation workspaces…</span></div>;
  return <div className="workspace-page"><header><BrandMark surface="light" /><nav aria-label="Account navigation"><span>{account.displayName}</span><button onClick={onAcceptInvitation}>Accept invitation</button><button onClick={onSignOut}>Sign out</button></nav></header><main>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {!selected ? <section className="organisation-onboarding"><span className="public-kicker">ORGANISATION WORKSPACE</span><h1>Create the place where your transformation portfolio lives.</h1><p>You become the first owner. Add further owners before transferring or removing your own ownership.</p><form onSubmit={createOrganisation}><label><span>Organisation name</span><input name="organisationName" required minLength={2} placeholder="e.g. Enterprise Transformation Office" /></label><button className="public-button public-button-large">Create organisation</button></form></section> : <>
      <section className="workspace-hero"><div><span className="public-kicker">ORGANISATION WORKSPACE</span><h1>{selected.name}</h1><p>Govern members, invitations and isolated project workspaces.</p></div><div><label><span>Organisation</span><select value={selected.id} onChange={(event) => void refresh(event.target.value)}>{organisations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></section>
      <section className="project-workspaces"><header><div><span className="public-kicker">PROJECTS</span><h2>Transformation portfolio</h2></div><form onSubmit={createProject}><label><span>Project name</span><input name="projectName" required minLength={2} placeholder="New transformation project" /></label><button className="public-button">Create project</button></form></header><div>{projects.map((project) => <article className={project.id === selectedProjectId ? "selected" : ""} key={project.id}><span>{project.status}</span><h3>{project.name}</h3><small>{project.id}</small><footer>{project.status === "active" ? <><button onClick={() => openProject(project)}>Open cockpit</button><button onClick={() => { const name = window.prompt("Rename project", project.name); if (name) void repository.renameProject(selected.id, account.id, project.id, name).then(() => refresh(selected.id)); }}>Rename</button><button onClick={() => void repository.archiveProject(selected.id, account.id, project.id).then(() => refresh(selected.id))}>Archive</button></> : <button onClick={() => void repository.restoreProject(selected.id, account.id, project.id).then(() => refresh(selected.id))}>Restore</button>}</footer></article>)}</div>{projects.length === 0 && <p>Create the first isolated project workspace to open the cockpit.</p>}</section>
      <div className="workspace-grid"><section className="workspace-panel"><header><div><span className="public-kicker">MEMBERS</span><h2>Role governance</h2></div><b>{members.length} active</b></header>{members.map((member) => <article key={member.id}><div><strong>{member.userId === account.id ? account.displayName : "Invited member"}</strong><small>{member.userId}</small></div><select aria-label={`Role for ${member.userId}`} value={member.role} onChange={(event) => void changeRole(member, event.target.value as WorkspaceRole)}>{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select><button aria-label={`Remove ${member.userId}`} onClick={() => void repository.removeMembership(selected.id, account.id, member.id).then(() => refresh(selected.id)).catch((reason) => setError(reason.message))}>Remove</button></article>)}</section>
        <section className="workspace-panel"><header><div><span className="public-kicker">INVITATIONS</span><h2>Invite a member</h2></div></header><form className="invite-form" onSubmit={invite}><label><span>Email</span><input name="inviteEmail" type="email" required /></label><label><span>Role</span><select name="inviteRole" defaultValue="viewer">{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label><button className="public-button">Create invitation</button></form>{issuedCode && <div className="invitation-code" role="status"><b>Copy this code now</b><code>{issuedCode}</code><span>Shown once. Send it through an approved channel.</span></div>}<div className="invitation-list">{invitations.map((item) => <div key={item.id}><span><b>{item.email}</b><small>{roleLabel(item.role)} · {item.status}</small></span>{item.status === "pending" && <button onClick={() => void repository.revokeInvitation(selected.id, account.id, item.id).then(() => refresh(selected.id))}>Revoke</button>}</div>)}</div></section>
        <section className="workspace-panel workspace-audit"><header><div><span className="public-kicker">AUDIT</span><h2>Governance activity</h2></div></header>{audit.map((item) => <article key={item.id}><b>{item.event}</b><span>{item.detail}</span><time>{new Date(item.at).toLocaleString("en-GB")}</time></article>)}</section></div>
    </>}
  </main></div>;
}
