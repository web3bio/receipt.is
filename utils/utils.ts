export function getStatusLabel(txStatus?: string) {
  if (txStatus === "success") return "Confirmed";
  if (txStatus === "failed") return "Failed";
  return "Pending";
}

export function getStatusClass(txStatus?: string) {
  if (txStatus === "success") return "receipt-status-confirmed";
  if (txStatus === "failed") return "receipt-status-failed";
  return "receipt-status-pending";
}

export function normalizeAddress(value?: string) {
  return (value ?? "").toLowerCase();
}

export function shortenAddress(address?: string, head = 6, tail = 4) {
  if (!address) return "-";
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function formatTimestamp(timestampHexOrUnix?: string) {
  if (!timestampHexOrUnix) return "-";
  const asNumber = timestampHexOrUnix.startsWith("0x")
    ? Number.parseInt(timestampHexOrUnix, 16)
    : Number.parseInt(timestampHexOrUnix, 10);

  if (!Number.isFinite(asNumber) || asNumber <= 0) return "-";
  return new Date(asNumber * 1000).toLocaleString();
}

export function formatAmount(value?: string, decimals?: string) {
  if (!value) return "0";
  const decimalCount = Number.parseInt(decimals ?? "0", 10);
  if (!Number.isFinite(decimalCount) || decimalCount <= 0) return value;

  try {
    const base = BigInt(10) ** BigInt(decimalCount);
    const raw = BigInt(value);
    const integer = raw / base;
    const fraction = raw % base;
    if (fraction === BigInt(0)) return integer.toString();
    const fractionStr = fraction.toString().padStart(decimalCount, "0").replace(/0+$/, "");
    return `${integer.toString()}.${fractionStr}`;
  } catch {
    return value;
  }
}

export function getExplorerUrl(chain: string, hash: string) {
  const key = chain.toLowerCase();
  if (key === "sepolia") return `https://sepolia.etherscan.io/tx/${hash}`;
  return `https://etherscan.io/tx/${hash}`;
}
