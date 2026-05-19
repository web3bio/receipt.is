export function receiptErrorStatus(error: unknown): number {
  return error instanceof Error && error.message === "Transaction not found."
    ? 404
    : 502;
}

export function receiptErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown upstream error.";
}
