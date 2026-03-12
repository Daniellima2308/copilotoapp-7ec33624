export type CopilotoOperationMode = "driver" | "manager";

const OPERATION_MODE_KEY = "copiloto-operation-mode";

export function getOperationMode(): CopilotoOperationMode {
  try {
    const raw = localStorage.getItem(OPERATION_MODE_KEY);
    if (raw === "driver" || raw === "manager") return raw;
  } catch {
    // ignore
  }
  return "driver";
}

export function setOperationMode(mode: CopilotoOperationMode): void {
  localStorage.setItem(OPERATION_MODE_KEY, mode);
}
