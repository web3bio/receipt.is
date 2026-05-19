import { Platform } from "web3bio-profile-kit/types";
import { getPlatform } from "web3bio-profile-kit/utils";

const ICON_BASE = "https://web3.bio";

const LABEL_PLATFORM: Partial<Record<string, Platform>> = {
  Uniswap: Platform.uniswap,
  "Uniswap V2": Platform.uniswap,
  "Uniswap V3": Platform.uniswap,
  "Uniswap V4": Platform.uniswap,
};

function platformIconUrl(icon?: string): string | null {
  if (!icon?.trim()) return null;
  if (icon.startsWith("http")) return icon;
  return `${ICON_BASE}/${icon.replace(/^\//, "")}`;
}

export function resolveDexDisplay(label: string | null | undefined): {
  name: string | null;
  icon: string | null;
} {
  const raw = label?.trim();
  if (!raw) return { name: null, icon: null };

  const platformKey = LABEL_PLATFORM[raw];
  if (!platformKey) return { name: raw, icon: null };

  const meta = getPlatform(platformKey);
  const version = raw.match(/\b(V[234])\b/i)?.[1]?.toUpperCase();
  const name = version ? `${meta.label} ${version}` : meta.label;
  return { name, icon: platformIconUrl(meta.icon) };
}
