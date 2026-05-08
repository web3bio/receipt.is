"use client";

import { useMemo } from "react";
import { formatBlockTimestampRelative } from "@/utils/format-block-relative";
import { formatTokenAmountTwoDecimals } from "@/utils/utils";

type OverviewVariant = "contract_call" | "token_transfer" | "swap";

export type SwapTokenView = {
  amount: string;
  symbol: string;
  imageUrl?: string | null;
};

export type OverviewCardProps = {
  variant: OverviewVariant;
  methodPhrase?: string;
  usdValue: string;
  amount: string;
  tokenSymbol: string;
  tokenLogoUrl?: string | null;
  blockTimestamp?: string;
  fromIdentityText: string;
  fromAvatarUrl?: string | null;
  toIdentityText: string;
  toAvatarUrl?: string | null;
  chainName?: string;
  dexName?: string | null;
  swap?: { from: SwapTokenView; to: SwapTokenView } | null;
};

function Avatar({ label, avatarUrl }: { label: string; avatarUrl?: string | null }) {
  const text = label.replace("0x", "").slice(0, 2).toUpperCase() || "NA";
  return (
    <span className="receipt-avatar" aria-hidden>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={label} />
      ) : (
        text
      )}
    </span>
  );
}

function IdentityInline({
  label,
  avatarUrl,
}: {
  label: string;
  avatarUrl?: string | null;
}) {
  return (
    <span className="receipt-identity">
      <Avatar label={label} avatarUrl={avatarUrl} />
      <span className="receipt-identity-text">{label}</span>
    </span>
  );
}

function normalizeUsdHeadline(raw: string) {
  return raw
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^<\s*US\$/i, "< $")
    .replace(/^US\$/i, "$");
}

function UsdPriceRow({ value }: { value: string }) {
  const norm = normalizeUsdHeadline(value);
  const lt = norm.match(/^<\s*\$(.*)$/);
  if (lt) {
    return (
      <p className="receipt-overview-price" aria-label={norm}>
        <span className="receipt-overview-price-prefix">&lt;</span>
        <span className="receipt-overview-price-dollar">$</span>
        <span className="receipt-overview-price-digits">{lt[1].trim()}</span>
      </p>
    );
  }
  const gt = norm.match(/^>\s*\$(.*)$/);
  if (gt) {
    return (
      <p className="receipt-overview-price" aria-label={norm}>
        <span className="receipt-overview-price-prefix">&gt;</span>
        <span className="receipt-overview-price-dollar">$</span>
        <span className="receipt-overview-price-digits">{gt[1].trim()}</span>
      </p>
    );
  }
  const approx = norm.match(/^~\s*\$(.*)$/);
  if (approx) {
    return (
      <p className="receipt-overview-price" aria-label={norm}>
        <span className="receipt-overview-price-prefix">~</span>
        <span className="receipt-overview-price-dollar">$</span>
        <span className="receipt-overview-price-digits">{approx[1].trim()}</span>
      </p>
    );
  }
  const dollars = norm.match(/^\$(.*)$/);
  if (dollars) {
    return (
      <p className="receipt-overview-price" aria-label={norm}>
        <span className="receipt-overview-price-dollar">$</span>
        <span className="receipt-overview-price-digits">{dollars[1].trim()}</span>
      </p>
    );
  }
  const dollarIdx = norm.indexOf("$");
  if (dollarIdx >= 0) {
    return (
      <p className="receipt-overview-price" aria-label={norm}>
        {dollarIdx > 0 ? (
          <span className="receipt-overview-price-digits">{norm.slice(0, dollarIdx)}</span>
        ) : null}
        <span className="receipt-overview-price-dollar">$</span>
        <span className="receipt-overview-price-digits">{norm.slice(dollarIdx + 1)}</span>
      </p>
    );
  }
  return (
    <p className="receipt-overview-price" aria-label={norm}>
      <span className="receipt-overview-price-digits">{norm}</span>
    </p>
  );
}

function SwapTokenInline({ token }: { token: SwapTokenView }) {
  return (
    <span className="receipt-overview-amount">
      {token.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="receipt-token-icon"
          src={token.imageUrl}
          alt=""
          width={16}
          height={16}
        />
      ) : null}
      <strong>{formatTokenAmountTwoDecimals(token.amount)}</strong>
      <span className="receipt-overview-symbol">{token.symbol}</span>
    </span>
  );
}

export default function OverviewCard({
  variant,
  methodPhrase,
  usdValue,
  amount,
  tokenSymbol,
  tokenLogoUrl,
  blockTimestamp,
  fromIdentityText,
  fromAvatarUrl,
  toIdentityText,
  toAvatarUrl,
  chainName,
  dexName,
  swap,
}: OverviewCardProps) {
  const relativeTime = useMemo(
    () => formatBlockTimestampRelative(blockTimestamp),
    [blockTimestamp],
  );
  const displayAmount = useMemo(
    () => formatTokenAmountTwoDecimals(amount),
    [amount],
  );
  const showUsd = Boolean(usdValue?.trim());
  const title = (methodPhrase ?? "").trim() || "Contract";

  const flow =
    variant === "swap" && swap ? (
      <>
        <p className="receipt-overview-line receipt-overview-line--main">
          <span className="receipt-overview-verb">swap</span>
          <SwapTokenInline token={swap.from} />
          <span className="receipt-overview-prep" aria-hidden>
            →
          </span>
          <SwapTokenInline token={swap.to} />
        </p>
        <p className="receipt-overview-line receipt-overview-line--sub">
          <span className="receipt-overview-prep">by</span>
          <IdentityInline label={fromIdentityText} avatarUrl={fromAvatarUrl} />
          {dexName?.trim() ? (
            <>
              <span className="receipt-overview-prep">on</span>
              <span className="receipt-overview-chain">{dexName}</span>
            </>
          ) : null}
          <span className="receipt-overview-time">{relativeTime}</span>
        </p>
      </>
    ) : variant === "contract_call" ? (
      <>
        <p className="receipt-overview-line receipt-overview-line--main">
          <span className="receipt-overview-verb">call</span>
          <span className="receipt-overview-method">{title}</span>
          <span className="receipt-overview-method-badge">Function</span>
        </p>
        <p className="receipt-overview-line receipt-overview-line--sub">
          <span className="receipt-overview-prep">by</span>
          <IdentityInline label={fromIdentityText} avatarUrl={fromAvatarUrl} />
          {chainName ? (
            <>
              <span className="receipt-overview-prep">on</span>
              <span className="receipt-overview-chain">{chainName}</span>
            </>
          ) : null}
          <span className="receipt-overview-time">{relativeTime}</span>
        </p>
      </>
    ) : (
      <>
        <p className="receipt-overview-line receipt-overview-line--main">
          <span className="receipt-overview-verb">sent</span>
          <span className="receipt-overview-amount">
            {tokenLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="receipt-token-icon"
                src={tokenLogoUrl}
                alt=""
                width={16}
                height={16}
              />
            ) : null}
            <strong>{displayAmount}</strong>
            <span className="receipt-overview-symbol">{tokenSymbol}</span>
          </span>
        </p>
        <p className="receipt-overview-line receipt-overview-line--sub">
          <span className="receipt-overview-prep">to</span>
          <IdentityInline label={toIdentityText} avatarUrl={toAvatarUrl} />
          <span className="receipt-overview-time">{relativeTime}</span>
        </p>
      </>
    );

  return (
    <section className="receipt-overview">
      {showUsd ? <UsdPriceRow value={usdValue.trim()} /> : null}
      <div className="receipt-overview-flow">{flow}</div>
    </section>
  );
}
