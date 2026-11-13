import { parseProfile, type ParsedProfile } from "@/lib/format";

export type JsonRecord = Record<string, unknown>;

export type Erc20Transfer = {
  blockNumber?: string;
  timeStamp?: string;
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  contractAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  transactionIndex?: string;
};

export type TokenInfo = {
  contractAddress?: string;
  tokenName?: string;
  symbol?: string;
  divisor?: string;
  tokenType?: string;
  tokenPriceUSD?: string;
  image?: string;
};

export type SwapToken = {
  isNative: boolean;
  contractAddress: string | null;
  symbol: string;
  decimals: string;
  rawAmount: string;
  tokenName?: string | null;
  image?: string | null;
};

export type SwapInfo = {
  dexName: string | null;
  dexIcon: string | null;
  routerAddress: string;
  fromToken: SwapToken;
  toToken: SwapToken;
};

export type TxReceiptPayload = {
  chain: string;
  chainId: string;
  hash: string;
  type: string;
  txStatus: string;
  nativeDetails?: NativeReceiptDetails;
  functionName: string | null;
  functionSelector: string | null;
  contractAddress: string | null;
  transaction: JsonRecord;
  receipt: JsonRecord | null;
  block: JsonRecord | null;
  erc20Transfers: { total: number; transfers: Erc20Transfer[] };
  tokenInfo: TokenInfo | null;
  tokenInfoContractAddress: string | null;
  calledContract: TokenInfo | null;
  ethUsd: string | null;
  swap: SwapInfo | null;
  from: JsonRecord;
  to: JsonRecord;
};

type ReceiptTransferData = Pick<Erc20Transfer, "from" | "to" | "value" | "contractAddress" | "tokenSymbol" | "tokenDecimal">;

export type TxReceiptData = Pick<TxReceiptPayload,
  "type" | "txStatus" | "functionName" | "functionSelector" |
  "tokenInfo" | "tokenInfoContractAddress" | "calledContract" | "ethUsd" | "swap"
> & {
  transaction: Pick<JsonRecord, "from" | "to" | "value" | "blockNumber">;
  blockTimestamp?: string;
  transfers: ReceiptTransferData[];
  nativeDetails?: Omit<NativeReceiptDetails, "finalized">;
  from: ParsedProfile;
  to: ParsedProfile;
};

export function toReceiptData(payload: TxReceiptPayload): TxReceiptData {
  const {
    type, txStatus, functionName, functionSelector, tokenInfo,
    tokenInfoContractAddress, calledContract, ethUsd, swap,
  } = payload;
  const { from, to, value, blockNumber } = payload.transaction;
  const details = payload.nativeDetails;
  const timestamp = payload.block?.timestamp;
  return {
    type, txStatus, functionName, functionSelector, tokenInfo,
    tokenInfoContractAddress, calledContract, ethUsd, swap,
    transaction: { from, to, value, blockNumber },
    blockTimestamp: typeof timestamp === "string" ? timestamp : undefined,
    transfers: payload.erc20Transfers.transfers.map(transfer => {
      const { from, to, value, contractAddress, tokenSymbol, tokenDecimal } = transfer;
      return { from, to, value, contractAddress, tokenSymbol, tokenDecimal };
    }),
    nativeDetails: details && {
      from: details.from,
      to: details.to,
      fee: details.fee,
      explorerUrl: details.explorerUrl,
      movements: details.movements,
      entries: details.entries,
    },
    from: parseProfile(payload.from),
    to: parseProfile(payload.to),
  };
}

export type ReceiptMovement = {
  from: string;
  to: string;
  amount: string;
  symbol: string;
};

export type ReceiptEntry = {
  label: string;
  address?: string;
  value?: string;
};

export type NativeReceiptDetails = {
  from?: string;
  to?: string;
  fee?: string;
  explorerUrl?: string;
  movements: ReceiptMovement[];
  entries?: ReceiptEntry[];
  finalized: boolean;
};
