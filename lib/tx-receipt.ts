import {
  contractNameToTokenInfo,
  fetchVerifiedContractName,
} from "@/lib/contracts";
import {
  fetchNativeUsd as cgNativeUsd,
  fetchTokenInfo,
  nativeSwapToken,
  resolveTokenInfoFromTransfers,
} from "@/lib/coingecko";
import { getChainId, normalizeAddress } from "@/lib/chain";
import { resolveDexDisplay } from "@/lib/dex-display";
import { receiptHasSwapLogs, resolveDexPlatform } from "@/lib/dex";
import {
  etherscanFetch,
  fetchErc20TransfersForTx,
  fetchInternalNativeNet,
  fetchNativeUsd,
} from "@/lib/etherscan";
import { evmRpc, fillRpcTokenInfo, getPublicRpcUrl, type TransactionMethod } from "@/lib/evm-rpc";
import { receiptParties, selectReceiptTransfer } from "@/lib/receipt-transfer";
import type {
  Erc20Transfer,
  JsonRecord,
  SwapInfo,
  SwapToken,
  TokenInfo,
  TxReceiptPayload,
} from "@/lib/types";

const ERC20_TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZK_STACK_NATIVE_TOKEN = "0x000000000000000000000000000000000000800a";
const RPC_ENRICHMENT_TIMEOUT_MS = 3_000;

function transferKey(item: Erc20Transfer) {
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

function topicAddress(topic: string) {
  const t = String(topic).toLowerCase().replace(/^0x/, "");
  return /^0{24}[\da-f]{40}$/.test(t) ? `0x${t.slice(-40)}` : null;
}

function parseLogTransfers(
  receipt: JsonRecord | null | undefined,
  txHash: string,
  ctx: { blockNumber?: string | null; timeStamp?: string | null; nativeToken?: string },
): Erc20Transfer[] {
  const logs = receipt?.logs;
  if (!Array.isArray(logs)) return [];
  const lowerHash = txHash.toLowerCase();
  const out: Erc20Transfer[] = [];
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
    if (String(topics[0]).toLowerCase() !== ERC20_TRANSFER) continue;
    const fromA = topicAddress(String(topics[1]));
    const toA = topicAddress(String(topics[2]));
    if (!fromA || !toA) continue;
    const contractAddress = normalizeAddress(String(log.address ?? ""));
    if (!/^0x[\da-f]{40}$/.test(contractAddress) || contractAddress === ctx.nativeToken) continue;
    if (typeof log.data !== "string" || !/^0x[\da-f]{64}$/i.test(log.data)) continue;
    const valueStr = BigInt(log.data).toString();
    out.push({
      hash: lowerHash,
      contractAddress,
      from: fromA,
      to: toA,
      value: valueStr,
      blockNumber:
        log.blockNumber != null
          ? String(log.blockNumber)
          : ctx.blockNumber != null
            ? String(ctx.blockNumber)
            : undefined,
      timeStamp: ctx.timeStamp != null ? String(ctx.timeStamp) : undefined,
      transactionIndex:
        log.transactionIndex != null ? String(log.transactionIndex) : undefined,
    });
  }
  return out;
}

function mergeTransfers(indexed: Erc20Transfer[], logs: Erc20Transfer[]) {
  const indexedByTransfer = new Map(indexed.map(item => [transferKey(item), item]));
  const loggedTransfers = new Set<string>();
  const merged = logs.map(log => {
    const key = transferKey(log);
    loggedTransfers.add(key);
    return { ...indexedByTransfer.get(key), ...log };
  });

  // Separate on-chain events can have identical token, parties and amount.
  return [...merged, ...indexed.filter(item => !loggedTransfers.has(transferKey(item)))];
}

function mapTxStatus(statusHex?: string | null) {
  if (!statusHex) return "pending_or_unknown";
  if (statusHex === "0x1") return "success";
  if (statusHex === "0x0") return "failed";
  return "pending_or_unknown";
}

