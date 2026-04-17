"use client";

import Image from "next/image";
import {
  formatAmount,
  formatText,
  formatTimestamp,
  getExplorerUrl,
  getStatusClass,
  getStatusLabel,
  parseProfile,
} from "@/utils/utils";
import AddressCard from "@/components/address-card";
import OverviewCard from "@/components/overview-card";

type JsonRecord = Record<string, unknown>;

type AddressBookItem = {
  [key: string]: unknown;
};

type TransferItem = {
  from?: string;
  to?: string;
  value?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
};

export type TxReceiptData = {
  type?: string;
  txStatus?: string;
  functionName?: string | null;
  functionSelector?: string | null;
  contractAddress?: string | null;
  transaction?: JsonRecord | null;
  receipt?: JsonRecord | null;
  block?: JsonRecord | null;
  from?: AddressBookItem;
  to?: AddressBookItem;
  erc20Transfers: {
    total: number;
    transfers: TransferItem[];
  };
};

type TxReceiptCardProps = {
  chain: string;
  hash: string;
  data: TxReceiptData;
};

type ProfileView = {
  identityText: string;
  displayLabel: string;
  addressValue?: string;
  avatarUrl?: string | null;
};

function formatAddressDisplay(value?: string) {
  if (!value) return "-";
  const isAddress = /^0x[a-fA-F0-9]+$/.test(value);
  return isAddress ? formatText(value, 14) : value;
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="receipt-detail-row">
      <span className="receipt-detail-label">{label}</span>
      <span className="receipt-detail-value">{value}</span>
    </li>
  );
}

function buildProfileView(rawProfile: unknown, fallbackAddress?: string): ProfileView {
  const profile = parseProfile(rawProfile);
  const identityText = formatAddressDisplay(profile.identity ?? fallbackAddress ?? "");
  const fallbackAvatar =
    !profile.avatar && profile.identity
      ? `https://api.web3.bio/avatar/${encodeURIComponent(profile.identity)}`
      : null;
  const displayLabel =
    profile.displayName && identityText
      ? `${profile.displayName} (${identityText})`
      : profile.displayName || identityText;

  return {
    identityText,
    displayLabel,
    addressValue: profile.address ?? undefined,
    avatarUrl: profile.avatar ?? fallbackAvatar,
  };
}

export default function TxReceiptCard({ chain, hash, data }: TxReceiptCardProps) {
  const tx = data.transaction ?? {};
  const block = data.block ?? {};
  const fromAddress = tx.from as string | undefined;
  const toAddress = tx.to as string | undefined;
  const txStatus = data.txStatus;
  const statusLabel = getStatusLabel(txStatus);
  const firstTransfer = data.erc20Transfers.transfers[0];
  const tokenSymbol = firstTransfer?.tokenSymbol ?? "TOKEN";
  const amount = formatAmount(firstTransfer?.value, firstTransfer?.tokenDecimal);
  const timeText = formatTimestamp((block.timestamp as string | undefined) ?? undefined);
  const fromProfileView = buildProfileView(data.from, fromAddress);
  const toProfileView = buildProfileView(data.to, toAddress);
  const blockNumber = (tx.blockNumber as string | undefined) ?? "-";
  const explorerUrl = getExplorerUrl(chain, hash);
  const txHashDisplay = formatText(hash, 16);

  return (
    <section className="receipt-shell">
      <article className="receipt-card">
        <header className="receipt-topbar">
          <span className={`receipt-status-badge ${getStatusClass(txStatus)}`}>{statusLabel}</span>
          <ShareButton />
        </header>

        <OverviewCard
          amount={amount}
          tokenSymbol={tokenSymbol}
          timeText={timeText}
          fromIdentityText={fromProfileView.identityText}
          fromAvatarUrl={fromProfileView.avatarUrl}
          toIdentityText={toProfileView.identityText}
          toAvatarUrl={toProfileView.avatarUrl}
        />

        <section className="receipt-flow">
          <AddressCard
            title="FROM"
            addressLabel={fromAddress}
            displayLabel={fromProfileView.displayLabel}
            addressValue={fromProfileView.addressValue}
            avatarUrl={fromProfileView.avatarUrl}
          />
          <div className="receipt-flow-arrow" aria-hidden>
            <Image src="/icon-arrow.svg" alt="" width={18} height={18} />
          </div>
          <AddressCard
            title="TO"
            addressLabel={toAddress}
            displayLabel={toProfileView.displayLabel}
            addressValue={toProfileView.addressValue}
            avatarUrl={toProfileView.avatarUrl}
          />
        </section>

        <footer className="receipt-footer">
          <ul className="receipt-detail-list">
            <DetailRow label="Time" value={timeText} />
            <DetailRow label="Network" value={chain} />
            <DetailRow label="BlockNumber" value={blockNumber} />
            <DetailRow label="TransactionHash" value={txHashDisplay} />
          </ul>
          <a className="receipt-explorer-btn" href={explorerUrl} target="_blank" rel="noreferrer">
            Explorer
          </a>
        </footer>
      </article>
    </section>
  );
}
