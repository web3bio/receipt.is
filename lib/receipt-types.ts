export type {
  Erc20Transfer,
  JsonRecord,
  SwapInfo,
  SwapToken,
  TokenInfo,
  TxReceiptPayload,
} from "@/lib/types";

export type TxReceiptData = Omit<
  import("@/lib/types").TxReceiptPayload,
  "chain" | "chainId" | "hash"
>;
