import { getReceiptNetwork, type NativeChain } from "@/lib/chain";
import { formatAmount } from "@/lib/format";
import type { NativeReceiptDetails, ReceiptMovement } from "@/lib/types";

type RecordValue = Record<string, unknown>;

export type NativeResult = Omit<NativeReceiptDetails, "finalized" | "movements"> & {
  movements?: ReceiptMovement[];
  status: "success" | "failed" | "pending_or_unknown";
  finalized?: boolean;
  block?: string;
  timestamp?: string;
  method?: string;
};

export function obj(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

export function list(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(obj) : [];
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value
    : typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}

export function integer(value: unknown): bigint | undefined {
  const raw = str(value);
  if (!raw || !/^(?:-?\d+|0x[\da-f]+)$/i.test(raw)) return undefined;
  if (typeof value === "number" && !Number.isSafeInteger(value)) return undefined;
  return BigInt(raw);
}

export function units(value: unknown, decimals: number) {
  const raw = integer(value);
  return raw === undefined ? undefined : formatAmount(raw.toString(), String(decimals));
}

export function fee(value: unknown, decimals: number, symbol: string) {
  const amount = units(value, decimals);
  return amount === undefined ? undefined : `${amount} ${symbol}`;
}

export function movement(from: unknown, to: unknown, amount: string | undefined, symbol: string) {
  const source = str(from);
  const destination = str(to);
  return source && destination && amount !== undefined
    ? { from: source, to: destination, amount, symbol } : undefined;
}

export function present<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function isoTime(value: unknown) {
  const date = Date.parse(str(value) ?? "");
  return Number.isFinite(date) ? String(Math.floor(date / 1000)) : undefined;
}

export function missing(): never {
  throw new Error("Transaction not found.");
}

export function checkId(actual: unknown, expected: string, caseSensitive = false) {
  const id = str(actual);
  if ((caseSensitive ? id : id?.toLowerCase().replace(/^0x/, "")) !==
      (caseSensitive ? expected : expected.toLowerCase().replace(/^0x/, ""))) {
    throw new Error("Data source returned a different transaction.");
  }
}

export function endpoint(chain: NativeChain, fallback?: string) {
  const url = process.env[`${chain.toUpperCase()}_RECEIPT_URL`]?.trim()
    || getReceiptNetwork(chain)?.rpcUrl
    || fallback;
  if (!url) throw new Error("Missing transaction data source for this network.");
  return url;
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export async function read(url: string, body?: unknown, headers?: Record<string, string>) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { Accept: "application/json", "Content-Type": "application/json", ...headers },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch {
    throw new Error("Transaction data source is temporarily unavailable.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 404) return {};
    throw new Error(`Transaction data source returned HTTP ${response.status}.`);
  }
  if (response.status === 202 && url.endsWith("/status")) {
    await response.body?.cancel();
    return {};
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Transaction data source returned an empty response.");
  const decoder = new TextDecoder();
  let total = 0;
  let json = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Transaction response exceeds the size limit.");
      }
      json += decoder.decode(value, { stream: true });
    }
    const data: unknown = JSON.parse(json + decoder.decode());
    return typeof data === "number" ? { value: data } : obj(data);
  } finally {
    reader.releaseLock();
  }
}

export async function rpc(url: string, method: string, params: unknown[]) {
  const data = await read(url, { jsonrpc: "2.0", id: 1, method, params });
  const error = obj(data.error);
  if (error.code === 29) missing();
  if (data.error) throw new Error("Transaction RPC rejected the request.");
  return obj(data.result);
}
