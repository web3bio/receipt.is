import {
  getCoingeckoPlatform,
  getNativeLogoUrl,
  getNativeSymbol,
  normalizeChain,
} from "@/lib/chain";
import type { TokenInfo } from "@/lib/types";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "web3bio-receipt/1.0 (receipt; +https://web3.bio)",
  };
  const key = process.env.COINGECKO_API_KEY?.trim();
  if (key) h["x-cg-demo-api-key"] = key;
  return h;
}

function tokenUsdValid(value: unknown) {
  if (value == null) return false;
  const n = Number.parseFloat(
    String(value).replace(/,/g, "").replace(/^\$\s*/, "").trim(),
  );
  return Number.isFinite(n) && n > 0;
}

export async function fetchTokenUsd(
  chain: string,
  contractLower: string,
): Promise<string | null> {
  const platform = getCoingeckoPlatform(chain);
  if (!platform) return null;
  const addr = contractLower.toLowerCase();
  try {
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${encodeURIComponent(addr)}&vs_currencies=usd`;
    const response = await fetch(url, { cache: "no-store", headers: headers() });
    if (!response.ok) return null;
    const payload = (await response.json()) as Record<string, { usd?: number }>;
    const usd = (payload[addr] ?? payload[contractLower])?.usd;
    return usd != null && Number.isFinite(usd) && usd > 0 ? String(usd) : null;
  } catch {
    return null;
  }
}

export async function fetchTokenInfo(
  chain: string,
  contractLower: string,
): Promise<TokenInfo | null> {
  const platform = getCoingeckoPlatform(chain);
  if (!platform) return null;
  const addr = contractLower.toLowerCase();
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(platform)}/contract/${encodeURIComponent(addr)}`;
    const response = await fetch(url, { cache: "no-store", headers: headers() });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      name?: string;
      symbol?: string;
      image?: { small?: string; large?: string; thumb?: string };
      market_data?: { current_price?: { usd?: number } };
      detail_platforms?: Record<string, { decimal_place?: number }>;
    };
    const rawUsd = payload.market_data?.current_price?.usd;
    const tokenPriceUSD =
      rawUsd != null && Number.isFinite(rawUsd) && rawUsd > 0
        ? String(rawUsd)
        : undefined;
    const img =
      payload.image?.small ??
      payload.image?.large ??
      payload.image?.thumb;
    const image = img != null && String(img).trim() ? String(img).trim() : undefined;
    const dec = payload.detail_platforms?.[platform]?.decimal_place;
    const divisor =
      dec != null && Number.isFinite(dec) && dec >= 0 && dec <= 80
        ? String(Math.trunc(dec))
        : undefined;
    const sym = payload.symbol?.trim();
    return {
      contractAddress: addr,
      tokenName: payload.name?.trim() || undefined,
      symbol: sym ? sym.toUpperCase() : undefined,
      divisor,
      tokenType: "ERC-20",
      tokenPriceUSD,
      image,
    };
  } catch {
    return null;
  }
}

export async function fetchNativeUsd(chain: string): Promise<string | null> {
  const cgId = normalizeChain(chain) === "bsc" ? "binancecoin" : "ethereum";
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(cgId)}&vs_currencies=usd`,
      { cache: "no-store", headers: headers() },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as Record<string, { usd?: number }>;
    const usd = payload[cgId]?.usd;
    return usd != null && Number.isFinite(usd) && usd > 0 ? String(usd) : null;
  } catch {
    return null;
  }
}

export async function resolveTokenInfoFromTransfers(
  chain: string,
  contractAddresses: string[],
): Promise<{ tokenInfo: TokenInfo | null; contractAddress: string | null }> {
  if (contractAddresses.length === 0) {
    return { tokenInfo: null, contractAddress: null };
  }
  let fallback: { tokenInfo: TokenInfo; contractAddress: string } | null = null;
  for (const contract of contractAddresses) {
    let info = await fetchTokenInfo(chain, contract);
    if (!info) continue;
    if (!tokenUsdValid(info.tokenPriceUSD)) {
      const usd = await fetchTokenUsd(chain, contract);
      if (usd) info = { ...info, tokenPriceUSD: usd };
    }
    if (tokenUsdValid(info.tokenPriceUSD)) {
      return { tokenInfo: info, contractAddress: contract };
    }
    if (!fallback) fallback = { tokenInfo: info, contractAddress: contract };
  }
  if (fallback) {
    return {
      tokenInfo: fallback.tokenInfo,
      contractAddress: fallback.contractAddress,
    };
  }
  return { tokenInfo: null, contractAddress: contractAddresses[0] ?? null };
}

export function nativeSwapToken(chain: string, rawAmount: bigint) {
  return {
    isNative: true as const,
    contractAddress: null,
    symbol: getNativeSymbol(chain),
    decimals: "18",
    rawAmount: rawAmount.toString(),
    tokenName: null,
    image: getNativeLogoUrl(chain),
  };
}

export { tokenUsdValid };
