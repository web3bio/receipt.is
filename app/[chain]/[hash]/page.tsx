import { headers } from "next/headers";
import { Suspense, type CSSProperties } from "react";
import ReceiptCard from "@/components/receipt-card";
import ReceiptSkeleton from "@/components/receipt-skeleton";
import {
  getReceiptNetwork,
  isNativeChain,
  isValidTransactionId,
  normalizeChain,
  SUPPORTED_CHAINS,
} from "@/lib/chain";
import { getPublicRpcUrl } from "@/lib/evm-rpc";
import { formatBlockTimestampRelative } from "@/lib/format";
import { receiptErrorMessage } from "@/lib/tx-errors";
import { getCachedTxReceipt } from "@/lib/tx-receipt-cache";
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

  if (!getReceiptNetwork(chainKey)) {
    return (
      <ErrorState
        message={`Unsupported chain '${chain}'. Supported: ${SUPPORTED_CHAINS.join(", ")}.`}
      />
    );
  }

  if (!isValidTransactionId(chainKey, hash)) {
    return <ErrorState message="Invalid transaction ID for this network." />;
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!isNativeChain(chainKey) && !getPublicRpcUrl(chainKey) && !apiKey) {
    return (
      <ErrorState message="Missing ETHERSCAN_API_KEY in environment variables." />
    );
  }

  let receiptData: TxReceiptData;
  try {
    const host = (await headers()).get("host");
    receiptData = toReceiptData(await getCachedTxReceipt(chainKey, hash, apiKey, host));
  } catch (error) {
    return <ErrorState message={receiptErrorMessage(error)} />;
  }

  const relativeTime = formatBlockTimestampRelative(receiptData.blockTimestamp);
  return <ReceiptCard chain={chainKey} hash={hash} data={receiptData} relativeTime={relativeTime} />;
}

export default async function TxPage({ params }: PageProps) {
  const { chain, hash } = await params;

  const chainKey = normalizeChain(chain);
  const network = getReceiptNetwork(chainKey);
  const theme = network ? {
    "--receipt-chain-color": network.primaryColor,
    "--receipt-chain-background": network.bgColor,
    "--receipt-network-icon": `url("/kit/${network.icon}")`,
    "--receipt-watermark": '""',
  } as CSSProperties : undefined;

  return (
    <main className="receipt-page" data-chain={chainKey} style={theme}>
      <Suspense fallback={<ReceiptSkeleton />}>
        <TxContent chain={chain} hash={hash} />
      </Suspense>
    </main>
  );
}
