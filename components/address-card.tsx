"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { formatText } from "@/utils/utils";

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
      className="btn btn-sm btn-link receipt-copy-btn"
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
  if (avatarUrl) {
    return (
      <span className="avatar avatar-lg receipt-avatar-squircle" aria-hidden>
        <img src={avatarUrl} alt={label} />
      </span>
    );
  }
  return (
    <span
      className="avatar avatar-lg receipt-avatar-squircle"
      aria-hidden
      data-initial={text}
    />
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
    <section className="receipt-address">
      <p className="receipt-address-title">{title}</p>
      <div className="receipt-address-row">
        <Avatar label={addressLabel ?? "na"} avatarUrl={avatarUrl} />
        <div className="receipt-address-body">
          <p className="receipt-address-name">
            {displayLabel || formatText(addressLabel ?? "", 14)}
          </p>
          <p className="receipt-address-text">
            <span className="receipt-address-edge">{addressDisplay.prefix}</span>
            {addressDisplay.middle ? (
              <span className="receipt-address-mid">
                {addressDisplay.middle}
              </span>
            ) : null}
            {addressDisplay.suffix ? (
              <span className="receipt-address-edge">
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
