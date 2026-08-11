"use client";

import ControlTower from "@/components/control-tower";
import { bootstrapPmoData } from "@/lib/pmo-fixtures";
import { scopeDocument } from "@/lib/local-project-data-repository";
import type { WorkspaceScope } from "@/lib/project-data-repository";
import type { CockpitView } from "@/lib/cockpit-navigation";
import type { UserAccount } from "@/lib/workspace-schema";

export default function AuthenticatedCockpit({ scope, initialView, account }: { scope: WorkspaceScope; initialView?: CockpitView; account: UserAccount }) {
  return <ControlTower initialData={scopeDocument(bootstrapPmoData, scope)} workspaceScope={scope} initialView={initialView} accountableActor={{ userId: account.id, displayName: account.displayName }} />;
}
