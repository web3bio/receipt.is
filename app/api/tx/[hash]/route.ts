import { NextRequest } from "next/server";
import { getChainId, normalizeChain, SUPPORTED_CHAINS } from "@/utils/network";
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

type EtherscanTokenResponse<T> = {
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

async function fetchEtherscanToken<T>(
  chainId: string,
  apiKey: string,
  action: string,
  params: Record<string, string>,
) {
  const search = new URLSearchParams({
    chainid: chainId,
    module: "token",
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
    throw new Error(`Etherscan token request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as EtherscanTokenResponse<T>;

  if (payload.status === "0") {
    throw new Error(
      `Etherscan token error: ${payload.result ?? payload.message ?? "Unknown error"}`,
    );
  }

  return payload.result;
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

async function resolveTokenInfoFromTransfers(
  chainId: string,
  apiKey: string,
  transfers: Erc20TransferItem[],
): Promise<{ tokenInfo: TokenInfoItem | null; contractAddress: string | null }> {
  const firstContract = transfers
    .map((item) => normalizeAddress(item.contractAddress))
    .find(Boolean);

  if (!firstContract) {
    return { tokenInfo: null, contractAddress: null };
  }

  try {
    const result = await fetchEtherscanToken<TokenInfoItem[] | TokenInfoItem>(
      chainId,
      apiKey,
      "tokeninfo",
      { contractaddress: firstContract },
    );
    const tokenInfo = Array.isArray(result) ? result[0] : result;
    if (!tokenInfo || typeof tokenInfo !== "object") {
      return { tokenInfo: null, contractAddress: firstContract };
    }
    return { tokenInfo, contractAddress: firstContract };
  } catch {
    // tokeninfo is not guaranteed for every token / plan; degrade gracefully.
    return { tokenInfo: null, contractAddress: firstContract };
  }
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
    const erc20Transfers =
      erc20Addresses.length > 0
        ? await fetchErc20TransfersByTxHash(
            chainId,
            apiKey,
            hash,
            erc20Addresses,
          )
        : [];
    const { tokenInfo, contractAddress: tokenInfoContractAddress } =
      await resolveTokenInfoFromTransfers(
      chainId,
      apiKey,
      erc20Transfers,
      );
    const externalType = detectExternalTxType(transaction);
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
