import { migratePmoDocument, type PmoDocument } from "./pmo-schema";
import type { ProjectDataRepository, WorkspaceScope } from "./project-data-repository";
import type { StorageBoundary } from "./local-identity-provider";

export const projectDataKey = (scope: WorkspaceScope) => `oet:workspace:v1:organisation:${scope.organisationId}:project:${scope.projectId}:pmo`;
type ScopedEnvelope = { contractVersion: "project-data-1.0"; organisationId: string; projectId: string; document: PmoDocument };

export function scopeDocument(document: PmoDocument, scope: WorkspaceScope): PmoDocument {
  return { ...structuredClone(document), project: { ...document.project, id: scope.projectId, name: scope.projectName } };
}

export class LocalProjectDataRepository implements ProjectDataRepository {
  constructor(private readonly storage: StorageBoundary) {}
  async inspect(scope: WorkspaceScope) {
    const raw = this.storage.getItem(projectDataKey(scope));
    if (!raw) return { state: "missing" as const };
    const envelope = JSON.parse(raw) as ScopedEnvelope;
    if (envelope.contractVersion !== "project-data-1.0" || envelope.organisationId !== scope.organisationId || envelope.projectId !== scope.projectId) throw new Error("Project data scope mismatch.");
    return { state: "stored" as const, document: scopeDocument(migratePmoDocument(envelope.document), scope) };
  }
  async load(scope: WorkspaceScope, seed: PmoDocument) {
    const result = await this.inspect(scope);
    return result.state === "stored" ? result.document : scopeDocument(seed, scope);
  }
  async save(scope: WorkspaceScope, document: PmoDocument) {
    if (document.project.id !== scope.projectId) throw new Error("Project data cannot be written outside the selected workspace.");
    const envelope: ScopedEnvelope = { contractVersion: "project-data-1.0", organisationId: scope.organisationId, projectId: scope.projectId, document: scopeDocument(document, scope) };
    this.storage.setItem(projectDataKey(scope), JSON.stringify(envelope));
  }
}
