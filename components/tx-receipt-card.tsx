"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { formatBlockTimestampRelative } from "@/utils/format-block-relative";
import {
  type BlockTimestampMode,
  formatAmount,
  formatBlockNumberReadable,
  formatBlockTimestamp,
  formatOverviewContractMethodPhrase,
  formatText,
  formatUsdFromTokenRaw,
  getExplorerUrl,
  getStatusClass,
  getStatusLabel,
  normalizeAddress,
  parseProfile,
} from "@/utils/utils";
import { getChainDisplayName } from "@/utils/network";
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
  /** `contract_call` 且 `to` 与定价用 token 合约不一致时，对 `transaction.to` 单独拉取的 CoinGecko 元数据 */
  calledContract?: TokenInfo | null;
  /** 原生币 USD（wei 18 位）：优先 CoinGecko，失败则 Etherscan ethprice；仅 native_transfer 且无 ERC-20 */
  ethUsd?: string | null;
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

function hasNonZeroWei(value: unknown) {
  if (value == null) return false;
  try {
    return BigInt(String(value)) > BigInt(0);
  } catch {
    return false;
  }
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
  const [timeMode, setTimeMode] = useState<BlockTimestampMode>("local");
  const tx = data.transaction ?? {};
  const block = data.block ?? {};
  const fromAddress = tx.from as string | undefined;
  const toAddress = tx.to as string | undefined;
  const txStatus = data.txStatus;
  const statusLabel = getStatusLabel(txStatus);
  const pricingTransfer = resolvePricingTransfer(data);
  const nativeEthPricing =
    data.type === "native_transfer" &&
    Boolean(data.ethUsd?.trim()) &&
    hasNonZeroWei(tx.value);

  const tokenSymbol = nativeEthPricing
    ? chain.toLowerCase() === "bsc"
      ? "BNB"
      : "ETH"
    : data.tokenInfo?.symbol ?? pricingTransfer?.tokenSymbol ?? "TOKEN";
  const decimalsForUsd = nativeEthPricing
    ? "18"
    : (() => {
        const td = pricingTransfer?.tokenDecimal;
        const div = data.tokenInfo?.divisor;
        const tdN = td != null ? Number.parseInt(String(td), 10) : Number.NaN;
        if (Number.isFinite(tdN) && tdN > 0) return String(td);
        const divN = div != null ? Number.parseInt(String(div), 10) : Number.NaN;
        if (Number.isFinite(divN) && divN > 0) return String(div);
        return td ?? div ?? undefined;
      })();
  const amount = nativeEthPricing
    ? formatAmount(String(tx.value), "18")
    : formatAmount(pricingTransfer?.value, decimalsForUsd);
  const blockTs = (block.timestamp as string | undefined) ?? undefined;
  const timeText = useMemo(
    () => formatBlockTimestamp(blockTs, timeMode),
    [blockTs, timeMode],
  );
  const timeRelativeAgo = useMemo(
    () => formatBlockTimestampRelative(blockTs),
    [blockTs],
  );
  const fromProfileView = buildProfileView(data.from, fromAddress);
  const toProfileView = buildProfileView(data.to, toAddress);
  const blockNumRaw = tx.blockNumber as string | undefined;
  const blockNumberReadable = formatBlockNumberReadable(blockNumRaw);
  const blockNumberDisplay =
    blockNumberReadable === "-"
      ? "-"
      : txStatus === "success"
        ? `${blockNumberReadable} (Confirmed)`
        : blockNumberReadable;
  const explorerUrl = getExplorerUrl(chain, hash);
  const usdValue = nativeEthPricing
    ? formatUsdFromTokenRaw(String(tx.value), "18", data.ethUsd)
    : formatUsdFromTokenRaw(
        pricingTransfer?.value,
        decimalsForUsd,
        data.tokenInfo?.tokenPriceUSD,
      );

  const tokenLogoUrl = nativeEthPricing
    ? chain.toLowerCase() === "bsc"
      ? "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png"
      : "https://assets.coingecko.com/coins/images/279/small/ethereum.png"
    : (data.tokenInfo?.image ?? null);

  const erc20TransfersList = data.erc20Transfers.transfers ?? [];
  const hasErc20InTx = erc20TransfersList.length > 0;
  const isNativeTxType = data.type === "native_transfer";
  /** 原生转账或本笔存在 ERC-20 转账：overview 用 sent … to … */
  const overviewTransferLayout = isNativeTxType || hasErc20InTx;
  /** 仅合约调用、无上述转账语义 */
  const isContractCallOverview =
    data.type === "contract_call" &&
    Boolean((toAddress ?? "").trim()) &&
    !overviewTransferLayout;

  const contractMethodPhrase = isContractCallOverview
    ? formatOverviewContractMethodPhrase(
        data.functionName,
        data.functionSelector,
      )
    : undefined;

  const overviewToIdentityText = useMemo(() => {
    if (!isContractCallOverview || !toAddress?.trim()) return toProfileView.identityText;
    const t = normalizeAddress(toAddress);
    const tryMeta = (meta?: TokenInfo | null) => {
      if (!meta) return null;
      const c = normalizeAddress(meta.contractAddress);
      const alt = normalizeAddress(data.tokenInfoContractAddress ?? undefined);
      const matches = c === t || (!c && alt === t);
      if (!matches) return null;
      const name = meta.tokenName?.trim();
      const sym = meta.symbol?.trim();
      if (name && sym) return `${name} (${sym})`;
      if (name) return name;
      if (sym) return sym;
      return null;
    };
    return (
      tryMeta(data.calledContract) ??
      tryMeta(data.tokenInfo) ??
      toProfileView.identityText
    );
  }, [
    isContractCallOverview,
    toAddress,
    data.calledContract,
    data.tokenInfo,
    data.tokenInfoContractAddress,
    toProfileView.identityText,
  ]);

  const overviewToAvatarUrl = useMemo(() => {
    if (!isContractCallOverview || !toAddress?.trim()) return toProfileView.avatarUrl;
    const t = normalizeAddress(toAddress);
    const imgFrom = (meta?: TokenInfo | null) => {
      if (!meta?.image?.trim()) return null;
      const c = normalizeAddress(meta.contractAddress);
      const alt = normalizeAddress(data.tokenInfoContractAddress ?? undefined);
      if (c === t || (!c && alt === t)) return meta.image;
      return null;
    };
    return (
      imgFrom(data.calledContract) ??
      imgFrom(data.tokenInfo) ??
      toProfileView.avatarUrl
    );
  }, [
    isContractCallOverview,
    toAddress,
    data.calledContract,
    data.tokenInfo,
    data.tokenInfoContractAddress,
    toProfileView.avatarUrl,
  ]);

  return (
    <section className="receipt-shell">
      <article className="receipt-card">
        <header className="receipt-topbar">
          <span className={`receipt-status-badge ${getStatusClass(txStatus)}`}>{statusLabel}</span>
          <ShareButton />
        </header>

        <OverviewCard
          variant={isContractCallOverview ? "contract_call" : "token_transfer"}
          methodPhrase={contractMethodPhrase}
          usdValue={usdValue}
          amount={amount}
          tokenSymbol={tokenSymbol}
          tokenLogoUrl={tokenLogoUrl}
          blockTimestamp={block.timestamp as string | undefined}
          chainName={
            isContractCallOverview ? getChainDisplayName(chain) : undefined
          }
          fromIdentityText={fromProfileView.identityText}
          fromAvatarUrl={fromProfileView.avatarUrl}
          toIdentityText={
            isContractCallOverview
              ? overviewToIdentityText
              : toProfileView.identityText
          }
          toAvatarUrl={
            isContractCallOverview ? overviewToAvatarUrl : toProfileView.avatarUrl
          }
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
            <li className="receipt-detail-row">
              <span className="receipt-detail-label">Time</span>
              <div className="receipt-detail-time">
                <span className="receipt-detail-time-main">
                  {timeRelativeAgo === "-" ? (
                    "-"
                  ) : (
                    <>
                      <span className="receipt-detail-time-ago">{timeRelativeAgo}</span>
                      {timeText !== "-" && timeText.trim() !== "" ? (
                        <span className="receipt-detail-time-paren"> ({timeText})</span>
                      ) : null}
                    </>
                  )}
                </span>
                <select
                  className="receipt-time-mode-select"
                  aria-label="Time display mode"
                  value={timeMode}
                  onChange={(e) =>
                    setTimeMode(e.target.value as BlockTimestampMode)
                  }
                >
                  <option value="local">Local</option>
                  <option value="unix">Unix</option>
                  <option value="utc">UTC</option>
                </select>
              </div>
            </li>
            <DetailRow label="Network" value={getChainDisplayName(chain)} />
            <DetailRow label="Block" value={blockNumberDisplay} />
            <li className="receipt-detail-row">
              <span className="receipt-detail-label">Transaction Hash</span>
              <span className="receipt-detail-value receipt-detail-value--hash">
                {hash}
              </span>
            </li>
          </ul>
          <a className="receipt-explorer-btn" href={explorerUrl} target="_blank" rel="noreferrer">
            Explorer
          </a>
        </footer>
      </article>
    </section>
  );
}
