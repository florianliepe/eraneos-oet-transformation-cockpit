"use client";

import ControlTower from "@/components/control-tower";
import { bootstrapPmoData } from "@/lib/pmo-fixtures";
import { scopeDocument } from "@/lib/local-project-data-repository";
import type { WorkspaceScope } from "@/lib/project-data-repository";

export default function AuthenticatedCockpit({ scope }: { scope: WorkspaceScope }) {
  return <ControlTower initialData={scopeDocument(bootstrapPmoData, scope)} workspaceScope={scope} />;
}
