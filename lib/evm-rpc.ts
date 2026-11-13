import { Buffer } from "node:buffer";
import { getReceiptNetwork, isNativeChain } from "@/lib/chain";
import type { JsonRecord, TokenInfo } from "@/lib/types";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const RPC_TIMEOUT_MS = 8_000;
const METADATA_TIMEOUT_MS = 3_000;

export function getPublicRpcUrl(chain: string) {
  if (isNativeChain(chain)) return undefined;
  const rpcUrl = getReceiptNetwork(chain)?.rpcUrl;
  return chain === "lens" ? process.env.LENS_RPC_URL?.trim() || rpcUrl : rpcUrl;
}

async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing RPC response.");
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
        throw new Error("RPC response exceeds the size limit.");
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export type TransactionMethod =
  | "eth_getTransactionByHash"
  | "eth_getTransactionReceipt"
  | "eth_getBlockByNumber";

async function callRpc(
  endpoint: string,
  method: TransactionMethod | "eth_call",
  params: unknown[],
  timeout = RPC_TIMEOUT_MS,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new Error("Could not reach the network RPC.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Network RPC HTTP ${response.status}.`);
  }

  const payload = await readJson(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid RPC response.");
  }
  const { result, error } = payload as { result?: unknown; error?: unknown };
  if (error != null) throw new Error(`Network RPC failed: ${method}.`);
  return result;
}

export async function evmRpc(
  endpoint: string,
  method: TransactionMethod,
  params: [string] | [string, false],
): Promise<JsonRecord | null> {
  const result = await callRpc(endpoint, method, params);
  if (result === null) return null;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Invalid RPC result.");
  }

  const row = result as JsonRecord;
  const [requested] = params;
  if (method === "eth_getBlockByNumber") {
    if (row.number !== requested || !isHexQuantity(row.timestamp)) {
      throw new Error("Invalid RPC block.");
    }
  } else {
    const returnedHash = method === "eth_getTransactionByHash" ? row.hash : row.transactionHash;
    if (typeof returnedHash !== "string" || returnedHash.toLowerCase() !== requested.toLowerCase()) {
      throw new Error("RPC returned a different transaction.");
    }
    if (method === "eth_getTransactionReceipt" && row.status !== "0x0" && row.status !== "0x1") {
      throw new Error("Invalid RPC receipt status.");
    }
  }
  return row;
}

function isHexQuantity(value: unknown): value is string {
  return typeof value === "string" && /^0x[\da-f]+$/i.test(value);
}

export async function fillRpcTokenInfo(
  endpoint: string,
  address: string,
  blockNumber: string,
  info: TokenInfo | null,
): Promise<TokenInfo | null> {
  if (!/^0x[\da-f]{40}$/i.test(address) || (info?.symbol && info.divisor)) return info;

  const read = async (data: string) => {
    const value = await callRpc(endpoint, "eth_call", [{ to: address, data }, blockNumber], METADATA_TIMEOUT_MS)
      .catch(() => null);
    return typeof value === "string" && /^0x(?:[\da-f]{2})+$/i.test(value) ? value.slice(2) : "";
  };

  const [symbolHex, decimalsHex] = await Promise.all([
    info?.symbol ? "" : read("0x95d89b41"),
    info?.divisor ? "" : read("0x313ce567"),
  ]);
  const symbol = info?.symbol ?? decodeSymbol(symbolHex);
  const decimals = decimalsHex.length === 64 ? Number(BigInt(`0x${decimalsHex}`)) : NaN;
  const divisor = info?.divisor ?? (decimals <= 80 ? String(decimals) : undefined);
  if (!symbol && divisor === undefined) return info;

  return { ...info, contractAddress: address, tokenType: "ERC-20", symbol, divisor };
}

function decodeSymbol(hex: string) {
  if (hex.length === 64) return decodeSymbolText(hex);
  if (hex.length < 128 || BigInt(`0x${hex.slice(0, 64)}`) !== BigInt(32)) return undefined;

  const length = Number(BigInt(`0x${hex.slice(64, 128)}`));
  if (length > 64 || hex.length < 128 + 2 * length) return undefined;
  return decodeSymbolText(hex.slice(128, 128 + 2 * length));
}

function decodeSymbolText(hex: string) {
  const symbol = Buffer.from(hex, "hex").toString("utf8").replace(/\0+$/, "").trim();
  return symbol && !/[\p{Cc}\uFFFD]/u.test(symbol) ? symbol : undefined;
}