function detectTxType(transaction: JsonRecord) {
  const to = (transaction.to as string | null | undefined) ?? null;
  const input = String(transaction.input ?? "0x");
  if (!to) return "contract_creation";
  if (input !== "0x" && input !== "0x0") return "contract_call";
  return "native_transfer";
}

function uniqAddresses(values: Array<string | null | undefined>) {
  const set = new Set<string>();
  for (const value of values) {
    const n = normalizeAddress(value ?? undefined);
    if (n) set.add(n);
  }
  return Array.from(set);
}

function netByToken(transfers: Erc20Transfer[], userLower: string) {
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
    if (toL === userLower && fromL !== userLower) map.set(c, cur + v);
    else if (fromL === userLower && toL !== userLower) map.set(c, cur - v);
  }
  return map;
}

function transferMeta(transfers: Erc20Transfer[], contractLower: string) {
  return (
    transfers.find((t) => normalizeAddress(t.contractAddress) === contractLower) ??
    null
  );
}

async function buildSwapToken(
  chain: string,
  contractLower: string | null,
  rawAmount: bigint,
  hint: {
    transfers: Erc20Transfer[];
    tokenInfo: TokenInfo | null;
    tokenInfoContract: string | null;
    rpcUrl?: string;
    blockNumber?: string | null;
  },
): Promise<SwapToken | null> {
  if (!contractLower) {
    return nativeSwapToken(chain, rawAmount);
  }

  const meta = transferMeta(hint.transfers, contractLower);
  const matchInfo =
    hint.tokenInfo &&
    normalizeAddress(
      hint.tokenInfo.contractAddress ?? hint.tokenInfoContract ?? "",
    ) === contractLower
      ? hint.tokenInfo
      : null;

  let info = matchInfo;
  let symbol = info?.symbol?.trim() || meta?.tokenSymbol?.trim();
  let decimals = info?.divisor ?? meta?.tokenDecimal;
  if (!symbol || decimals == null) {
    info = hint.rpcUrl && hint.blockNumber
      ? await fillRpcTokenInfo(hint.rpcUrl, contractLower, hint.blockNumber, info)
      : info ?? await fetchTokenInfo(chain, contractLower);
    symbol ||= info?.symbol?.trim();
    decimals ??= info?.divisor;
  }

  if (decimals == null || !/^\d{1,2}$/.test(decimals) || Number(decimals) > 80) return null;
  return {
    isNative: false,
    contractAddress: contractLower,
    symbol: symbol || contractLower,
    decimals,
    rawAmount: rawAmount.toString(),
    tokenName: info?.tokenName ?? meta?.tokenName ?? null,
    image: info?.image ?? null,
  };
}


async function detectSwap(
  chain: string,
  transaction: JsonRecord,
  receipt: JsonRecord | null | undefined,
  txStatus: string,
  transfers: Erc20Transfer[],
  knownTokenInfo: TokenInfo | null,
  knownTokenInfoContract: string | null,
  loadInternalNativeNet: ((address: string) => Promise<bigint>) | undefined,
  rpcUrl: string | undefined,
  blockNumber: string | null,
): Promise<SwapInfo | null> {
  if (txStatus !== "success") return null;

  const userLower = normalizeAddress(transaction.from as string | undefined);
  if (!userLower) return null;
  const routerLower = normalizeAddress(transaction.to as string | undefined);
  if (!routerLower) return null;

  const dexLabel = resolveDexPlatform(
    receipt,
    chain,
    transaction.to as string | undefined,
  );
  if (!dexLabel && !receiptHasSwapLogs(receipt)) return null;
  const { name: dexName, icon: dexIcon } = resolveDexDisplay(dexLabel);

  let nativeOutWei = BigInt(0);
  try {
    const v = String(transaction.value ?? "0x0");
    if (v && v !== "0x" && v !== "0x0") nativeOutWei = BigInt(v);
  } catch {
    nativeOutWei = BigInt(0);
  }

  const userInvolvedInTransfers = transfers.some((t) => {
    const f = normalizeAddress(t.from);
    const to = normalizeAddress(t.to);
    return f === userLower || to === userLower;
  });
  const effectiveUser =
    !userInvolvedInTransfers && routerLower !== userLower
      ? routerLower
      : userLower;

  const net = netByToken(transfers, effectiveUser);

  let bestIn: { contract: string; amount: bigint } | null = null;
  let bestOut: { contract: string; amount: bigint } | null = null;
  for (const [c, v] of net) {
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
  } else if (outContract && loadInternalNativeNet) {
    const nativeIn = await loadInternalNativeNet(effectiveUser);
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
    rpcUrl,
    blockNumber,
  };
  const [fromToken, toToken] = await Promise.all([
    buildSwapToken(chain, outContract, outRaw, hint),
    buildSwapToken(chain, inContract, inRaw, hint),
  ]);
  if (!fromToken || !toToken) return null;

  return {
    dexName,
    dexIcon,
    routerAddress: routerLower,
    fromToken,
    toToken,
  };
}

