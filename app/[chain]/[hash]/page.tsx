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
  SUPPORTED_CHAIN_SET,
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

  if (!SUPPORTED_CHAIN_SET.has(chainKey)) {
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

  const timestamp = receiptData.block?.timestamp;
  const relativeTime = formatBlockTimestampRelative(typeof timestamp === "string" ? timestamp : undefined);
  return <ReceiptCard chain={chainKey} hash={hash} data={receiptData} relativeTime={relativeTime} />;
}

const NETWORK_ICON_FILES: Record<string, string> = {
  ethereum: "eth",
  arbitrum: "arb",
  optimism: "op",
  doge: "dogecoin",
};

export default async function TxPage({ params }: PageProps) {
  const { chain, hash } = await params;

  const chainKey = normalizeChain(chain);
  const network = getReceiptNetwork(chainKey);
  const icon = network?.icon.match(/^icons\/icon-([a-z0-9-]+)\.svg$/)?.[1];
  const theme = network ? {
    "--receipt-chain-color": network.primaryColor,
    "--receipt-chain-background": network.bgColor,
    "--receipt-network-icon": icon ? `url("/networks/${NETWORK_ICON_FILES[icon] ?? icon}.svg")` : undefined,
    "--receipt-watermark": icon ? '""' : undefined,
  } as CSSProperties : undefined;

  return (
    <main className="receipt-page" data-chain={chainKey} style={theme}>
      <Suspense fallback={<ReceiptSkeleton />}>
        <TxContent chain={chain} hash={hash} />
      </Suspense>
    </main>
  );
}
