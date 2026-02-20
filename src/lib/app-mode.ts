export type WorkspaceMode = "user" | "demo";

export function isDemoMode(mode: WorkspaceMode) {
  return mode === "demo";
}
