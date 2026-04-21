import { Suspense } from "react";
import { headers } from "next/headers";
import ReceiptSkeletonCard from "@/components/receipt-skeleton-card";
import TxReceiptCard, { type TxReceiptData } from "@/components/tx-receipt-card";
import {
  normalizeChain,
  SUPPORTED_CHAINS,
  SUPPORTED_CHAIN_SET,
} from "@/utils/network";

type PageProps = {
  params: Promise<{
    chain: string;
    hash: string;
  }>;
};

type TxApiResponse = {
  error?: string;
  type?: TxReceiptData["type"];
  txStatus?: TxReceiptData["txStatus"];
  functionName?: TxReceiptData["functionName"];
  functionSelector?: TxReceiptData["functionSelector"];
  contractAddress?: TxReceiptData["contractAddress"];
  transaction?: TxReceiptData["transaction"];
  receipt?: TxReceiptData["receipt"];
  block?: TxReceiptData["block"];
  from?: TxReceiptData["from"];
  to?: TxReceiptData["to"];
  erc20Transfers?: {
    total?: number;
    transfers?: TxReceiptData["erc20Transfers"]["transfers"];
  };
  tokenInfo?: TxReceiptData["tokenInfo"];
  tokenInfoContractAddress?: TxReceiptData["tokenInfoContractAddress"];
  ethUsd?: TxReceiptData["ethUsd"];
  [key: string]: unknown;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

function ErrorState({ message }: { message: string }) {
  return (
    <section className="receipt-shell">
      <article className="receipt-card">
        <p className="receipt-error-text">{message}</p>
      </article>
    </section>
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

  if (!TX_HASH_REGEX.test(hash)) {
    return <ErrorState message="Invalid tx hash. Expected 0x-prefixed 64-byte hash." />;
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (!host) {
    return <ErrorState message="Unable to resolve request host for internal API call." />;
  }

  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const origin = `${protocol}://${host}`;
  const endpoint = `${origin}/api/tx/${encodeURIComponent(hash)}?chain=${encodeURIComponent(chainKey)}`;
  const response = await fetch(endpoint, { cache: "no-store" });

  if (!response.ok) {
    const maybeJson = (await response.json().catch(() => null)) as TxApiResponse | null;
    const message = maybeJson?.error ?? `Request failed with HTTP ${response.status}.`;
    return <ErrorState message={message} />;
  }

  const data = (await response.json()) as TxApiResponse;

  if (!data || data.error) {
    return <ErrorState message={data?.error ?? "Empty response from upstream API."} />;
  }

  if (!data.transaction) {
    return <ErrorState message="Missing transaction payload." />;
  }

  return (
    <TxReceiptCard
      chain={chainKey}
      hash={hash}
      data={{
        type: data.type,
        txStatus: data.txStatus,
        functionName: data.functionName,
        functionSelector: data.functionSelector,
        contractAddress: data.contractAddress,
        transaction: data.transaction,
        receipt: data.receipt,
        block: data.block,
        from: data.from,
        to: data.to,
        erc20Transfers: {
          total: data.erc20Transfers?.total ?? 0,
          transfers: data.erc20Transfers?.transfers ?? [],
        },
        tokenInfo: data.tokenInfo ?? null,
        tokenInfoContractAddress: data.tokenInfoContractAddress ?? null,
        ethUsd: data.ethUsd ?? null,
      }}
    />
  );
}

export default async function TxPage({ params }: PageProps) {
  const { chain, hash } = await params;

  return (
    <main className="receipt-page">
      <div className="receipt-page-wrap">
        <Suspense fallback={<ReceiptSkeletonCard />}>
          <TxContent chain={chain} hash={hash} />
        </Suspense>
      </div>
    </main>
  );
}
