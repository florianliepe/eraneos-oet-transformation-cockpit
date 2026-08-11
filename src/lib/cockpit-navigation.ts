export type CockpitView = "intake" | "review" | "operations" | "health" | "overview" | "portfolio" | "plan" | "risks" | "registers" | "meetings" | "steerco" | "activity";

export function isCockpitView(value: string | null): value is CockpitView {
  return ["intake", "review", "operations", "health", "overview", "portfolio", "plan", "risks", "registers", "meetings", "steerco", "activity"].includes(value || "");
}
