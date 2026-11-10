import { Network } from "web3bio-profile-kit/types";
import { NETWORK_DATA } from "web3bio-profile-kit/utils";

const RECEIPT_NETWORKS = {
  eth: Network.ethereum,
  base: Network.base,
  bsc: Network.bsc,
  arb: Network.arbitrum,
  op: Network.optimism,
  lens: Network.lens,
} as const;

export type SupportedChain = keyof typeof RECEIPT_NETWORKS;

const COINGECKO_PLATFORM: Record<SupportedChain, string> = {
  eth: "ethereum",
  base: "base",
  bsc: "binance-smart-chain",
  arb: "arbitrum-one",
  op: "optimistic-ethereum",
  lens: "lens",
};

const EXPLORER_TX: Record<SupportedChain, string> = {
  eth: "https://etherscan.io/tx/",
  base: "https://basescan.org/tx/",
  bsc: "https://bscscan.com/tx/",
  arb: "https://arbiscan.io/tx/",
  op: "https://optimistic.etherscan.io/tx/",
  lens: "https://explorer.lens.xyz/tx/",
};

const NATIVE_SYMBOL: Record<SupportedChain, string> = {
  eth: "ETH",
  base: "ETH",
  arb: "ETH",
  op: "ETH",
  bsc: "BNB",
  lens: "GHO",
};

const NATIVE_LOGO: Record<SupportedChain, string> = {
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  base: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  arb: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  op: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  bsc: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  lens: "https://coin-images.coingecko.com/coins/images/30663/small/gho-token-logo.png",
};

export const SUPPORTED_CHAINS = Object.keys(RECEIPT_NETWORKS) as SupportedChain[];
export const SUPPORTED_CHAIN_SET = new Set<string>(SUPPORTED_CHAINS);
export const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export function normalizeChain(chain?: string | null) {
  return chain?.toLowerCase().trim() ?? "eth";
}

function getReceiptNetwork(chain: string) {
  if (!SUPPORTED_CHAIN_SET.has(chain)) return undefined;
  return NETWORK_DATA[RECEIPT_NETWORKS[chain as SupportedChain]];
}

export function getChainDisplayName(chain?: string | null) {
  const key = normalizeChain(chain);
  return getReceiptNetwork(key)?.label ?? key;
}

export function getChainId(chain: string) {
  return getReceiptNetwork(chain)?.chainId?.toString();
}

export function getCoingeckoPlatform(chain: string) {
  return COINGECKO_PLATFORM[normalizeChain(chain) as SupportedChain];
}

export function getExplorerTxUrl(chain: string, hash: string) {
  const k = normalizeChain(chain) as SupportedChain;
  return `${EXPLORER_TX[k] ?? EXPLORER_TX.eth}${hash}`;
}

export function getNativeSymbol(chain: string) {
  return NATIVE_SYMBOL[normalizeChain(chain) as SupportedChain] ?? "ETH";
}

export function getNativeLogoUrl(chain: string) {
  return NATIVE_LOGO[normalizeChain(chain) as SupportedChain] ?? NATIVE_LOGO.eth;
}

export function normalizeAddress(value?: string) {
  return (value ?? "").toLowerCase();
}

export function isValidTxHash(value: string) {
  return TX_HASH_REGEX.test(value);
}
