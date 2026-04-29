import { NextRequest } from "next/server";
import {
  getChainId,
  getCoingeckoAssetPlatform,
  normalizeChain,
  SUPPORTED_CHAINS,
} from "@/utils/network";
import { isValidTxHash } from "@/utils/tx-hash";
import { normalizeAddress } from "@/utils/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonRecord = Record<string, unknown>;

type EtherscanProxyResponse<T> = {
  jsonrpc?: string;
  id?: number;
  result?: T | null;
  error?: {
    code?: number;
    message?: string;
  };
};

type EtherscanAccountResponse<T> = {
  status?: string;
  message?: string;
  result?: T;
};

type Erc20TransferItem = {
  blockNumber?: string;
  timeStamp?: string;
  hash?: string;
  nonce?: string;
  blockHash?: string;
  from?: string;
  contractAddress?: string;
  to?: string;
  value?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  transactionIndex?: string;
  gas?: string;
  gasPrice?: string;
  gasUsed?: string;
  cumulativeGasUsed?: string;
  input?: string;
  methodId?: string;
  functionName?: string;
  confirmations?: string;
};

type TokenInfoItem = {
  contractAddress?: string;
  tokenName?: string;
  symbol?: string;
  divisor?: string;
  tokenType?: string;
  tokenPriceUSD?: string;
  image?: string;
};

type SwapTokenItem = {
  /** `true` 表示原生币（ETH/BNB），此时 `contractAddress` 为 null。 */
  isNative: boolean;
  contractAddress: string | null;
  symbol: string;
  /** 字符串小数位，便于前端按原有 `formatAmount` 复用。 */
  decimals: string;
  /** 原始整数（未除以 10^decimals）。 */
  rawAmount: string;
  tokenName?: string | null;
  image?: string | null;
};

type SwapInfo = {
  /** 已识别的 DEX/聚合器名称；未识别时为 null（UI 不展示 `on …`）。 */
  dexName: string | null;
  /** 用户调用的 router 合约地址（小写）。 */
  routerAddress: string;
  fromToken: SwapTokenItem;
  toToken: SwapTokenItem;
};

const NATIVE_SYMBOL_BY_CHAIN: Record<string, string> = {
  eth: "ETH",
  base: "ETH",
  arb: "ETH",
  op: "ETH",
  bsc: "BNB",
};

const NATIVE_LOGO_BY_CHAIN: Record<string, string> = {
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  base: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  arb: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  op: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  bsc: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
};

/**
 * 常见 DEX / 聚合器的 router 合约（地址小写 → 显示名）。
 * 多数 router 在多链使用相同地址（CREATE2 预留），按地址即可识别；少数链特定地址逐条列出。
 */
const DEX_ROUTERS_LOWER: Record<string, string> = {
  // Uniswap
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap",
  "0x66a9893cc07d91d95644aedd05d03f95e1dba8af": "Uniswap",
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3",
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2",
  "0x2626664c2603336e57b271c5c0b26f421741e481": "Uniswap",
  "0x6ff5693b99212da76ad316178a184ab56d299b43": "Uniswap",
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24": "Uniswap V2",
  // 1inch
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch",
  "0x1111111254fb6c44bac0bed2854e76f90643097d": "1inch",
  // 0x / Matcha
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x",
  "0x0000000000001ff3684f28c67538d4d072c22734": "0x",
  // Paraswap
  "0xdef171fe48cf0115b1d80b88dc8eab59176fee57": "ParaSwap",
  // KyberSwap
  "0x6131b5fae19ea4f9d964eac0408e4408b66337b5": "KyberSwap",
  // CoW Swap
  "0x9008d19f58aabd9ed0d60971565aa8510560ab41": "CoW Swap",
  // PancakeSwap
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": "PancakeSwap",
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": "PancakeSwap",
  "0x1b81d678ffb9c0263b24a97847620c99d213eb14": "PancakeSwap",
  "0x1a0a18ac4becddbd6389559687d1a73d8927e416": "PancakeSwap",
  // SushiSwap
  "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap",
  // Aerodrome (Base)
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": "Aerodrome",
  // Velodrome (Optimism)
  "0xa062ae8a9c5e11aaa026fc2670b0d65ccc8b2858": "Velodrome",
  // OpenOcean
  "0x6352a56caadc4f1e25cd6c75970fa768a3304e64": "OpenOcean",
  // Odos
  "0xcf5540fffcdc3d510b18bfca6d2b9987b0772559": "Odos",
};

