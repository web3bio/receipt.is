import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";

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

export function formatText(string: string, length?: number) {
  if (!string) return "";
  const len = length ?? 12;
  if (string.length <= len) return string;
  const chars = len / 2 - 2;
  if (string.startsWith("0x")) {
    return `${string.slice(0, chars + 2)}...${string.slice(-chars)}`;
  }
  return `${string.slice(0, chars + 1)}...${string.slice(-(chars + 1))}`;
}

export function formatOverviewContractMethodPhrase(
  functionName?: string | null,
  functionSelector?: string | null,
) {
  const raw = (functionName ?? "").trim();
  if (raw) {
    const head = (raw.split("(")[0] ?? raw).trim();
    const spaced = head.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    const parts = spaced.split(/[\s_.-]+/).filter(Boolean);
    const titled = parts
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
      .trim();
    const s = titled || "Contract";
    return s.length > 44 ? `${s.slice(0, 41)}…` : s;
  }
  const sel = (functionSelector ?? "").trim();
  if (sel.startsWith("0x") && sel.length >= 10) {
    return `${sel.slice(0, 10)}…`;
  }
  return "Contract";
}

export type BlockTimestampMode = "local" | "utc" | "unix";

export function parseBlockTimestampSeconds(timestampHexOrUnix?: string) {
  if (!timestampHexOrUnix?.trim()) return null;
  const raw = timestampHexOrUnix.trim();
  const asNumber = raw.startsWith("0x")
    ? Number.parseInt(raw, 16)
    : Number.parseInt(raw, 10);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return null;
  return asNumber;
}

export function formatBlockTimestamp(
  timestampHexOrUnix: string | undefined,
  mode: BlockTimestampMode,
) {
  const sec = parseBlockTimestampSeconds(timestampHexOrUnix);
  if (sec == null) return "-";
  if (mode === "unix") return String(sec);
  const d = new Date(sec * 1000);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  if (mode === "utc") {
    return d.toLocaleString("en-US", { ...opts, timeZone: "UTC" });
  }
  return d.toLocaleString("en-US", opts);
}

export function formatBlockTimestampRelative(timestampHexOrUnix?: string) {
  const sec = parseBlockTimestampSeconds(timestampHexOrUnix);
  if (sec == null) return "-";
  return formatDistanceToNow(new Date(sec * 1000), {
    addSuffix: true,
    locale: enUS,
  });
}

export function formatBlockNumberReadable(raw?: string) {
  if (raw == null || String(raw).trim() === "") return "-";
  const trimmed = String(raw).trim();
  try {
    const n = trimmed.startsWith("0x") ? BigInt(trimmed) : BigInt(trimmed);
    return n.toString();
  } catch {
    return trimmed;
  }
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
    const fractionStr = fraction
      .toString()
      .padStart(decimalCount, "0")
      .replace(/0+$/, "");
    return `${integer.toString()}.${fractionStr}`;
  } catch {
    return value;
  }
}

export function formatTokenAmountTwoDecimals(raw: string) {
  const s = String(raw ?? "")
    .trim()
    .replace(/,/g, "");
  if (s === "" || s === "-") return "0.00";
  const n = Number(s);
  if (!Number.isFinite(n)) return String(raw ?? "").trim() || "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const USD_PRICE_SCALE = 8;

export function formatUsdFromTokenRaw(
  valueRaw?: string | number | null,
  decimalsStr?: string | number | null,
  priceUsdRaw?: string | number | null,
) {
  const valueStr = valueRaw != null && valueRaw !== "" ? String(valueRaw).trim() : "";
  const priceStr =
    priceUsdRaw != null && priceUsdRaw !== "" ? String(priceUsdRaw).trim() : "";
  if (!valueStr || !priceStr) return "-";
  const price = Number.parseFloat(priceStr.replace(/,/g, "").replace(/^\$\s*/, ""));
  if (!Number.isFinite(price) || price < 0) return "-";
  if (price === 0) return "$0.00";
  const decimals = Number.parseInt(String(decimalsStr ?? "0"), 10);
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 80) return "-";
  let raw: bigint;
  try {
    raw = BigInt(valueStr);
  } catch {
    return "-";
  }
  if (raw === BigInt(0)) return "$0.00";
  const priceScaled = Math.round(price * 10 ** USD_PRICE_SCALE);
  if (!Number.isFinite(priceScaled) || priceScaled <= 0) return "-";
  const p = BigInt(priceScaled);
  let denom: bigint;
  try {
    denom = BigInt(10) ** BigInt(decimals);
  } catch {
    return "-";
  }
  const scaledUsd = (raw * p) / denom;
  const centDivisor = BigInt(10) ** BigInt(USD_PRICE_SCALE - 2);
  const roundedCents = (scaledUsd + centDivisor / BigInt(2)) / centDivisor;
  if (roundedCents === BigInt(0)) {
    if (scaledUsd === BigInt(0)) return "$0.00";
    const usdTiny = Number(scaledUsd) / 10 ** USD_PRICE_SCALE;
    if (!Number.isFinite(usdTiny) || usdTiny <= 0) return "< $0.01";
    return usdTiny.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 8,
    });
  }
  const usdNumber = Number(roundedCents) / 100;
  if (!Number.isFinite(usdNumber)) return "-";
  return usdNumber.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: usdNumber >= 1 && usdNumber < 1_000_000 ? 2 : 4,
  });
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstAddress(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) return item.trim();
    }
  }
  return null;
}

export type ParsedProfile = {
  identity: string | null;
  displayName: string | null;
  address: string | null;
  avatar: string | null;
};

export function parseProfile(payload: unknown): ParsedProfile {
  const root = asRecord(payload);
  const profile = asRecord(root?.profile) ?? root;
  return {
    identity: firstString(profile?.identity, root?.identity),
    displayName: firstString(
      profile?.displayName,
      profile?.name,
      root?.displayName,
      root?.name,
    ),
    address: firstAddress(profile?.address) ?? firstAddress(root?.address),
    avatar: firstString(
      profile?.avatar,
      profile?.avatarUrl,
      root?.avatar,
      root?.avatarUrl,
    ),
  };
}
