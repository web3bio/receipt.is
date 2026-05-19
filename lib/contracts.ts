import { normalizeAddress } from "@/lib/chain";
import { fetchVerifiedContractName as etherscanContractName } from "@/lib/etherscan";
import type { TokenInfo } from "@/lib/types";

const SOURCIFY = "https://sourcify.dev/server";

export async function fetchVerifiedContractName(
  chainId: string,
  address: string,
  etherscanApiKey?: string | null,
): Promise<string | null> {
  const normalized = normalizeAddress(address);
  if (!normalized.startsWith("0x") || normalized.length !== 42) return null;
  const cid = String(chainId).trim();
  if (!/^\d+$/.test(cid)) return null;

  try {
    const url = `${SOURCIFY}/v2/contract/${encodeURIComponent(cid)}/${encodeURIComponent(normalized)}?fields=compilation`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        compilation?: { name?: string };
      };
      const name = payload.compilation?.name?.trim();
      if (name) return name;
    }
  } catch {}

  const apiKey = etherscanApiKey?.trim();
  if (!apiKey) return null;
  return etherscanContractName(cid, apiKey, normalized);
}

export function contractNameToTokenInfo(
  contractAddress: string,
  contractName: string,
): TokenInfo {
  return {
    contractAddress: contractAddress.toLowerCase(),
    tokenName: contractName,
  };
}
