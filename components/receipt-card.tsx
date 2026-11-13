"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
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
  formatOverviewContractMethodPhrase,
  formatText,
  formatUsdFromTokenRaw,
  getStatusClass,
  getStatusLabel,
  type BlockTimestampMode,
  type ParsedProfile,
} from "@/lib/format";
import { receiptParties, selectReceiptTransfer } from "@/lib/receipt-transfer";
import type { ReceiptMovement, SwapToken, TokenInfo, TxReceiptData } from "@/lib/types";
import OverviewSection from "@/components/receipt-overview";
import AddressSection from "@/components/receipt-address";
import ReceiptSurface from "@/components/receipt-surface";
import ReceiptTokenAmount from "@/components/receipt-token-amount";

type ProfileView = {
  identityText: string;
  displayLabel: string;
  addressValue?: string;
  avatarUrl?: string | null;
};

function formatAddressDisplay(value: string | undefined, compact: boolean) {
  if (!value) return "-";
  return compact || /^0x[a-fA-F0-9]+$/.test(value) ? formatText(value, 14) : value;
}

function buildProfileView(profile: ParsedProfile | undefined, fallbackAddress?: string, native = false): ProfileView {
  const identityText = formatAddressDisplay(profile?.identity ?? fallbackAddress, native);
  const avatarIdentity = fallbackAddress || profile?.identity;
  const fallbackAvatar = !native && avatarIdentity
    ? `https://api.web3.bio/avatar/${encodeURIComponent(avatarIdentity)}`
    : null;
  const displayLabel =
    profile?.displayName && identityText
      ? `${profile?.displayName} (${identityText})`
      : profile?.displayName || identityText;
  return {
    identityText,
    displayLabel,
    addressValue: fallbackAddress ?? profile?.address ?? undefined,
    avatarUrl: profile?.avatar ?? fallbackAvatar,
  };
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="receipt-detail-row" data-detail={label}>
      <span className="receipt-detail-label">{label}</span>
      <span className="receipt-detail-value">{value}</span>
    </li>
  );
}

