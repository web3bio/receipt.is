import { Suspense } from "react";
import ReceiptCard from "@/components/receipt-card";
import ReceiptSkeleton from "@/components/receipt-skeleton";
import {
  getChainId,
  isValidTxHash,
  normalizeChain,
  SUPPORTED_CHAINS,
  SUPPORTED_CHAIN_SET,
} from "@/lib/chain";
import { receiptErrorMessage } from "@/lib/tx-errors";
import { buildTxReceipt } from "@/lib/tx-receipt";
import { toReceiptData, type TxReceiptData } from "@/lib/types";

type PageProps = {
  params: Promise<{
    chain: string;
    hash: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ErrorState({ message }: { message: string }) {
  return (
    <article className="receipt-card">
      <p className="receipt-error">{message}</p>
    </article>
  );
}

async function TxContent({ chain, hash }: { chain: string; hash: string }) {
  const chainKey = normalizeChain(chain);

  if (!SUPPORTED_CHAIN_SET.has(chainKey)) {
    return (
      <ErrorState
        message={`Unsupported chain '${chain}'. Supported: ${SUPPORTED_CHAINS.join(", ")}.`}
      />
    );
  }

  if (!isValidTxHash(hash)) {
    return <ErrorState message="Invalid tx hash. Expected 0x-prefixed 64-byte hash." />;
  }

  const chainId = getChainId(chainKey);
  if (!chainId) {
    return (
      <ErrorState
        message={`Unsupported chain '${chainKey}'. Supported: ${SUPPORTED_CHAINS.join(", ")}.`}
      />
    );
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return (
      <ErrorState message="Missing ETHERSCAN_API_KEY in environment variables." />
    );
  }

  let receiptData: TxReceiptData;
  try {
    receiptData = toReceiptData(await buildTxReceipt(chainKey, hash, apiKey));
  } catch (error) {
    return <ErrorState message={receiptErrorMessage(error)} />;
  }

  return <ReceiptCard chain={chainKey} hash={hash} data={receiptData} />;
}

export default async function TxPage({ params }: PageProps) {
  const { chain, hash } = await params;

  return (
    <main className="receipt-page">
      <Suspense fallback={<ReceiptSkeleton />}>
        <TxContent chain={chain} hash={hash} />
      </Suspense>
    </main>
  );
}
