"use client";

import {
  formatAmount,
  formatTimestamp,
  getExplorerUrl,
  getStatusClass,
  getStatusLabel,
  normalizeAddress,
  shortenAddress,
} from "@/utils/utils";

type JsonRecord = Record<string, unknown>;

type AddressBookItem = {
  address: string;
  contractName: string | null;
  verified: boolean;
};

type TransferItem = {
  from?: string;
  to?: string;
  value?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
};

export type TxReceiptData = {
  external: {
    type?: string;
    txStatus?: string;
    functionName?: string | null;
    functionSelector?: string | null;
    contractAddress?: string | null;
    transaction?: JsonRecord | null;
    receipt?: JsonRecord | null;
    block?: JsonRecord | null;
  };
  erc20Transfers: {
    total: number;
    transfers: TransferItem[];
  };
  addressBook: Record<string, AddressBookItem>;
};

type TxReceiptCardProps = {
  chain: string;
  hash: string;
  data: TxReceiptData;
};

function getAddressMeta(address: string | undefined, addressBook: Record<string, AddressBookItem>) {
  if (!address) return null;
  const item = addressBook[normalizeAddress(address)];
  return item?.contractName ?? null;
}

function CopyButton({ value }: { value: string }) {
  const onCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <button type="button" className="receipt-copy-btn" onClick={onCopy}>
      Copy
    </button>
  );
}

function ShareButton() {
  const onShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
  };

  return (
    <button type="button" className="receipt-share-btn" onClick={onShare}>
      Share
    </button>
  );
}

function Avatar({ label }: { label: string }) {
  const text = label.replace("0x", "").slice(0, 2).toUpperCase() || "NA";
  return <div className="receipt-avatar">{text}</div>;
}

function ProfileCard({
  title,
  address,
  name,
}: {
  title: string;
  address?: string;
  name?: string | null;
}) {
  return (
    <section className="receipt-profile-card">
      <p className="receipt-profile-title">{title}</p>
      <div className="receipt-profile-row">
        <Avatar label={address ?? "na"} />
        <div className="receipt-profile-content">
          <p className="receipt-profile-name">{name || shortenAddress(address)}</p>
          <p className="receipt-profile-address">{address || "-"}</p>
        </div>
        <CopyButton value={address ?? ""} />
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="receipt-detail-row">
      <span className="receipt-detail-label">{label}</span>
      <span className="receipt-detail-value">{value}</span>
    </li>
  );
}

export default function TxReceiptCard({ chain, hash, data }: TxReceiptCardProps) {
  const tx = data.external.transaction ?? {};
  const block = data.external.block ?? {};
  const fromAddress = tx.from as string | undefined;
  const toAddress = tx.to as string | undefined;
  const txStatus = data.external.txStatus;
  const statusLabel = getStatusLabel(txStatus);
  const firstTransfer = data.erc20Transfers.transfers[0];
  const tokenSymbol = firstTransfer?.tokenSymbol ?? "TOKEN";
  const amount = formatAmount(firstTransfer?.value, firstTransfer?.tokenDecimal);
  const timeText = formatTimestamp((block.timestamp as string | undefined) ?? undefined);
  const fromName = getAddressMeta(fromAddress, data.addressBook);
  const toName = getAddressMeta(toAddress, data.addressBook);
  const blockNumber = (tx.blockNumber as string | undefined) ?? "-";
  const explorerUrl = getExplorerUrl(chain, hash);

  return (
    <section className="receipt-shell">
      <article className="receipt-card">
        <header className="receipt-topbar">
          <span className={`receipt-status-badge ${getStatusClass(txStatus)}`}>{statusLabel}</span>
          <ShareButton />
        </header>

        <section className="receipt-summary-card">
          <p className="receipt-price">$ --</p>
          <p className="receipt-summary-line receipt-summary-line-main">
            <span>{shortenAddress(fromAddress)}</span>
            <span className="receipt-summary-token">sent</span>
            <strong>{`${amount} ${tokenSymbol}`}</strong>
            <span className="receipt-summary-token">to</span>
          </p>
          <p className="receipt-summary-line receipt-summary-line-sub">
            <span>{shortenAddress(toAddress)}</span>
            <span className="receipt-summary-time-inline">{timeText}</span>
          </p>
          <hr className="receipt-divider" />
          <p className="receipt-note">Note from this transaction</p>
        </section>

        <section className="receipt-flow">
          <ProfileCard title="FROM" address={fromAddress} name={fromName} />
          <div className="receipt-flow-arrow" aria-hidden>
            ↓
          </div>
          <ProfileCard title="TO" address={toAddress} name={toName} />
        </section>

        <footer className="receipt-footer">
          <ul className="receipt-detail-list">
            <DetailRow label="Time" value={timeText} />
            <DetailRow label="Network" value={chain} />
            <DetailRow label="BlockNumber" value={blockNumber} />
            <DetailRow label="TransactionHash" value={hash} />
          </ul>
          <a className="receipt-explorer-btn" href={explorerUrl} target="_blank" rel="noreferrer">
            Explorer
          </a>
        </footer>
      </article>
    </section>
  );
}
