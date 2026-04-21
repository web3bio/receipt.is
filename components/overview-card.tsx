"use client";

import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import styles from "@/styles/overview-card.module.css";

type OverviewCardProps = {
  usdValue: string;
  amount: string;
  tokenSymbol: string;
  /** Small logo shown before the amount in the flow line (e.g. ERC-20 icon). */
  tokenLogoUrl?: string | null;
  /** Block timestamp: unix seconds as decimal string or `0x` hex (Etherscan-style). */
  blockTimestamp?: string;
  fromIdentityText: string;
  fromAvatarUrl?: string | null;
  toIdentityText: string;
  toAvatarUrl?: string | null;
};

function parseBlockTimestampToDate(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  const asNumber = raw.startsWith("0x")
    ? Number.parseInt(raw, 16)
    : Number.parseInt(raw, 10);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return null;
  return new Date(asNumber * 1000);
}

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

/** Strip locale-style `US$` so the headline shows `$` only (e.g. `toLocaleString` USD). */
function normalizeUsdHeadline(s: string) {
  return s
    .trim()
    .replace(/^<\s*US\$/i, "< $")
    .replace(/^US\$/i, "$");
}

function UsdPriceRow({ value }: { value: string }) {
  const valueNorm = normalizeUsdHeadline(value);
  const lt = valueNorm.match(/^<\s*\$(.*)$/);
  if (lt) {
    return (
      <p className={styles.price} aria-label={valueNorm}>
        <span className={styles.priceDigits}>&lt;&nbsp;</span>
        <span className={styles.priceDollar}>$</span>
        <span className={styles.priceDigits}>{lt[1].trim()}</span>
      </p>
    );
  }
  const dollars = valueNorm.match(/^\$(.*)$/);
  if (dollars) {
    return (
      <p className={styles.price} aria-label={valueNorm}>
        <span className={styles.priceDollar}>$</span>
        <span className={styles.priceDigits}>{dollars[1]}</span>
      </p>
    );
  }
  const dollarIdx = valueNorm.indexOf("$");
  if (dollarIdx >= 0) {
    return (
      <p className={styles.price} aria-label={valueNorm}>
        {dollarIdx > 0 ? (
          <span className={styles.priceDigits}>{valueNorm.slice(0, dollarIdx)}</span>
        ) : null}
        <span className={styles.priceDollar}>$</span>
        <span className={styles.priceDigits}>{valueNorm.slice(dollarIdx + 1)}</span>
      </p>
    );
  }
  return (
    <p className={styles.price} aria-label={valueNorm}>
      <span className={styles.priceDigits}>{valueNorm}</span>
    </p>
  );
}

export default function OverviewCard({
  usdValue,
  amount,
  tokenSymbol,
  tokenLogoUrl,
  blockTimestamp,
  fromIdentityText,
  fromAvatarUrl,
  toIdentityText,
  toAvatarUrl,
}: OverviewCardProps) {
  const txDate = parseBlockTimestampToDate(blockTimestamp);
  const relativeTime = txDate
    ? formatDistanceToNow(txDate, { addSuffix: true, locale: enUS })
    : "-";

  return (
    <section className={styles.card}>
      <div className={styles.priceBlock}>
        <UsdPriceRow value={usdValue} />
      </div>

      <div className={styles.flow}>
        <p className={`${styles.line} ${styles.lineMain}`}>
          <span className={styles.identity}>
            <Avatar label={fromIdentityText} avatarUrl={fromAvatarUrl} />
            <span className={styles.identityText}>{fromIdentityText}</span>
          </span>
          <span className={styles.pill}>sent</span>
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
            <strong>{amount}</strong>
            <span className={styles.symbol}>{tokenSymbol}</span>
          </span>
          <span className={styles.pill}>to</span>
        </p>
        <p className={`${styles.line} ${styles.lineSub}`}>
          <span className={styles.identity}>
            <Avatar label={toIdentityText} avatarUrl={toAvatarUrl} />
            <span className={styles.identityText}>{toIdentityText}</span>
          </span>
          <span className={styles.timeInline}>{relativeTime}</span>
        </p>
      </div>

      <hr className={styles.divider} />
      <p className={styles.note}>Note from this transaction</p>
    </section>
  );
}
