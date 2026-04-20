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
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  contractAddress?: string;
};

type TokenInfo = {
  contractAddress?: string;
  tokenName?: string;
  symbol?: string;
  divisor?: string;
  tokenType?: string;
  tokenPriceUSD?: string;
  image?: string;
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
  tokenInfo?: TokenInfo | null;
  tokenInfoContractAddress?: string | null;
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

function formatUsdValue(priceUsdRaw?: string, amountRaw?: string) {
  const price = Number.parseFloat(priceUsdRaw ?? "");
  const amount = Number.parseFloat(amountRaw ?? "");
  if (!Number.isFinite(price) || !Number.isFinite(amount)) return "-";
  const usd = price * amount;
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  return usd.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: usd >= 1 ? 2 : 6,
  });
}

function resolvePricingTransfer(data: TxReceiptData) {
  const expectedContract = (data.tokenInfoContractAddress ?? "").toLowerCase();
  const transfers = data.erc20Transfers.transfers ?? [];
  if (expectedContract) {
    const matched = transfers.find(
      (item) => (item.contractAddress ?? "").toLowerCase() === expectedContract,
    );
    if (matched) return matched;
  }
  return transfers[0];
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
  const pricingTransfer = resolvePricingTransfer(data);
  const tokenSymbol =
    data.tokenInfo?.symbol ?? pricingTransfer?.tokenSymbol ?? "TOKEN";
  const amount = formatAmount(pricingTransfer?.value, pricingTransfer?.tokenDecimal);
  const timeText = formatTimestamp((block.timestamp as string | undefined) ?? undefined);
  const fromProfileView = buildProfileView(data.from, fromAddress);
  const toProfileView = buildProfileView(data.to, toAddress);
  const blockNumber = (tx.blockNumber as string | undefined) ?? "-";
  const explorerUrl = getExplorerUrl(chain, hash);
  const txHashDisplay = formatText(hash, 16);
  const usdValue = formatUsdValue(data.tokenInfo?.tokenPriceUSD, amount);

  return (
    <section className="receipt-shell">
      <article className="receipt-card">
        <header className="receipt-topbar">
          <span className={`receipt-status-badge ${getStatusClass(txStatus)}`}>{statusLabel}</span>
          <ShareButton />
        </header>

        <OverviewCard
          usdValue={usdValue}
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
