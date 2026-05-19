"use client";

import { useMemo, useState } from "react";
import {
  getChainDisplayName,
  getExplorerTxUrl,
  getNativeLogoUrl,
  getNativeSymbol,
  normalizeAddress,
} from "@/lib/chain";
import {
  formatAmount,
  formatBlockNumberReadable,
  formatBlockTimestamp,
  formatBlockTimestampRelative,
  formatOverviewContractMethodPhrase,
  formatText,
  formatUsdFromTokenRaw,
  getStatusClass,
  getStatusLabel,
  parseProfile,
  type BlockTimestampMode,
} from "@/lib/format";
import type { SwapToken, TokenInfo, TxReceiptData } from "@/lib/types";
import OverviewSection from "@/components/receipt-overview";
import AddressSection from "@/components/receipt-address";

type ProfileView = {
  identityText: string;
  displayLabel: string;
  addressValue?: string;
  avatarUrl?: string | null;
};

function formatAddressDisplay(value?: string) {
  if (!value) return "-";
  return /^0x[a-fA-F0-9]+$/.test(value) ? formatText(value, 14) : value;
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

function hasNonZeroWei(value: unknown) {
  try {
    return BigInt(String(value ?? "0")) > BigInt(0);
  } catch {
    return false;
  }
}

function resolvePricingTransfer(data: TxReceiptData) {
  const expected = (data.tokenInfoContractAddress ?? "").toLowerCase();
  const transfers = data.erc20Transfers.transfers ?? [];
  if (expected) {
    const matched = transfers.find(
      (item) => (item.contractAddress ?? "").toLowerCase() === expected,
    );
    if (matched) return matched;
  }
  return transfers[0];
}

function ShareButton() {
  return (
    <button
      type="button"
      className="btn btn-sm receipt-action-btn"
      onClick={() => navigator.clipboard.writeText(window.location.href)}
    >
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

function contractLabelForTo(
  toAddress: string,
  data: TxReceiptData,
  fallback: string,
) {
  const t = normalizeAddress(toAddress);
  const tryMeta = (meta?: TokenInfo | null) => {
    if (!meta) return null;
    const c = normalizeAddress(meta.contractAddress);
    const alt = normalizeAddress(data.tokenInfoContractAddress ?? undefined);
    if (c !== t && c && alt !== t) return null;
    const name = meta.tokenName?.trim();
    const sym = meta.symbol?.trim();
    if (name && sym) return `${name} (${sym})`;
    if (name) return name;
    if (sym) return sym;
    return null;
  };
  return tryMeta(data.calledContract) ?? tryMeta(data.tokenInfo) ?? fallback;
}

function avatarForTo(toAddress: string, data: TxReceiptData, fallback: string | null | undefined) {
  const t = normalizeAddress(toAddress);
  const fromMeta = (meta?: TokenInfo | null) => {
    if (!meta?.image?.trim()) return null;
    const c = normalizeAddress(meta.contractAddress);
    const alt = normalizeAddress(data.tokenInfoContractAddress ?? undefined);
    if (c === t || (!c && alt === t)) return meta.image;
    return null;
  };
  return fromMeta(data.calledContract) ?? fromMeta(data.tokenInfo) ?? fallback;
}

export default function ReceiptCard({
  chain,
  hash,
  data,
}: {
  chain: string;
  hash: string;
  data: TxReceiptData;
}) {
  const [timeMode, setTimeMode] = useState<BlockTimestampMode>("local");
  const tx = data.transaction ?? {};
  const block = data.block ?? {};
  const fromAddress = tx.from as string | undefined;
  const toAddress = tx.to as string | undefined;
  const txStatus = data.txStatus;
  const pricingTransfer = resolvePricingTransfer(data);
  const nativePricing =
    data.type === "native_transfer" &&
    Boolean(data.ethUsd?.trim()) &&
    hasNonZeroWei(tx.value);

  const tokenSymbol = nativePricing
    ? getNativeSymbol(chain)
    : (data.tokenInfo?.symbol ?? pricingTransfer?.tokenSymbol ?? "TOKEN");
  const decimalsForUsd = nativePricing
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
  const amount = nativePricing
    ? formatAmount(String(tx.value), "18")
    : formatAmount(pricingTransfer?.value, decimalsForUsd);
  const blockTs = block.timestamp as string | undefined;
  const timeText = useMemo(
    () => formatBlockTimestamp(blockTs, timeMode),
    [blockTs, timeMode],
  );
  const timeRelativeAgo = useMemo(
    () => formatBlockTimestampRelative(blockTs),
    [blockTs],
  );
  const fromProfile = buildProfileView(data.from, fromAddress);
  const toProfile = buildProfileView(data.to, toAddress);
  const blockNumRaw = tx.blockNumber as string | undefined;
  const blockNumberReadable = formatBlockNumberReadable(blockNumRaw);
  const blockNumberDisplay =
    blockNumberReadable === "-"
      ? "-"
      : txStatus === "success"
        ? `${blockNumberReadable} (Confirmed)`
        : blockNumberReadable;
  const explorerUrl = getExplorerTxUrl(chain, hash);
  const usdValue = nativePricing
    ? formatUsdFromTokenRaw(String(tx.value), "18", data.ethUsd)
    : formatUsdFromTokenRaw(
        pricingTransfer?.value,
        decimalsForUsd,
        data.tokenInfo?.tokenPriceUSD,
      );
  const tokenLogoUrl = nativePricing
    ? getNativeLogoUrl(chain)
    : (data.tokenInfo?.image ?? null);

  const hasErc20 = (data.erc20Transfers.transfers ?? []).length > 0;
  const isSwap = data.type === "contract_call" && Boolean(data.swap);
  const isTransferLayout =
    !isSwap && (data.type === "native_transfer" || hasErc20);
  const isContractCall =
    data.type === "contract_call" &&
    Boolean((toAddress ?? "").trim()) &&
    !isSwap &&
    !isTransferLayout;

  const swapView = useMemo(() => {
    const swap = data.swap;
    if (!swap) return null;
    const view = (t: SwapToken) => ({
      amount: formatAmount(t.rawAmount, t.decimals),
      symbol: t.symbol,
      imageUrl: t.image ?? null,
    });
    return {
      from: view(swap.fromToken),
      to: view(swap.toToken),
      dexName: swap.dexName,
      dexIcon: swap.dexIcon,
    };
  }, [data.swap]);

  return (
    <article className="receipt-card">
      <header className="receipt-topbar">
        <span className={`label label-rounded ${getStatusClass(txStatus)}`}>
          {getStatusLabel(txStatus)}
        </span>
        <ShareButton />
      </header>

      <OverviewSection
        variant={isSwap ? "swap" : isContractCall ? "contract_call" : "token_transfer"}
        methodPhrase={
          isContractCall
            ? formatOverviewContractMethodPhrase(data.functionName, data.functionSelector)
            : undefined
        }
        usdValue={usdValue}
        amount={amount}
        tokenSymbol={tokenSymbol}
        tokenLogoUrl={tokenLogoUrl}
        blockTimestamp={blockTs}
        chainName={isContractCall ? getChainDisplayName(chain) : undefined}
        dexName={isSwap ? (swapView?.dexName ?? null) : null}
        dexIcon={isSwap ? (swapView?.dexIcon ?? null) : null}
        swap={isSwap && swapView ? { from: swapView.from, to: swapView.to } : null}
        fromIdentityText={fromProfile.identityText}
        fromAvatarUrl={fromProfile.avatarUrl}
        toIdentityText={
          isContractCall && toAddress
            ? contractLabelForTo(toAddress, data, toProfile.identityText)
            : toProfile.identityText
        }
        toAvatarUrl={
          isContractCall && toAddress
            ? avatarForTo(toAddress, data, toProfile.avatarUrl)
            : toProfile.avatarUrl
        }
      />

      <section className="receipt-flow">
        <AddressSection
          title="FROM"
          addressLabel={fromAddress}
          displayLabel={fromProfile.displayLabel}
          addressValue={fromProfile.addressValue}
          avatarUrl={fromProfile.avatarUrl}
        />
        <div className="btn btn-sm btn-action receipt-flow-arrow" aria-hidden>
          <svg width={18} height={18} viewBox="0 0 32 32" fill="none" aria-hidden>
            <path
              d="m7 16h18m0 0-8.5-8.5m8.5 8.5-8.5 8.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </div>
        <AddressSection
          title="TO"
          addressLabel={toAddress}
          displayLabel={toProfile.displayLabel}
          addressValue={toProfile.addressValue}
          avatarUrl={toProfile.avatarUrl}
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
                    {timeRelativeAgo}
                    {timeText !== "-" && timeText.trim() !== "" ? (
                      <span className="receipt-detail-time-paren"> ({timeText})</span>
                    ) : null}
                  </>
                )}
              </span>
              <select
                className="form-select select-sm receipt-time-mode"
                aria-label="Time display mode"
                value={timeMode}
                onChange={(e) => setTimeMode(e.target.value as BlockTimestampMode)}
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
            <span className="receipt-detail-value receipt-detail-value--hash">{hash}</span>
          </li>
        </ul>
        <a
          className="btn btn-sm receipt-action-btn receipt-action-btn--end"
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
        >
          Explorer
        </a>
      </footer>
    </article>
  );
}
