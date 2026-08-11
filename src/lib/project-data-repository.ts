import type { PmoDocument } from "./pmo-schema";

export type WorkspaceScope = { organisationId: string; projectId: string; projectName: string };
export interface ProjectDataRepository {
  load(scope: WorkspaceScope, seed: PmoDocument): Promise<PmoDocument>;
  save(scope: WorkspaceScope, document: PmoDocument): Promise<void>;
}
