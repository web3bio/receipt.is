"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { formatText } from "@/utils/utils";
import styles from "@/styles/address-card.module.css";

type AddressCardProps = {
  title: string;
  addressLabel?: string;
  displayLabel?: string;
  addressValue?: string;
  avatarUrl?: string | null;
};

function splitAddressSegments(value?: string) {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return { prefix: "-", middle: "", suffix: "" };
  }

  if (raw.length <= 9) {
    return { prefix: raw, middle: "", suffix: "" };
  }

  return {
    prefix: raw.slice(0, 5),
    middle: raw.slice(5, -4),
    suffix: raw.slice(-4),
  };
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const onCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 3000);
  };

  return (
    <button
      type="button"
      className={styles.copyButton}
      onClick={onCopy}
      aria-label={copied ? "Copied" : "Copy address"}
    >
      <Image
        src={copied ? "/icon-check.svg" : "/icon-copy.svg"}
        alt=""
        width={14}
        height={14}
        aria-hidden
      />
    </button>
  );
}

function Avatar({
  label,
  avatarUrl,
}: {
  label: string;
  avatarUrl?: string | null;
}) {
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

export default function AddressCard({
  title,
  addressLabel,
  displayLabel,
  addressValue,
  avatarUrl,
}: AddressCardProps) {
  const addressDisplay = splitAddressSegments(addressValue || addressLabel);

  return (
    <section className={styles.card}>
      <p className={styles.title}>{title}</p>
      <div className={styles.row}>
        <Avatar label={addressLabel ?? "na"} avatarUrl={avatarUrl} />
        <div className={styles.content}>
          <p className={styles.name}>
            {displayLabel || formatText(addressLabel ?? "", 14)}
          </p>
          <p className={styles.address}>
            <span className={styles.addressEdge}>{addressDisplay.prefix}</span>
            {addressDisplay.middle ? (
              <span className={styles.addressMiddle}>
                {addressDisplay.middle}
              </span>
            ) : null}
            {addressDisplay.suffix ? (
              <span className={styles.addressEdge}>
                {addressDisplay.suffix}
              </span>
            ) : null}
            <CopyButton value={addressValue ?? addressLabel ?? ""} />
          </p>
        </div>
      </div>
    </section>
  );
}