/**
 * 在 receipt logs 里识别 DEX：通过特征 `Swap` 事件 topic0。
 * V2 / V3 fork 共享 topic，按链推断展示名（bsc → PancakeSwap，其余 → Uniswap）。
 */
const DEX_SWAP_TOPIC0_V3 =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
const DEX_SWAP_TOPIC0_V2 =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const DEX_SWAP_TOPIC0_V4 =
  "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f";

function detectDexFromLogs(
  receipt: JsonRecord | null | undefined,
  chain: string,
): string | null {
  const logs = receipt?.logs;
  if (!Array.isArray(logs)) return null;
  let v: "V4" | "V3" | "V2" | null = null;
  for (const raw of logs) {
    const log = raw as { topics?: unknown[] };
    const topics = log.topics;
    if (!Array.isArray(topics) || topics.length === 0) continue;
    const t0 = String(topics[0]).toLowerCase();
    if (t0 === DEX_SWAP_TOPIC0_V4) {
      v = "V4";
      break;
    }
    if (t0 === DEX_SWAP_TOPIC0_V3) v ??= "V3";
    else if (t0 === DEX_SWAP_TOPIC0_V2) v ??= "V2";
  }
  if (!v) return null;
  const isBsc = normalizeChain(chain) === "bsc";
  const brand = isBsc ? "PancakeSwap" : "Uniswap";
  return `${brand} ${v}`;
}

function tokenUsdLooksValid(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).replace(/,/g, "").replace(/^\$\s*/, "").trim();
  if (!s) return false;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n > 0;
}

/** ERC-20 `Transfer(address,address,uint256)` — `uint256` 在 data 里 → 共 3 个 topic（与 ERC-721 四 topic 区分）。 */
const ERC20_TRANSFER_TOPIC0 =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function transferDedupeKey(item: Erc20TransferItem): string {
  let valueNorm: string;
  try {
    valueNorm = BigInt(String(item.value ?? "0")).toString();
  } catch {
    valueNorm = String(item.value ?? "");
  }
  return [
    (item.hash ?? "").toLowerCase(),
    normalizeAddress(item.contractAddress),
    normalizeAddress(item.from),
    normalizeAddress(item.to),
    valueNorm,
  ].join("|");
}

function topicToAddress(topic: string): string | null {
  const t = String(topic).toLowerCase().replace(/^0x/, "");
  if (t.length < 40) return null;
  return `0x${t.slice(-40)}`;
}

