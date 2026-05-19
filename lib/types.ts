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

export type TxReceiptData = Omit<
  TxReceiptPayload,
  "chain" | "chainId" | "hash"
>;

export function toReceiptData(payload: TxReceiptPayload): TxReceiptData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip route fields for the view model
  const { chain, chainId, hash, ...data } = payload;
  return data;
}