function DetailAmount({ value }: { value: string }) {
  const match = /^([+-]?\d+(?:\.\d+)?)(.*)$/.exec(value);
  if (!match) return <>{value}</>;
  const [, amount, unit] = match;
  return <><ReceiptTokenAmount amount={amount} />{unit}</>;
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

// The browser's timezone becomes available after the first render hydrates.
const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ReceiptCard({
  chain,
  hash,
  data,
  relativeTime,
}: {
  chain: string;
  hash: string;
  data: TxReceiptData;
  relativeTime: string;
}) {
  const [timeMode, setTimeMode] = useState<BlockTimestampMode>("local");
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const tx = data.transaction;
  const txStatus = data.txStatus;
  const pricingTransfer = selectReceiptTransfer(
    data.transfers,
    data.tokenInfoContractAddress,
  );
  const transfer = data.type === "contract_call" && !data.swap ? pricingTransfer : undefined;
  const details = data.nativeDetails;
  const primaryMove = details?.movements.length === 1 ? details.movements[0] : undefined;
  const movements = details?.movements ?? (txStatus === "success"
    ? data.transfers.flatMap((item): ReceiptMovement[] => {
        const { from, to, value, contractAddress } = item;
        if (!from || !to || !value || !contractAddress) return [];
        const contract = normalizeAddress(contractAddress);
        const matchesToken = contract === normalizeAddress(
          data.tokenInfo?.contractAddress ?? data.tokenInfoContractAddress ?? undefined,
        );
        const swapToken = [data.swap?.fromToken, data.swap?.toToken].find(
          token => token?.contractAddress === contract,
        );
        const decimals = item.tokenDecimal ?? swapToken?.decimals ?? (matchesToken ? data.tokenInfo?.divisor : undefined);
        if (!decimals || !/^\d{1,2}$/.test(decimals) || Number(decimals) > 80) {
          return [{ from, to, amount: value, symbol: `base units (${contractAddress})` }];
        }
        const symbol = item.tokenSymbol || swapToken?.symbol || (matchesToken ? data.tokenInfo?.symbol : undefined);
        return [{ from, to, amount: formatAmount(value, decimals), symbol: symbol || contractAddress }];
      })
    : []);
  const transferCount = movements.length;
  const hasMultipleTransfers = transferCount > 1;
  const entries = details?.entries ?? [];
  const inputs = entries.filter(({ label }) => label === "Input" || label === "Coinbase input").length;
  const outputs = entries.filter(({ label }) => label === "Output").length;
  const balanceChanges = entries.filter(({ label }) => label === "Balance change").length;
  const transactionSummary = hasMultipleTransfers
    ? `${transferCount} transfers`
    : inputs || outputs
      ? `${inputs} ${inputs === 1 ? "input" : "inputs"} · ${outputs} ${outputs === 1 ? "output" : "outputs"}`
      : balanceChanges > 0
        ? `${balanceChanges} balance ${balanceChanges === 1 ? "change" : "changes"}`
        : undefined;
  const { from: fromAddress, to: toAddress } = details
    ? { from: primaryMove?.from ?? details.from, to: primaryMove?.to ?? details.to }
    : receiptParties(tx, transfer);
  const nativeTransfer = data.type === "native_transfer";
  const contract = normalizeAddress(pricingTransfer?.contractAddress);
  const tokenInfo = contract && contract === normalizeAddress(
    data.tokenInfo?.contractAddress ?? data.tokenInfoContractAddress ?? undefined,
  ) ? data.tokenInfo : null;
  const tokenSymbol = primaryMove?.symbol ?? (nativeTransfer
    ? getNativeSymbol(chain)
    : (tokenInfo?.symbol ?? pricingTransfer?.tokenSymbol ?? "TOKEN"));
  const tokenDecimals = [pricingTransfer?.tokenDecimal, tokenInfo?.divisor].find(
    (value) => value !== undefined && /^\d{1,2}$/.test(value) && Number(value) <= 80,
  );
  const amount = primaryMove?.amount ?? (nativeTransfer
    ? formatAmount(String(tx.value), "18")
    : tokenDecimals !== undefined ? formatAmount(pricingTransfer?.value, tokenDecimals) : "-");
  const blockTs = data.blockTimestamp;
  const timeText = timeMode === "local" && !hydrated ? "-" : formatBlockTimestamp(blockTs, timeMode);
  const fromProfile = buildProfileView(data.from, fromAddress, Boolean(details));
  const toProfile = buildProfileView(data.to, toAddress, Boolean(details));
  const blockNumRaw = tx.blockNumber as string | undefined;
  const blockNumberReadable = formatBlockNumberReadable(blockNumRaw);
  const blockNumberDisplay =
    blockNumberReadable === "-"
      ? "-"
      : txStatus === "success"
        ? `${blockNumberReadable} (Confirmed)`
        : blockNumberReadable;
  const explorerUrl = details?.explorerUrl ?? getExplorerTxUrl(chain, hash);
  const usdValue = nativeTransfer
    ? formatUsdFromTokenRaw(String(tx.value), "18", data.ethUsd)
    : tokenDecimals === undefined
      ? ""
      : formatUsdFromTokenRaw(pricingTransfer?.value, tokenDecimals, tokenInfo?.tokenPriceUSD);
  const tokenLogoUrl = nativeTransfer
    ? getNativeLogoUrl(chain)
    : (tokenInfo?.image ?? null);

  const isSwap = data.type === "contract_call" && Boolean(data.swap);
  const isTransferLayout = !isSwap && (nativeTransfer || Boolean(transfer));
  const isContractCall =
    !details && !hasMultipleTransfers && data.type === "contract_call" &&
    Boolean((toAddress ?? "").trim()) &&
    !isSwap &&
    !isTransferLayout;

  const overviewVariant = isSwap ? "swap"
    : isContractCall ? "contract_call"
      : hasMultipleTransfers || (details && !primaryMove) ? "transaction"
        : "token_transfer";

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
    <ReceiptSurface>
      <header className="receipt-topbar" data-receipt-drag>
        <span className={`label label-rounded ${getStatusClass(txStatus)}`}>
          {getStatusLabel(txStatus)}
        </span>
        <ShareButton />
      </header>

      <OverviewSection
        variant={overviewVariant}
        methodPhrase={
          isContractCall
            ? formatOverviewContractMethodPhrase(data.functionName, data.functionSelector)
            : transactionSummary ?? (details ? formatOverviewContractMethodPhrase(data.functionName) : undefined)
        }
        transactionNote={details && !primaryMove && !transactionSummary && !fromAddress && !toAddress
          ? "No transfer details available"
          : undefined}
        usdValue={usdValue === "-" || (hasMultipleTransfers && !isSwap) ? "" : usdValue}
        amount={amount}
        tokenSymbol={tokenSymbol}
        tokenLogoUrl={tokenLogoUrl}
        relativeTime={relativeTime}
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

      {!hasMultipleTransfers && (fromAddress || toAddress || !details) && (
        <section className="receipt-flow" data-receipt-drag>
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
      )}

      <footer className="receipt-footer" data-receipt-drag>
        <ul className="receipt-detail-list" data-receipt-drag>
          <li className="receipt-detail-row">
            <span className="receipt-detail-label">Time</span>
            <div className="receipt-detail-time">
              <span className="receipt-detail-time-main">
                {relativeTime === "-" ? (
                  "-"
                ) : (
                  <>
                    {relativeTime}
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
          {details?.fee && <DetailRow label="Fee" value={<DetailAmount value={details.fee} />} />}
          {hasMultipleTransfers && movements.map((move, index) => (
            <DetailRow
              key={index}
              label="Transfer"
              value={
                <>
                  <span><ReceiptTokenAmount amount={move.amount} /> {move.symbol}</span>
                  <span className="receipt-transfer-route">
                    {move.from} → {move.to}
                  </span>
                </>
              }
            />
          ))}
          {entries.map((entry, index) => (
            <DetailRow key={index} label={entry.label} value={
              entry.value ? <><DetailAmount value={entry.value} />{entry.address && ` · ${entry.address}`}</>
                : entry.address || "-"
            } />
          ))}
          <li className="receipt-detail-row">
            <span className="receipt-detail-label">Transaction Hash</span>
            <span className="receipt-detail-value receipt-detail-value--hash">{hash}</span>
          </li>
        </ul>
        {explorerUrl && (
          <a
            className="btn btn-sm receipt-action-btn receipt-action-btn--end"
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            Explorer
          </a>
        )}
      </footer>
    </ReceiptSurface>
  );
}
