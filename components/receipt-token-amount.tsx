"use client";

import { useState } from "react";
import { formatTokenAmount } from "@/lib/format";

export default function ReceiptTokenAmount({ amount }: { amount: string }) {
  const [expanded, setExpanded] = useState(false);
  const { text, approximate } = formatTokenAmount(amount);
  const shortened = approximate || text.includes("e") && text !== amount;

  if (!shortened) return <>{text}</>;

  const display = approximate ? `≈${text}` : text;
  return (
    <button
      type="button"
      className="receipt-token-amount-toggle"
      aria-expanded={expanded}
      aria-label={expanded ? `Show shortened amount, ${amount}` : `Show exact amount, ${display}`}
      title={amount}
      onClick={() => setExpanded(value => !value)}
    >
      {expanded ? amount : display}
    </button>
  );
}
