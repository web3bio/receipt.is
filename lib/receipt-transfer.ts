import { normalizeAddress } from "@/lib/chain";
import type { Erc20Transfer, JsonRecord } from "@/lib/types";

export function selectReceiptTransfer(
  transfers: Erc20Transfer[],
  tokenContract: string | null,
) {
  const contract = normalizeAddress(tokenContract ?? undefined);
  const hasParties = (item: Erc20Transfer) => Boolean(item.from?.trim() && item.to?.trim());
  const matching = contract
    ? transfers.find((item) => hasParties(item) && normalizeAddress(item.contractAddress) === contract)
    : undefined;
  return matching ?? transfers.find(hasParties);
}

export function receiptParties(transaction: JsonRecord, transfer?: Erc20Transfer) {
  if (transfer?.from && transfer.to) return { from: transfer.from, to: transfer.to };
  return {
    from: typeof transaction.from === "string" ? transaction.from : undefined,
    to: typeof transaction.to === "string" ? transaction.to : undefined,
  };
}
