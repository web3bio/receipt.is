import { isNativeChain, normalizeTransactionId } from "@/lib/chain";
import { buildNativeReceipt } from "@/lib/native-receipt";
import { buildTxReceipt } from "@/lib/tx-receipt";
import type { TxReceiptPayload } from "@/lib/types";

const RECEIPT_CACHE = "receipt-tx-v1";
const RECEIPT_TTL_SECONDS = 365 * 24 * 60 * 60;

export async function getCachedTxReceipt(
  chain: string,
  hash: string,
  apiKey: string | undefined,
  host: string | null,
): Promise<TxReceiptPayload> {
  const normalizedHash = normalizeTransactionId(chain, hash);
  const build = () => isNativeChain(chain)
    ? buildNativeReceipt(chain, normalizedHash)
    : buildTxReceipt(chain, normalizedHash, apiKey);
  if (!host || typeof caches === "undefined") {
    return build();
  }

  const key = `https://${host}/_receipt-cache/${chain}/${encodeURIComponent(normalizedHash)}`;
  let cache: Cache | undefined;
  try {
    cache = await caches.open(RECEIPT_CACHE);
    const hit = await cache.match(key);
    if (hit) return (await hit.json()) as TxReceiptPayload;
  } catch {
    // A cache read failure should fall through to the transaction source.
  }

  const payload = await build();
  const blockNumber = payload.transaction.blockNumber;
  if (
    cache &&
    (payload.txStatus === "success" || payload.txStatus === "failed") &&
    (payload.nativeDetails ? payload.nativeDetails.finalized : (
      blockNumber && payload.block?.number === blockNumber && payload.receipt?.blockNumber === blockNumber
    ))
  ) {
    await cache.put(
      key,
      Response.json(payload, {
        headers: { "Cache-Control": `public, max-age=${RECEIPT_TTL_SECONDS}` },
      }),
    ).catch(() => {
      // The receipt is still usable if the edge cache cannot store it.
    });
  }

  return payload;
}
