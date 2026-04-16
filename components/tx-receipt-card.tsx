"use client";

import {
  formatAmount,
  formatText,
  formatTimestamp,
  getExplorerUrl,
  getStatusClass,
  getStatusLabel,
  parseProfile,
} from "@/utils/utils";

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

function Avatar({ label, avatarUrl }: { label: string; avatarUrl?: string | null }) {
  const text = label.replace("0x", "").slice(0, 2).toUpperCase() || "NA";
  return (
    <span className="receipt-avatar" aria-hidden>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="receipt-avatar-image" src={avatarUrl} alt={label} />
      ) : (
        text
      )}
    </span>
  );
}

function ProfileCard({
  title,
  addressLabel,
  displayLabel,
  addressValue,
  avatarUrl,
}: {
  title: string;
  addressLabel?: string;
  displayLabel?: string;
  addressValue?: string;
  avatarUrl?: string | null;
}) {
  const addressDisplay = formatAddressDisplay(addressValue || addressLabel);

  return (
    <section className="receipt-profile-card">
      <p className="receipt-profile-title">{title}</p>
      <div className="receipt-profile-row">
        <Avatar label={addressLabel ?? "na"} avatarUrl={avatarUrl} />
        <div className="receipt-profile-content">
          <p className="receipt-profile-name">{displayLabel || formatText(addressLabel ?? "", 14)}</p>
          <p className="receipt-profile-address">{addressDisplay}</p>
        </div>
        <CopyButton value={addressValue ?? addressLabel ?? ""} />
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

        <section className="receipt-summary-card">
          <p className="receipt-price">$ --</p>
          <p className="receipt-summary-line receipt-summary-line-main">
            <span className="receipt-summary-identity">
              <Avatar label={fromProfileView.identityText} avatarUrl={fromProfileView.avatarUrl} />
              {fromProfileView.identityText}
            </span>
            <span className="receipt-summary-token">sent</span>
            <strong>{`${amount} ${tokenSymbol}`}</strong>
            <span className="receipt-summary-token">to</span>
          </p>
          <p className="receipt-summary-line receipt-summary-line-sub">
            <span className="receipt-summary-identity">
              <Avatar label={toProfileView.identityText} avatarUrl={toProfileView.avatarUrl} />
              {toProfileView.identityText}
            </span>
            <span className="receipt-summary-time-inline">{timeText}</span>
          </p>
          <hr className="receipt-divider" />
          <p className="receipt-note">Note from this transaction</p>
        </section>

        <section className="receipt-flow">
          <ProfileCard
            title="FROM"
            addressLabel={fromAddress}
            displayLabel={fromProfileView.displayLabel}
            addressValue={fromProfileView.addressValue}
            avatarUrl={fromProfileView.avatarUrl}
          />
          <div className="receipt-flow-arrow" aria-hidden>
            ↓
          </div>
          <ProfileCard
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
