"use client";

import { useState } from "react";

type ReceiptAvatarProps = {
  className: string;
  label: string;
  avatarUrl?: string | null;
};

export default function ReceiptAvatar({ className, label, avatarUrl }: ReceiptAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = avatarUrl !== failedUrl ? avatarUrl : null;
  const initials = label.replace(/^0x/i, "").slice(0, 2).toUpperCase() || "NA";

  return (
    <span className={className} aria-hidden data-initial={src ? undefined : initials}>
      {src ? (
        <img
          src={src}
          alt=""
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailedUrl(src);
          }}
          onError={() => setFailedUrl(src)}
        />
      ) : null}
    </span>
  );
}
