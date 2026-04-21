import { NextRequest } from "next/server";
import {
  getChainId,
  getCoingeckoAssetPlatform,
  normalizeChain,
  SUPPORTED_CHAINS,
} from "@/utils/network";
import { normalizeAddress } from "@/utils/utils";

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

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

async function fetchEtherscanProxy<T>(
  chainId: string,
  apiKey: string,
  action: string,
  params: Record<string, string>,
) {
  const search = new URLSearchParams({
    chainid: chainId,
    module: "proxy",
    action,
    apikey: apiKey,
    ...params,
  });

  const response = await fetch(
    `https://api.etherscan.io/v2/api?${search.toString()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Etherscan proxy request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as EtherscanProxyResponse<T>;

  if (payload.error?.message) {
    throw new Error(`Etherscan proxy error: ${payload.error.message}`);
  }

  return payload.result ?? null;
}

async function fetchEtherscanAccount<T>(
  chainId: string,
  apiKey: string,
  action: string,
  params: Record<string, string>,
) {
  const search = new URLSearchParams({
    chainid: chainId,
    module: "account",
    action,
    apikey: apiKey,
    ...params,
  });

  const response = await fetch(
    `https://api.etherscan.io/v2/api?${search.toString()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Etherscan account request failed: HTTP ${response.status}`,
    );
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
    const result = await fetchEtherscanAccount<Erc20TransferItem[] | string>(
      chainId,
      apiKey,
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

    if (!TX_HASH_REGEX.test(hash)) {
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

    const transaction = await fetchEtherscanProxy<JsonRecord>(
      chainId,
      apiKey,
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
      fetchEtherscanProxy<JsonRecord>(
        chainId,
        apiKey,
        "eth_getTransactionReceipt",
        {
          txhash: hash,
        },
      ),
      blockNumber
        ? fetchEtherscanProxy<JsonRecord>(
            chainId,
            apiKey,
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
      txStatus: mapTxStatus(
        (receipt?.status as string | undefined) ?? undefined,
      ),
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
