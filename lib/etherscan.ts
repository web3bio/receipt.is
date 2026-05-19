import type { Erc20Transfer, JsonRecord } from "@/lib/types";
import { normalizeAddress } from "@/lib/chain";

const API = "https://api.etherscan.io/v2/api";

type ProxyResponse<T> = {
  result?: T | null;
  error?: { message?: string };
};

type AccountResponse<T> = {
  status?: string;
  message?: string;
  result?: T;
};

type Module = "proxy" | "account";

export async function etherscanFetch<T>(
  chainId: string,
  apiKey: string,
  module: Module,
  action: string,
  params: Record<string, string>,
): Promise<T | null | undefined> {
  const search = new URLSearchParams({
    chainid: chainId,
    module,
    action,
    apikey: apiKey,
    ...params,
  });
  const response = await fetch(`${API}?${search}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Etherscan ${module} HTTP ${response.status}`);
  }
  if (module === "proxy") {
    const payload = (await response.json()) as ProxyResponse<T>;
    if (payload.error?.message) {
      throw new Error(`Etherscan proxy: ${payload.error.message}`);
    }
    return payload.result ?? null;
  }
  const payload = (await response.json()) as AccountResponse<T>;
  if (payload.status === "0" && payload.message !== "No transactions found") {
    throw new Error(
      String(payload.result ?? payload.message ?? "Etherscan account error"),
    );
  }
  return payload.result;
}

export async function fetchNativeUsd(
  chainId: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const search = new URLSearchParams({
      chainid: chainId,
      module: "stats",
      action: "ethprice",
      apikey: apiKey,
    });
    const response = await fetch(`${API}?${search}`, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      status?: string;
      result?: { ethusd?: string } | string;
    };
    if (payload.status !== "1") return null;
    const row = payload.result;
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const raw = (row as { ethusd?: string }).ethusd;
    if (raw == null || String(raw).trim() === "") return null;
    const n = Number.parseFloat(String(raw).replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? String(n) : null;
  } catch {
    return null;
  }
}

export async function fetchErc20TransfersForTx(
  chainId: string,
  apiKey: string,
  hash: string,
  addresses: string[],
): Promise<Erc20Transfer[]> {
  const lowerHash = hash.toLowerCase();
  const merged: Erc20Transfer[] = [];
  const seen = new Set<string>();
  for (const address of addresses) {
    const result = await etherscanFetch<Erc20Transfer[] | string>(
      chainId,
      apiKey,
      "account",
      "tokentx",
      { address, page: "1", offset: "100", sort: "desc" },
    );
    const list = Array.isArray(result) ? result : [];
    for (const item of list) {
      if ((item.hash ?? "").toLowerCase() !== lowerHash) continue;
      const key = [
        item.hash ?? "",
        item.contractAddress ?? "",
        item.from ?? "",
        item.to ?? "",
        item.value ?? "",
        item.transactionIndex ?? "",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

type InternalTx = { from?: string; to?: string; value?: string; isError?: string };

export async function fetchInternalNativeNet(
  chainId: string,
  apiKey: string,
  hash: string,
  userLower: string,
): Promise<bigint> {
  try {
    const result = await etherscanFetch<InternalTx[] | string>(
      chainId,
      apiKey,
      "account",
      "txlistinternal",
      { txhash: hash },
    );
    if (!Array.isArray(result)) return BigInt(0);
    let net = BigInt(0);
    for (const item of result) {
      if (item.isError === "1") continue;
      let v: bigint;
      try {
        v = BigInt(String(item.value ?? "0"));
      } catch {
        continue;
      }
      if (v === BigInt(0)) continue;
      const fromL = normalizeAddress(item.from);
      const toL = normalizeAddress(item.to);
      if (toL === userLower && fromL !== userLower) net += v;
      else if (fromL === userLower && toL !== userLower) net -= v;
    }
    return net;
  } catch {
    return BigInt(0);
  }
}

export async function fetchVerifiedContractName(
  chainId: string,
  apiKey: string,
  addressLower: string,
): Promise<string | null> {
  try {
    const search = new URLSearchParams({
      chainid: chainId,
      module: "contract",
      action: "getsourcecode",
      address: addressLower,
      apikey: apiKey,
    });
    const response = await fetch(`${API}?${search}`, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      status?: string;
      result?: Array<{ ContractName?: string; ABI?: string }>;
    };
    if (payload.status !== "1" || !Array.isArray(payload.result)) return null;
    const row = payload.result[0];
    const name = row?.ContractName?.trim();
    if (!name) return null;
    const abi = row?.ABI?.trim() ?? "";
    if (
      abi === "Contract source code not verified" ||
      abi === "Contract not yet verified"
    ) {
      return null;
    }
    return name;
  } catch {
    return null;
  }
}

export type { JsonRecord };
