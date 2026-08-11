import type { PmoDocument } from "./pmo-schema";

export type WorkspaceScope = { organisationId: string; projectId: string; projectName: string };
export type ProjectDataReadResult = { state: "stored"; document: PmoDocument } | { state: "missing" };
export interface ProjectDataRepository {
  load(scope: WorkspaceScope, seed: PmoDocument): Promise<PmoDocument>;
  inspect(scope: WorkspaceScope): Promise<ProjectDataReadResult>;
  save(scope: WorkspaceScope, document: PmoDocument): Promise<void>;
}