function parseErc20TransfersFromReceiptLogs(
  receipt: JsonRecord | null | undefined,
  txHash: string,
  ctx: { blockNumber?: string | null; timeStamp?: string | null },
): Erc20TransferItem[] {
  const logs = receipt?.logs;
  if (!Array.isArray(logs)) return [];
  const lowerHash = txHash.toLowerCase();
  const out: Erc20TransferItem[] = [];
  for (const raw of logs) {
    const log = raw as {
      address?: string;
      topics?: unknown[];
      data?: string;
      blockNumber?: string;
      transactionIndex?: string;
    };
    const topics = log.topics;
    if (!Array.isArray(topics) || topics.length !== 3) continue;
    const t0 = String(topics[0]).toLowerCase();
    if (t0 !== ERC20_TRANSFER_TOPIC0) continue;
    const fromA = topicToAddress(String(topics[1]));
    const toA = topicToAddress(String(topics[2]));
    if (!fromA || !toA) continue;
    const contractRaw = String(log.address ?? "");
    const contractAddress = normalizeAddress(contractRaw);
    if (!contractAddress.startsWith("0x")) continue;
    let valueStr: string;
    try {
      valueStr = BigInt(String(log.data ?? "0x0")).toString();
    } catch {
      continue;
    }
    const bn =
      log.blockNumber != null
        ? String(log.blockNumber)
        : ctx.blockNumber != null
          ? String(ctx.blockNumber)
          : undefined;
    out.push({
      hash: lowerHash,
      contractAddress,
      from: fromA,
      to: toA,
      value: valueStr,
      blockNumber: bn,
      timeStamp: ctx.timeStamp != null ? String(ctx.timeStamp) : undefined,
      transactionIndex:
        log.transactionIndex != null ? String(log.transactionIndex) : undefined,
    });
  }
  return out;
}

function mergeErc20TransfersDeduped(
  ...lists: Erc20TransferItem[][]
): Erc20TransferItem[] {
  const seen = new Set<string>();
  const merged: Erc20TransferItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      const k = transferDedupeKey(item);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(item);
    }
  }
  return merged;
}

function uniqueContractsInTransferOrder(transfers: Erc20TransferItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of transfers) {
    const c = normalizeAddress(item.contractAddress);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function mapTxStatus(statusHex?: string | null) {
  if (!statusHex) return "pending_or_unknown";
  if (statusHex === "0x1") return "success";
  if (statusHex === "0x0") return "failed";
  return "pending_or_unknown";
}

function detectExternalTxType(transaction: JsonRecord) {
  const to = (transaction.to as string | null | undefined) ?? null;
  const input = String(transaction.input ?? "0x");

  if (!to) return "contract_creation";
  if (input !== "0x" && input !== "0x0") return "contract_call";
  return "native_transfer";
}

type EtherscanV2Module = "proxy" | "account";

async function fetchEtherscanV2<T>(
  chainId: string,
  apiKey: string,
  module: EtherscanV2Module,
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

  const response = await fetch(
    `https://api.etherscan.io/v2/api?${search.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(
      `Etherscan ${module} request failed: HTTP ${response.status}`,
    );
  }

  if (module === "proxy") {
    const payload = (await response.json()) as EtherscanProxyResponse<T>;
    if (payload.error?.message) {
      throw new Error(`Etherscan proxy error: ${payload.error.message}`);
    }
    return payload.result ?? null;
  }

  const payload = (await response.json()) as EtherscanAccountResponse<T>;
  if (payload.status === "0" && payload.message !== "No transactions found") {
    throw new Error(
      `Etherscan account error: ${payload.result ?? payload.message ?? "Unknown error"}`,
    );
  }
  return payload.result;
}

/** Native / gas token last USD via Etherscan `stats` `ethprice` (field name `ethusd` on all supported v2 chains). */
async function fetchEtherscanNativeUsd(
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
    const response = await fetch(
      `https://api.etherscan.io/v2/api?${search.toString()}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      result?: { ethusd?: string } | string;
    };
    if (payload.status !== "1") {
      return null;
    }
    const row = payload.result;
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return null;
    }
    const raw = (row as { ethusd?: string }).ethusd;
    if (raw == null || String(raw).trim() === "") {
      return null;
    }
    const n = Number.parseFloat(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return String(n);
  } catch {
    return null;
  }
}

function coingeckoFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "web3bio-receipt/1.0 (receipt; +https://web3.bio)",
  };
  const demoKey = process.env.COINGECKO_API_KEY?.trim();
  if (demoKey) {
    headers["x-cg-demo-api-key"] = demoKey;
  }
  return headers;
}

