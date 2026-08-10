import type { PmoDocument } from "./pmo-schema";

// Product-neutral shell placeholder only. Canonical project data is loaded
// through the protected policy API after authentication is implemented.
export const bootstrapPmoData: PmoDocument = {
  schemaVersion: "1.0",
  revision: 1,
  project: {
    id: "OET-DEMO",
    name: "Transformation Workspace",
    subtitle: "Governed project and transformation cockpit",
    phase: "Connect to load project data",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    overallRag: "grey",
    progress: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  workstreams: [],
  milestones: [],
  deliverables: [],
  risks: [],
  meetings: [],
  activity: [],
};
