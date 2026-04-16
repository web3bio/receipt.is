import { NextRequest } from "next/server";

const CHAIN_TO_ID: Record<string, string> = {
  eth: "1",
  ethereum: "1",
  sepolia: "11155111",
};

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

type ContractSourceItem = {
  SourceCode?: string;
  ABI?: string;
  ContractName?: string;
  CompilerVersion?: string;
  Proxy?: string;
  Implementation?: string;
  SwarmSource?: string;
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
  params: Record<string, string>
) {
  const search = new URLSearchParams({
    chainid: chainId,
    module: "proxy",
    action,
    apikey: apiKey,
    ...params,
  });

  const response = await fetch(`https://api.etherscan.io/v2/api?${search.toString()}`, {
    cache: "no-store",
  });

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
  params: Record<string, string>
) {
  const search = new URLSearchParams({
    chainid: chainId,
    module: "account",
    action,
    apikey: apiKey,
    ...params,
  });

  const response = await fetch(`https://api.etherscan.io/v2/api?${search.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Etherscan account request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as EtherscanAccountResponse<T>;

  if (payload.status === "0" && payload.message !== "No transactions found") {
    throw new Error(`Etherscan account error: ${payload.result ?? payload.message ?? "Unknown error"}`);
  }

  return payload.result;
}

async function fetchEtherscanContract<T>(
  chainId: string,
  apiKey: string,
  action: string,
  params: Record<string, string>
) {
  const search = new URLSearchParams({
    chainid: chainId,
    module: "contract",
    action,
    apikey: apiKey,
    ...params,
  });

  const response = await fetch(`https://api.etherscan.io/v2/api?${search.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Etherscan contract request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as EtherscanAccountResponse<T>;

  if (payload.status === "0") {
    throw new Error(`Etherscan contract error: ${payload.result ?? payload.message ?? "Unknown error"}`);
  }

  return payload.result;
}

async function resolveFunctionName(functionSelector: string) {
  const response = await fetch(
    `https://www.4byte.directory/api/v1/signatures/?hex_signature=${encodeURIComponent(
      functionSelector
    )}`,
    { cache: "no-store" }
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    results?: Array<{ text_signature?: string }>;
  };

  return payload.results?.[0]?.text_signature ?? null;
}

function normalizeAddress(address: string | null | undefined) {
  if (!address) return null;
  return address.toLowerCase();
}

async function resolveContractMetadata(
  chainId: string,
  apiKey: string,
  address: string
): Promise<{ address: string; contractName: string | null; verified: boolean } | null> {
  try {
    const result = await fetchEtherscanContract<ContractSourceItem[]>(
      chainId,
      apiKey,
      "getsourcecode",
      { address }
    );

    const first = result?.[0];
    if (!first) return null;

    const contractName = first.ContractName?.trim() ? first.ContractName.trim() : null;
    const sourceCode = first.SourceCode?.trim() ?? "";

    return {
      address,
      contractName,
      verified: sourceCode.length > 0,
    };
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const chain = request.nextUrl.searchParams.get("chain")?.toLowerCase() ?? "eth";
    const chainId = CHAIN_TO_ID[chain];
    const apiKey = process.env.ETHERSCAN_API_KEY;

    if (!TX_HASH_REGEX.test(hash)) {
      return Response.json(
        { error: "Invalid tx hash. Expected 0x-prefixed 64-byte hash." },
        { status: 400 }
      );
    }

    if (!chainId) {
      return Response.json(
        { error: `Unsupported chain '${chain}'. Supported: eth, ethereum, sepolia.` },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return Response.json(
        { error: "Missing ETHERSCAN_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    const transaction = await fetchEtherscanProxy<JsonRecord>(
      chainId,
      apiKey,
      "eth_getTransactionByHash",
      { txhash: hash }
    );

    if (!transaction) {
      return Response.json({ error: "Transaction not found." }, { status: 404 });
    }

    const blockNumber = (transaction.blockNumber as string | undefined) ?? null;

    const [receipt, block] = await Promise.all([
      fetchEtherscanProxy<JsonRecord>(chainId, apiKey, "eth_getTransactionReceipt", {
        txhash: hash,
      }),
      blockNumber
        ? fetchEtherscanProxy<JsonRecord>(chainId, apiKey, "eth_getBlockByNumber", {
            tag: blockNumber,
            boolean: "false",
          })
        : Promise.resolve(null),
    ]);

    const input = String(transaction.input ?? "0x");
    const isContractCall = Boolean(transaction.to) && input !== "0x" && input !== "0x0";
    const functionSelector = isContractCall ? input.slice(0, 10) : null;
    const functionName = functionSelector ? await resolveFunctionName(functionSelector) : null;
    const contractAddress =
      (receipt?.contractAddress as string | null | undefined) ??
      (transaction.to as string | null | undefined) ??
      null;

    const erc20Result = await fetchEtherscanAccount<Erc20TransferItem[] | string>(
      chainId,
      apiKey,
      "tokentx",
      { txhash: hash }
    );

    const erc20Transfers = Array.isArray(erc20Result) ? erc20Result : [];
    const externalType = detectExternalTxType(transaction);
    const sanitizedReceipt = receipt
      ? Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== "logs"))
      : null;
    const addressSet = new Set<string>();

    const maybeAddAddress = (value: unknown) => {
      const normalized = normalizeAddress(typeof value === "string" ? value : null);
      if (normalized) addressSet.add(normalized);
    };

    maybeAddAddress(transaction.to);
    maybeAddAddress(receipt?.contractAddress);

    for (const transfer of erc20Transfers) {
      maybeAddAddress(transfer.contractAddress);
      maybeAddAddress(transfer.from);
      maybeAddAddress(transfer.to);
    }

    const addressBookEntries = await Promise.all(
      Array.from(addressSet)
        .slice(0, 30)
        .map(async (address) => [address, await resolveContractMetadata(chainId, apiKey, address)] as const)
    );

    const addressBook = Object.fromEntries(addressBookEntries.filter(([, metadata]) => metadata));

    return Response.json({
      chain,
      chainId,
      hash,
      external: {
        type: externalType,
        txStatus: mapTxStatus((receipt?.status as string | undefined) ?? undefined),
        functionName,
        functionSelector,
        contractAddress,
        transaction,
        receipt: sanitizedReceipt,
        block,
      },
      erc20Transfers: {
        total: erc20Transfers.length,
        transfers: erc20Transfers,
      },
      addressBook,
      dataSource: {
        external: "etherscan proxy",
        erc20Transfers: "etherscan account/tokentx",
        addressBook: "etherscan contract/getsourcecode",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown upstream error.",
      },
      { status: 502 }
    );
  }
}