async function resolveFunctionName(functionSelector: string, signal?: AbortSignal) {
  const response = await fetch(
    `https://www.4byte.directory/api/v1/signatures/?hex_signature=${encodeURIComponent(
      functionSelector,
    )}`,
    { cache: "no-store", signal },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    results?: Array<{ text_signature?: string }>;
  };

  return payload.results?.[0]?.text_signature ?? null;
}

async function resolveNsProfile(
  address: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    return { address: [] };
  }

  try {
    const response = await fetch(
      `https://api.web3.bio/ns/ens/${encodeURIComponent(normalizedAddress)}`,
      { signal },
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


export async function buildTxReceipt(
  chain: string,
  hash: string,
  apiKey?: string,
): Promise<TxReceiptPayload> {
  const chainId = getChainId(chain)!;
  const rpcUrl = getPublicRpcUrl(chain);
  const etherscanKey = rpcUrl ? undefined : apiKey;
  if (!rpcUrl && !etherscanKey) {
    throw new Error("Missing ETHERSCAN_API_KEY in environment variables.");
  }
  const readTransactionData = (method: TransactionMethod, value: string) => {
    const isBlock = method === "eth_getBlockByNumber";
    if (rpcUrl) return evmRpc(rpcUrl, method, isBlock ? [value, false] : [value]);
    return etherscanFetch<JsonRecord>(
      chainId,
      etherscanKey!,
      "proxy",
      method,
      isBlock ? { tag: value, boolean: "false" } : { txhash: value },
    );
  };

  const transaction = await readTransactionData("eth_getTransactionByHash", hash);
  if (!transaction) {
    throw new Error("Transaction not found.");
  }

  const blockNumber = (transaction.blockNumber as string | undefined) ?? null;
  const [receipt, block] = await Promise.all([
    readTransactionData("eth_getTransactionReceipt", hash),
    blockNumber ? readTransactionData("eth_getBlockByNumber", blockNumber) : null,
  ]);

  if (rpcUrl && blockNumber && (!receipt || !block || receipt.blockNumber !== blockNumber)) {
    throw new Error("Transaction receipt or block is temporarily unavailable.");
  }
  const input = String(transaction.input ?? "0x");
  const isContractCall =
    Boolean(transaction.to) && input !== "0x" && input !== "0x0";
  const functionSelector = isContractCall ? input.slice(0, 10) : null;
  const functionName = functionSelector
    ? await resolveFunctionName(functionSelector, AbortSignal.timeout(RPC_ENRICHMENT_TIMEOUT_MS)).catch(() => null)
    : null;
  const contractAddress =
    (receipt?.contractAddress as string | null | undefined) ??
    (transaction.to as string | null | undefined) ??
    null;

  const erc20Addresses = uniqAddresses([
    transaction.from as string | undefined,
    transaction.to as string | undefined,
    (receipt?.contractAddress as string | undefined) ?? undefined,
  ]);
  const blockTs = (block?.timestamp as string | undefined) ?? undefined;
  const logTransfers = parseLogTransfers(receipt, hash, {
    blockNumber,
    timeStamp: blockTs,
    nativeToken: ["lens", "zksync"].includes(chain) ? ZK_STACK_NATIVE_TOKEN : undefined,
  });
  const tokentxTransfers = etherscanKey && logTransfers.length > 0
    ? await fetchErc20TransfersForTx(chainId, etherscanKey, hash, erc20Addresses).catch(() => [])
    : [];
  const erc20Transfers = mergeTransfers(tokentxTransfers, logTransfers);
  const tokenContracts = uniqAddresses(erc20Transfers.map((t) => t.contractAddress));
  const { tokenInfo: indexedTokenInfo, contractAddress: tokenInfoContractAddress } =
    await resolveTokenInfoFromTransfers(
      chain,
      rpcUrl ? tokenContracts.slice(0, 3) : tokenContracts,
    );
  const selectedTransfer = selectReceiptTransfer(erc20Transfers, tokenInfoContractAddress);
  const selectedContract = selectedTransfer?.contractAddress;
  const tokenInfo = rpcUrl && blockNumber && selectedContract
    ? await fillRpcTokenInfo(rpcUrl, selectedContract, blockNumber, indexedTokenInfo)
    : indexedTokenInfo;
  const externalType = detectTxType(transaction);

  const txToRaw = (transaction.to as string | undefined) ?? "";
  const txToNorm = normalizeAddress(txToRaw);
  let calledContract: TokenInfo | null = null;
  if (
    externalType === "contract_call" &&
    txToNorm &&
    erc20Transfers.length === 0
  ) {
    const pricedAddr = normalizeAddress(
      tokenInfo?.contractAddress ?? tokenInfoContractAddress ?? "",
    );
    if (pricedAddr !== txToNorm) {
      const cg = await fetchTokenInfo(chain, txToNorm);
      if (cg?.tokenName?.trim() || cg?.symbol?.trim()) {
        calledContract = cg;
      } else if (etherscanKey) {
        const verified = await fetchVerifiedContractName(
          chainId,
          txToNorm,
          etherscanKey,
        );
        if (verified) {
          calledContract = contractNameToTokenInfo(txToNorm, verified);
        }
      }
    }
  }

  let ethUsd: string | null = null;
  if (externalType === "native_transfer" && erc20Transfers.length === 0) {
    const cgNative = await cgNativeUsd(chain);
    ethUsd = cgNative ?? (etherscanKey ? await fetchNativeUsd(chainId, etherscanKey) : null);
  }

  const txStatus = mapTxStatus((receipt?.status as string | undefined) ?? undefined);
  const swap =
    externalType === "contract_call"
      ? await detectSwap(
          chain,
          transaction,
          receipt,
          txStatus,
          erc20Transfers,
          tokenInfo,
          tokenInfoContractAddress,
          etherscanKey
            ? (address) => fetchInternalNativeNet(chainId, etherscanKey, hash, address)
            : undefined,
          rpcUrl,
          blockNumber,
        )
      : null;

  const sanitizedReceipt = receipt
    ? Object.fromEntries(
        Object.entries(receipt).filter(([key]) => key !== "logs"),
      )
    : null;
  const transfer = externalType === "contract_call" && !swap ? selectedTransfer : undefined;
  const { from: fromAddress, to: toAddress } = receiptParties(transaction, transfer);
  const enrichmentSignal = rpcUrl ? AbortSignal.timeout(RPC_ENRICHMENT_TIMEOUT_MS) : undefined;
  const [fromProfile, toProfile] = await Promise.all([
    resolveNsProfile(fromAddress ?? "", enrichmentSignal),
    resolveNsProfile(toAddress ?? "", enrichmentSignal),
  ]);

  return {
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
    block: block ?? null,
    erc20Transfers: { total: erc20Transfers.length, transfers: erc20Transfers },
    tokenInfo,
    tokenInfoContractAddress,
    calledContract,
    ethUsd,
    swap,
    from: fromProfile,
    to: toProfile,
  };
}

