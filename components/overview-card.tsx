"use client";

import { useMemo } from "react";
import { formatBlockTimestampRelative } from "@/utils/format-block-relative";
import { formatTokenAmountTwoDecimals } from "@/utils/utils";
import styles from "@/styles/overview-card.module.css";

type OverviewVariant = "contract_call" | "token_transfer" | "swap";

export type SwapTokenView = {
  amount: string;
  symbol: string;
  imageUrl?: string | null;
};

export type OverviewCardProps = {
  variant: OverviewVariant;
  /** 仅 `contract_call`：方法短语（已由上层格式化）。 */
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
  /** 仅 `contract_call`：链展示名。 */
  chainName?: string;
  /** 仅 `swap`：DEX/聚合器展示名（未识别时为 null/空）。 */
  dexName?: string | null;
  /** 仅 `swap`：双侧 token 视图。 */
  swap?: { from: SwapTokenView; to: SwapTokenView } | null;
};

function Avatar({ label, avatarUrl }: { label: string; avatarUrl?: string | null }) {
  const text = label.replace("0x", "").slice(0, 2).toUpperCase() || "NA";
  return (
    <span className={styles.avatar} aria-hidden>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.avatarImage} src={avatarUrl} alt={label} />
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
    <span className={styles.identity}>
      <Avatar label={label} avatarUrl={avatarUrl} />
      <span className={styles.identityText}>{label}</span>
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
      <p className={styles.price} aria-label={norm}>
        <span className={styles.pricePrefix}>&lt;</span>
        <span className={styles.priceDollar}>$</span>
        <span className={styles.priceDigits}>{lt[1].trim()}</span>
      </p>
    );
  }
  const gt = norm.match(/^>\s*\$(.*)$/);
  if (gt) {
    return (
      <p className={styles.price} aria-label={norm}>
        <span className={styles.pricePrefix}>&gt;</span>
        <span className={styles.priceDollar}>$</span>
        <span className={styles.priceDigits}>{gt[1].trim()}</span>
      </p>
    );
  }
  const approx = norm.match(/^~\s*\$(.*)$/);
  if (approx) {
    return (
      <p className={styles.price} aria-label={norm}>
        <span className={styles.pricePrefix}>~</span>
        <span className={styles.priceDollar}>$</span>
        <span className={styles.priceDigits}>{approx[1].trim()}</span>
      </p>
    );
  }
  const dollars = norm.match(/^\$(.*)$/);
  if (dollars) {
    return (
      <p className={styles.price} aria-label={norm}>
        <span className={styles.priceDollar}>$</span>
        <span className={styles.priceDigits}>{dollars[1].trim()}</span>
      </p>
    );
  }
  const dollarIdx = norm.indexOf("$");
  if (dollarIdx >= 0) {
    return (
      <p className={styles.price} aria-label={norm}>
        {dollarIdx > 0 ? (
          <span className={styles.priceDigits}>{norm.slice(0, dollarIdx)}</span>
        ) : null}
        <span className={styles.priceDollar}>$</span>
        <span className={styles.priceDigits}>{norm.slice(dollarIdx + 1)}</span>
      </p>
    );
  }
  return (
    <p className={styles.price} aria-label={norm}>
      <span className={styles.priceDigits}>{norm}</span>
    </p>
  );
}

function SwapTokenInline({ token }: { token: SwapTokenView }) {
  return (
    <span className={styles.amount}>
      {token.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.tokenIcon}
          src={token.imageUrl}
          alt=""
          width={16}
          height={16}
        />
      ) : null}
      <strong>{formatTokenAmountTwoDecimals(token.amount)}</strong>
      <span className={styles.symbol}>{token.symbol}</span>
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
        <p className={`${styles.line} ${styles.lineMain}`}>
          <span className={styles.verb}>swap</span>
          <SwapTokenInline token={swap.from} />
          <span className={styles.preposition} aria-hidden>
            →
          </span>
          <SwapTokenInline token={swap.to} />
        </p>
        <p className={`${styles.line} ${styles.lineSub}`}>
          <span className={styles.preposition}>by</span>
          <IdentityInline label={fromIdentityText} avatarUrl={fromAvatarUrl} />
          {dexName?.trim() ? (
            <>
              <span className={styles.preposition}>on</span>
              <span className={styles.chain}>{dexName}</span>
            </>
          ) : null}
          <span className={styles.time}>{relativeTime}</span>
        </p>
      </>
    ) : variant === "contract_call" ? (
      <>
        <p className={`${styles.line} ${styles.lineMain}`}>
          <span className={styles.verb}>call</span>
          <span className={styles.title}>{title}</span>
          <span className={styles.badge}>Function</span>
        </p>
        <p className={`${styles.line} ${styles.lineSub}`}>
          <span className={styles.preposition}>by</span>
          <IdentityInline label={fromIdentityText} avatarUrl={fromAvatarUrl} />
          {chainName ? (
            <>
              <span className={styles.preposition}>on</span>
              <span className={styles.chain}>{chainName}</span>
            </>
          ) : null}
          <span className={styles.time}>{relativeTime}</span>
        </p>
      </>
    ) : (
      <>
        <p className={`${styles.line} ${styles.lineMain}`}>
          <span className={styles.verb}>sent</span>
          <span className={styles.amount}>
            {tokenLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.tokenIcon}
                src={tokenLogoUrl}
                alt=""
                width={16}
                height={16}
              />
            ) : null}
            <strong>{displayAmount}</strong>
            <span className={styles.symbol}>{tokenSymbol}</span>
          </span>
        </p>
        <p className={`${styles.line} ${styles.lineSub}`}>
          <span className={styles.preposition}>to</span>
          <IdentityInline label={toIdentityText} avatarUrl={toAvatarUrl} />
          <span className={styles.time}>{relativeTime}</span>
        </p>
      </>
    );

  return (
    <section className={styles.card}>
      {showUsd ? (
        <div className={styles.priceBlock}>
          <UsdPriceRow value={usdValue.trim()} />
        </div>
      ) : null}
      <div className={styles.flow}>{flow}</div>
    </section>
  );
}
