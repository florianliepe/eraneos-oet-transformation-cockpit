"use client";

import ControlTower from "@/components/control-tower";
import { bootstrapPmoData } from "@/lib/pmo-fixtures";
import { scopeDocument } from "@/lib/local-project-data-repository";
import type { WorkspaceScope } from "@/lib/project-data-repository";
import type { CockpitView } from "@/lib/cockpit-navigation";

export default function AuthenticatedCockpit({ scope, initialView }: { scope: WorkspaceScope; initialView?: CockpitView }) {
  return <ControlTower initialData={scopeDocument(bootstrapPmoData, scope)} workspaceScope={scope} initialView={initialView} />;
}
