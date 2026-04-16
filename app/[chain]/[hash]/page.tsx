import { Suspense } from "react";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{
    chain: string;
    hash: string;
  }>;
};

type TxApiResponse = {
  error?: string;
  external?: unknown;
  erc20Transfers?: {
    total?: number;
    transfers?: unknown[];
  };
  addressBook?: Record<string, unknown>;
  [key: string]: unknown;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

function LoadingCard() {
  return (
    <section className="tx-card">
      <p className="tx-text-muted">Loading transaction details...</p>
      <div className="tx-skeleton-group">
        <div className="tx-skeleton tx-skeleton-short" />
        <div className="tx-skeleton tx-skeleton-full" />
        <div className="tx-skeleton tx-skeleton-medium" />
      </div>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="tx-card">
      <p className="tx-error-text">{message}</p>
    </section>
  );
}

async function TxContent({ chain, hash }: { chain: string; hash: string }) {
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
  const endpoint = `${origin}/api/tx/${encodeURIComponent(hash)}?chain=${encodeURIComponent(chain)}`;
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

  if (!data.external) {
    return <ErrorState message="Missing external transaction payload." />;
  }

  return (
    <section className="tx-card">
      <pre className="tx-json">
        {JSON.stringify(data.external, null, 2)}
      </pre>

      <details className="tx-details">
        <summary className="tx-details-summary">
          ERC-20 transfers ({data.erc20Transfers?.total ?? 0})
        </summary>
        <pre className="tx-json tx-internal-json">
          {JSON.stringify(
            {
              transfers: data.erc20Transfers?.transfers ?? [],
              addressBook: data.addressBook ?? {},
            },
            null,
            2
          )}
        </pre>
      </details>
    </section>
  );
}

export default async function TxPage({ params }: PageProps) {
  const { chain, hash } = await params;

  return (
    <main className="tx-page-center">
      <div className="tx-page-card-wrap">
        <Suspense fallback={<LoadingCard />}>
          <TxContent chain={chain} hash={hash} />
        </Suspense>
      </div>
    </main>
  );
}
