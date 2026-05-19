export const CHAIN_TO_ID = {
  eth: "1",
  base: "8453",
  bsc: "56",
  arb: "42161",
  op: "10",
} as const;

export type SupportedChain = keyof typeof CHAIN_TO_ID;

const CHAIN_NAMES: Record<SupportedChain, string> = {
  eth: "Ethereum",
  base: "Base",
  bsc: "BNB Chain",
  arb: "Arbitrum",
  op: "Optimism",
};

const COINGECKO_PLATFORM: Record<SupportedChain, string> = {
  eth: "ethereum",
  base: "base",
  bsc: "binance-smart-chain",
  arb: "arbitrum-one",
  op: "optimistic-ethereum",
};

const EXPLORER_TX: Record<SupportedChain, string> = {
  eth: "https://etherscan.io/tx/",
  base: "https://basescan.org/tx/",
  bsc: "https://bscscan.com/tx/",
  arb: "https://arbiscan.io/tx/",
  op: "https://optimistic.etherscan.io/tx/",
};

const NATIVE_SYMBOL: Record<SupportedChain, string> = {
  eth: "ETH",
  base: "ETH",
  arb: "ETH",
  op: "ETH",
  bsc: "BNB",
};

const NATIVE_LOGO: Record<SupportedChain, string> = {
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  base: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  arb: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  op: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  bsc: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
};

export const SUPPORTED_CHAINS = Object.keys(CHAIN_TO_ID) as SupportedChain[];
export const SUPPORTED_CHAIN_SET = new Set<string>(SUPPORTED_CHAINS);
export const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export function normalizeChain(chain?: string | null) {
  return chain?.toLowerCase().trim() ?? "eth";
}

export function getChainDisplayName(chain?: string | null) {
  const k = normalizeChain(chain) as SupportedChain;
  return CHAIN_NAMES[k] ?? k;
}

export function getChainId(chain: string) {
  return CHAIN_TO_ID[chain as SupportedChain];
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
