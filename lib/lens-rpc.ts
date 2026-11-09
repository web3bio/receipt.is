import type { JsonRecord } from "@/lib/types";

const DEFAULT_RPC_URL = "https://rpc.lens.xyz";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const RPC_TIMEOUT_MS = 8_000;

async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing Lens RPC response.");
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Lens RPC response exceeds the size limit.");
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

type LensMethod =
  | "eth_getTransactionByHash"
  | "eth_getTransactionReceipt"
  | "eth_getBlockByNumber";

export async function lensRpc(
  method: LensMethod,
  params: [string] | [string, false],
): Promise<JsonRecord | null> {
  const endpoint = process.env.LENS_RPC_URL?.trim() || DEFAULT_RPC_URL;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Could not reach Lens RPC.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Lens RPC HTTP ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await readJson(response);
  } catch {
    throw new Error("Could not read Lens RPC response.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid Lens RPC response.");
  }
  const { result, error } = payload as { result?: unknown; error?: unknown };
  if (error != null) throw new Error(`Lens RPC failed: ${method}.`);
  if (result === null) return null;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error(`Invalid Lens RPC result: ${method}.`);
  }

  const row = result as JsonRecord;
  const [requested] = params;
  if (method === "eth_getBlockByNumber") {
    if (row.number !== requested || !isHexQuantity(row.timestamp)) {
      throw new Error("Invalid Lens block.");
    }
  } else {
    const returnedHash = method === "eth_getTransactionByHash" ? row.hash : row.transactionHash;
    if (typeof returnedHash !== "string" || returnedHash.toLowerCase() !== requested.toLowerCase()) {
      throw new Error("Lens RPC returned a different transaction.");
    }
    if (method === "eth_getTransactionReceipt" && row.status !== "0x0" && row.status !== "0x1") {
      throw new Error("Invalid Lens receipt status.");
    }
  }
  return row;
}

function isHexQuantity(value: unknown): value is string {
  return typeof value === "string" && /^0x[\da-f]+$/i.test(value);
}
