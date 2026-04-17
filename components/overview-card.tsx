"use client";

import styles from "@/styles/overview-card.module.css";

type OverviewCardProps = {
  amount: string;
  tokenSymbol: string;
  timeText: string;
  fromIdentityText: string;
  fromAvatarUrl?: string | null;
  toIdentityText: string;
  toAvatarUrl?: string | null;
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

export default function OverviewCard({
  amount,
  tokenSymbol,
  timeText,
  fromIdentityText,
  fromAvatarUrl,
  toIdentityText,
  toAvatarUrl,
}: OverviewCardProps) {
  return (
    <section className={styles.card}>
      <p className={styles.price}>$ --</p>
      <p className={`${styles.line} ${styles.lineMain}`}>
        <span className={styles.identity}>
          <Avatar label={fromIdentityText} avatarUrl={fromAvatarUrl} />
          {fromIdentityText}
        </span>
        <span className={styles.token}>sent</span>
        <strong>{`${amount} ${tokenSymbol}`}</strong>
        <span className={styles.token}>to</span>
      </p>
      <p className={`${styles.line} ${styles.lineSub}`}>
        <span className={styles.identity}>
          <Avatar label={toIdentityText} avatarUrl={toAvatarUrl} />
          {toIdentityText}
        </span>
        <span className={styles.timeInline}>{timeText}</span>
      </p>
      <hr className={styles.divider} />
      <p className={styles.note}>Note from this transaction</p>
    </section>
  );
}