/** 免费公共 `simple/token_price`；可选 `COINGECKO_API_KEY`（Demo）提高限流。 */
async function tryCoingeckoTokenUsd(
  chain: string,
  contractLower: string,
): Promise<string | null> {
  const platform = getCoingeckoAssetPlatform(chain);
  if (!platform) return null;
  const addr = contractLower.toLowerCase();
  try {
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${encodeURIComponent(addr)}&vs_currencies=usd`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: coingeckoFetchHeaders(),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as Record<
      string,
      { usd?: number } | undefined
    >;
    const row = payload[addr] ?? payload[contractLower];
    const usd = row?.usd;
    if (usd == null || !Number.isFinite(usd) || usd <= 0) {
      return null;
    }
    return String(usd);
  } catch {
    return null;
  }
}

/**
 * CoinGecko `/coins/{platform}/contract/{address}`：tokenInfo 唯一来源（名称、符号、小数、图、参考价）。
 * 无 `market_data` 时仍可返回元数据；USD 可再由 `tryCoingeckoTokenUsd` 补齐。
 */
async function fetchCoingeckoTokenContractFull(
  chain: string,
  contractLower: string,
): Promise<TokenInfoItem | null> {
  const platform = getCoingeckoAssetPlatform(chain);
  if (!platform) return null;
  const addr = contractLower.toLowerCase();
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      platform,
    )}/contract/${encodeURIComponent(addr)}`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: coingeckoFetchHeaders(),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      name?: string;
      symbol?: string;
      image?: { small?: string; large?: string; thumb?: string };
      market_data?: { current_price?: { usd?: number } };
      detail_platforms?: Record<
        string,
        { decimal_place?: number; contract_address?: string }
      >;
    };
    const rawUsd = payload.market_data?.current_price?.usd;
    const tokenPriceUSD =
      rawUsd != null && Number.isFinite(rawUsd) && rawUsd > 0
        ? String(rawUsd)
        : undefined;
    const imgRaw =
      payload.image?.small ??
      payload.image?.large ??
      payload.image?.thumb ??
      null;
    const image =
      imgRaw != null && String(imgRaw).trim() !== ""
        ? String(imgRaw).trim()
        : undefined;
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

/** 原生币 USD：`ethereum` / `binancecoin`（免费 `simple/price`）。 */
async function tryCoingeckoNativeUsd(chain: string): Promise<string | null> {
  const cgId = normalizeChain(chain) === "bsc" ? "binancecoin" : "ethereum";
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(cgId)}&vs_currencies=usd`,
      {
        cache: "no-store",
        headers: coingeckoFetchHeaders(),
      },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as Record<
      string,
      { usd?: number } | undefined
    >;
    const usd = payload[cgId]?.usd;
    if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
    return String(usd);
  } catch {
    return null;
  }
}

function uniqStrings(values: Array<string | null | undefined>) {
  const set = new Set<string>();
  for (const value of values) {
    const normalized = normalizeAddress(value ?? undefined);
    if (normalized) set.add(normalized);
  }
  return Array.from(set);
}

async function fetchErc20TransfersByTxHash(
  chainId: string,
  apiKey: string,
  hash: string,
  addresses: string[],
) {
  const lowerHash = hash.toLowerCase();
  const merged: Erc20TransferItem[] = [];
  const seen = new Set<string>();

  for (const address of addresses) {
    const result = await fetchEtherscanV2<Erc20TransferItem[] | string>(
      chainId,
      apiKey,
      "account",
      "tokentx",
      {
        address,
        page: "1",
        offset: "100",
        sort: "desc",
      },
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

async function resolveTokenInfoFromCoingecko(
  chain: string,
  transfers: Erc20TransferItem[],
): Promise<{ tokenInfo: TokenInfoItem | null; contractAddress: string | null }> {
  const contracts = uniqueContractsInTransferOrder(transfers);
  if (contracts.length === 0) {
    return { tokenInfo: null, contractAddress: null };
  }

  let fallback: { tokenInfo: TokenInfoItem; contractAddress: string } | null =
    null;

  for (const contract of contracts) {
    let info = await fetchCoingeckoTokenContractFull(chain, contract);
    if (!info) {
      continue;
    }
    if (!tokenUsdLooksValid(info.tokenPriceUSD)) {
      const cgUsd = await tryCoingeckoTokenUsd(chain, contract);
      if (cgUsd) {
        info = { ...info, tokenPriceUSD: cgUsd };
      }
    }
    const priceOk = tokenUsdLooksValid(info.tokenPriceUSD);
    if (priceOk) {
      return { tokenInfo: info, contractAddress: contract };
    }
    if (!fallback) {
      fallback = { tokenInfo: info, contractAddress: contract };
    }
  }

  if (fallback) {
    return {
      tokenInfo: fallback.tokenInfo,
      contractAddress: fallback.contractAddress,
    };
  }

  return { tokenInfo: null, contractAddress: contracts[0] ?? null };
}

/** 按 ERC-20 合约聚合 user 的净流入：to=user → +value，from=user → -value。 */
function aggregateUserNetByToken(
  transfers: Erc20TransferItem[],
  userLower: string,
): Map<string, bigint> {
  const map = new Map<string, bigint>();
  for (const t of transfers) {
    const c = normalizeAddress(t.contractAddress);
    if (!c) continue;
    let v: bigint;
    try {
      v = BigInt(String(t.value ?? "0"));
    } catch {
      continue;
    }
    const fromL = normalizeAddress(t.from);
    const toL = normalizeAddress(t.to);
    const cur = map.get(c) ?? BigInt(0);
    if (toL === userLower && fromL !== userLower) {
      map.set(c, cur + v);
    } else if (fromL === userLower && toL !== userLower) {
      map.set(c, cur - v);
    }
  }
  return map;
}

function findTransferMetaForContract(
  transfers: Erc20TransferItem[],
  contractLower: string,
): Erc20TransferItem | null {
  return (
    transfers.find(
      (t) => normalizeAddress(t.contractAddress) === contractLower,
    ) ?? null
  );
}

async function buildSwapTokenItem(
  chain: string,
  contractLower: string | null,
  rawAmount: bigint,
  hint: {
    transfers: Erc20TransferItem[];
    tokenInfo: TokenInfoItem | null;
    tokenInfoContract: string | null;
  },
): Promise<SwapTokenItem | null> {
  if (!contractLower) {
    const c = normalizeChain(chain);
    return {
      isNative: true,
      contractAddress: null,
      symbol: NATIVE_SYMBOL_BY_CHAIN[c] ?? "ETH",
      decimals: "18",
      rawAmount: rawAmount.toString(),
      image: NATIVE_LOGO_BY_CHAIN[c] ?? null,
    };
  }

  const meta = findTransferMetaForContract(hint.transfers, contractLower);
  const matchInfo =
    hint.tokenInfo &&
    normalizeAddress(
      hint.tokenInfo.contractAddress ?? hint.tokenInfoContract ?? "",
    ) === contractLower
      ? hint.tokenInfo
      : null;

  const symbolHint = matchInfo?.symbol?.trim() || meta?.tokenSymbol?.trim();
  const decimalsHintRaw =
    matchInfo?.divisor?.trim() || meta?.tokenDecimal?.trim();
  const decimalsHintN = decimalsHintRaw
    ? Number.parseInt(decimalsHintRaw, 10)
    : Number.NaN;
  const hasUsableDecimals = Number.isFinite(decimalsHintN) && decimalsHintN >= 0;
  const imageHint = matchInfo?.image?.trim() || null;

  /** 即使 symbol / decimals 已能从 tokentx 元数据取得，仍在缺 logo 时拉一次 CoinGecko，确保两侧 token 都有图。 */
  let extra: TokenInfoItem | null = null;
  if (!symbolHint || !hasUsableDecimals || !imageHint) {
    extra = await fetchCoingeckoTokenContractFull(chain, contractLower);
  }

  return {
    isNative: false,
    contractAddress: contractLower,
    symbol: symbolHint || extra?.symbol || "TOKEN",
    decimals: hasUsableDecimals
      ? String(decimalsHintN)
      : (extra?.divisor ?? "18"),
    rawAmount: rawAmount.toString(),
    tokenName:
      matchInfo?.tokenName ?? meta?.tokenName ?? extra?.tokenName ?? null,
    image: imageHint || extra?.image || null,
  };
}

type InternalTxItem = {
  from?: string;
  to?: string;
  value?: string;
  isError?: string;
};

/** Etherscan v2 单笔 internal txs；仅用于聚合 user 净流入/流出 native（不展示每条）。 */
async function fetchInternalNativeNetForUser(
  chainId: string,
  apiKey: string,
  hash: string,
  userLower: string,
): Promise<bigint> {
  try {
    const result = await fetchEtherscanV2<InternalTxItem[] | string>(
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

/**
 * 仅在交易成功 + 合约调用 时执行；基于 ERC-20 net flow + tx.value 识别 swap。
 * 支持：ERC-20 ↔ ERC-20、native → ERC-20、ERC-20 → native（后者需一次 `txlistinternal` 仅做聚合）。
 */
async function detectSwap(
  chain: string,
  chainId: string,
  apiKey: string,
  hash: string,
  transaction: JsonRecord,
  receipt: JsonRecord | null | undefined,
  txStatus: string,
  transfers: Erc20TransferItem[],
  knownTokenInfo: TokenInfoItem | null,
  knownTokenInfoContract: string | null,
): Promise<SwapInfo | null> {
  if (txStatus !== "success") return null;

  const userLower = normalizeAddress(transaction.from as string | undefined);
  if (!userLower) return null;
  const routerLower = normalizeAddress(transaction.to as string | undefined);
  if (!routerLower) return null;

  /**
   * Gating：只有 router 是已知 DEX / 聚合器，或 logs 中包含 Uniswap V2/V3/V4（含其 fork）`Swap` 事件
   * 时才识别为 swap。否则把 lending / staking / LP 这类「出一个 token 拿一个 receipt token」的合约调用
   * 误判为 swap。
   */
  const knownDexRouter = DEX_ROUTERS_LOWER[routerLower] ?? null;
  const dexFromLogs = detectDexFromLogs(receipt, chain);
  if (!knownDexRouter && !dexFromLogs) return null;

  let nativeOutWei = BigInt(0);
  try {
    const v = String(transaction.value ?? "0x0");
    if (v && v !== "0x" && v !== "0x0") nativeOutWei = BigInt(v);
  } catch {
    nativeOutWei = BigInt(0);
  }

  /**
   * 当 `tx.from`（user EOA）完全不在 ERC-20 transfers 里时，认为 token 流被 `tx.to`（代理 / MEV bot
   * / 智能账户）代为持有，按它的视角重算 net flow。普通 user 直接调 router 的 swap 不会触发这条 fallback。
   */
  const userInvolvedInTransfers = transfers.some((t) => {
    const f = normalizeAddress(t.from);
    const to = normalizeAddress(t.to);
    return f === userLower || to === userLower;
  });
  const effectiveUser =
    !userInvolvedInTransfers && routerLower !== userLower
      ? routerLower
      : userLower;

  const netByToken = aggregateUserNetByToken(transfers, effectiveUser);

  let bestIn: { contract: string; amount: bigint } | null = null;
  let bestOut: { contract: string; amount: bigint } | null = null;
  for (const [c, v] of netByToken) {
    if (v > BigInt(0)) {
      if (!bestIn || v > bestIn.amount) bestIn = { contract: c, amount: v };
    } else if (v < BigInt(0)) {
      const abs = -v;
      const curAbs = bestOut ? -bestOut.amount : BigInt(0);
      if (!bestOut || abs > curAbs) bestOut = { contract: c, amount: v };
    }
  }

  let outContract: string | null;
  let outRaw: bigint;
  if (bestOut) {
    outContract = bestOut.contract;
    outRaw = -bestOut.amount;
  } else if (nativeOutWei > BigInt(0)) {
    outContract = null;
    outRaw = nativeOutWei;
  } else {
    return null;
  }

  let inContract: string | null;
  let inRaw: bigint;
  if (bestIn) {
    inContract = bestIn.contract;
    inRaw = bestIn.amount;
  } else if (outContract) {
    /** ERC-20 → native：拉 internal txs 看 user 净收到多少原生币 */
    const nativeIn = await fetchInternalNativeNetForUser(
      chainId,
      apiKey,
      hash,
      effectiveUser,
    );
    if (nativeIn <= BigInt(0)) return null;
    inContract = null;
    inRaw = nativeIn;
  } else {
    return null;
  }

  if (outContract && inContract && outContract === inContract) return null;
  if (!outContract && !inContract) return null;

  const hint = {
    transfers,
    tokenInfo: knownTokenInfo,
    tokenInfoContract: knownTokenInfoContract,
  };
  const fromToken = await buildSwapTokenItem(chain, outContract, outRaw, hint);
  const toToken = await buildSwapTokenItem(chain, inContract, inRaw, hint);
  if (!fromToken || !toToken) return null;

  return {
    dexName: knownDexRouter ?? dexFromLogs,
    routerAddress: routerLower,
    fromToken,
    toToken,
  };
}

async function resolveFunctionName(functionSelector: string) {
  const response = await fetch(
    `https://www.4byte.directory/api/v1/signatures/?hex_signature=${encodeURIComponent(
      functionSelector,
    )}`,
    { cache: "no-store" },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    results?: Array<{ text_signature?: string }>;
  };

  return payload.results?.[0]?.text_signature ?? null;
}

async function resolveNsProfile(
  address: string,
): Promise<Record<string, unknown>> {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    return { address: [] };
  }

  try {
    const response = await fetch(
      `https://api.web3.bio/ns/ens/${encodeURIComponent(normalizedAddress)}`,
    );

    if (!response.ok) {
      return { address: [normalizedAddress] };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    if (!payload || typeof payload !== "object") {
      return { address: [normalizedAddress] };
    }

    return payload;
  } catch {
    return { address: [normalizedAddress] };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params;
    const chain = normalizeChain(request.nextUrl.searchParams.get("chain"));
    const chainId = getChainId(chain);
    const apiKey = process.env.ETHERSCAN_API_KEY;

    if (!isValidTxHash(hash)) {
      return Response.json(
        { error: "Invalid tx hash. Expected 0x-prefixed 64-byte hash." },
        { status: 400 },
      );
    }

    if (!chainId) {
      return Response.json(
        {
          error: `Unsupported chain '${chain}'. Supported: ${SUPPORTED_CHAINS.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    if (!apiKey) {
      return Response.json(
        { error: "Missing ETHERSCAN_API_KEY in environment variables." },
        { status: 500 },
      );
    }

    const transaction = await fetchEtherscanV2<JsonRecord>(
      chainId,
      apiKey,
      "proxy",
      "eth_getTransactionByHash",
      { txhash: hash },
    );

    if (!transaction) {
      return Response.json(
        { error: "Transaction not found." },
        { status: 404 },
      );
    }

    const blockNumber = (transaction.blockNumber as string | undefined) ?? null;

    const [receipt, block] = await Promise.all([
      fetchEtherscanV2<JsonRecord>(
        chainId,
        apiKey,
        "proxy",
        "eth_getTransactionReceipt",
        {
          txhash: hash,
        },
      ),
      blockNumber
        ? fetchEtherscanV2<JsonRecord>(
            chainId,
            apiKey,
            "proxy",
            "eth_getBlockByNumber",
            {
              tag: blockNumber,
              boolean: "false",
            },
          )
        : Promise.resolve(null),
    ]);

    const input = String(transaction.input ?? "0x");
    const isContractCall =
      Boolean(transaction.to) && input !== "0x" && input !== "0x0";
    const functionSelector = isContractCall ? input.slice(0, 10) : null;
    const functionName = functionSelector
      ? await resolveFunctionName(functionSelector)
      : null;
    const contractAddress =
      (receipt?.contractAddress as string | null | undefined) ??
      (transaction.to as string | null | undefined) ??
      null;

    const erc20Addresses = uniqStrings([
      transaction.from as string | undefined,
      transaction.to as string | undefined,
      (receipt?.contractAddress as string | undefined) ?? undefined,
    ]);
    const tokentxTransfers =
      erc20Addresses.length > 0
        ? await fetchErc20TransfersByTxHash(
            chainId,
            apiKey,
            hash,
            erc20Addresses,
          )
        : [];
    const blockTs = (block?.timestamp as string | undefined) ?? undefined;
    const logTransfers = parseErc20TransfersFromReceiptLogs(receipt, hash, {
      blockNumber,
      timeStamp: blockTs,
    });
    const erc20Transfers = mergeErc20TransfersDeduped(
      tokentxTransfers,
      logTransfers,
    );
    const { tokenInfo, contractAddress: tokenInfoContractAddress } =
      await resolveTokenInfoFromCoingecko(chain, erc20Transfers);
    const externalType = detectExternalTxType(transaction);

    const txToRaw = (transaction.to as string | undefined) ?? "";
    const txToNorm = normalizeAddress(txToRaw);
    let calledContract: TokenInfoItem | null = null;
    if (
      externalType === "contract_call" &&
      txToNorm &&
      erc20Transfers.length === 0
    ) {
      const pricedAddr = normalizeAddress(
        tokenInfo?.contractAddress ?? tokenInfoContractAddress ?? "",
      );
      if (pricedAddr !== txToNorm) {
        calledContract = await fetchCoingeckoTokenContractFull(
          chain,
          txToNorm,
        );
      }
    }

    let ethUsd: string | null = null;
    if (externalType === "native_transfer" && erc20Transfers.length === 0) {
      const cgNative = await tryCoingeckoNativeUsd(chain);
      ethUsd =
        cgNative ?? (await fetchEtherscanNativeUsd(chainId, apiKey));
    }

    const txStatus = mapTxStatus(
      (receipt?.status as string | undefined) ?? undefined,
    );
    const swap =
      externalType === "contract_call"
        ? await detectSwap(
            chain,
            chainId,
            apiKey,
            hash,
            transaction,
            receipt,
            txStatus,
            erc20Transfers,
            tokenInfo,
            tokenInfoContractAddress,
          )
        : null;

    const sanitizedReceipt = receipt
      ? Object.fromEntries(
          Object.entries(receipt).filter(([key]) => key !== "logs"),
        )
      : null;
    const fromAddress = (transaction.from as string | undefined) ?? "";
    const toAddress = (transaction.to as string | undefined) ?? "";
    const [fromProfile, toProfile] = await Promise.all([
      resolveNsProfile(fromAddress),
      toAddress
        ? resolveNsProfile(toAddress)
        : Promise.resolve({ address: [] }),
    ]);
    return Response.json({
      chain,
      chainId,
      hash,
      type: externalType,
      txStatus,
      functionName,
      functionSelector,
      contractAddress,
      transaction,
      receipt: sanitizedReceipt,
      block,
      erc20Transfers: {
        total: erc20Transfers.length,
        transfers: erc20Transfers,
      },
      tokenInfo,
      tokenInfoContractAddress,
      calledContract,
      ethUsd,
      swap,
      from: fromProfile,
      to: toProfile,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown upstream error.",
      },
      { status: 502 },
    );
  }
}
