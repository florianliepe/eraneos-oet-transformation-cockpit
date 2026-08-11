"use client";

import ControlTower from "@/components/control-tower";
import { bootstrapPmoData } from "@/lib/pmo-fixtures";

export default function AuthenticatedCockpit() {
  return <ControlTower initialData={bootstrapPmoData} />;
}
