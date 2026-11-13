import { Network } from "web3bio-profile-kit/types";
import { NETWORK_DATA } from "web3bio-profile-kit/utils";

const EVM_NETWORKS = {
  eth: Network.ethereum,
  base: Network.base,
  bsc: Network.bsc,
  arb: Network.arbitrum,
  op: Network.optimism,
  lens: Network.lens,
  polygon: Network.polygon,
  avalanche: Network.avalanche,
  gnosis: Network.gnosis,
  mantle: Network.mantle,
  world: Network.world,
  plasma: Network.plasma,
  unichain: Network.unichain,
  scroll: Network.scroll,
  linea: Network.linea,
  zksync: Network.zksync_era,
  zora: Network.zora,
  nova: Network.arbitrum_nova,
  xlayer: Network.xLayer,
  apechain: Network.apechain,
  flow: Network.flow,
  fantom: Network.fantom,
  conflux: Network.conflux,
} as const;

export type SupportedChain = keyof typeof EVM_NETWORKS;

const COINGECKO_PLATFORM: Record<SupportedChain, string> = {
  eth: "ethereum",
  base: "base",
  bsc: "binance-smart-chain",
  arb: "arbitrum-one",
  op: "optimistic-ethereum",
  lens: "lens",
  polygon: "polygon-pos",
  avalanche: "avalanche",
  gnosis: "xdai",
  mantle: "mantle",
  world: "world-chain",
  plasma: "plasma",
  unichain: "unichain",
  scroll: "scroll",
  linea: "linea",
  zksync: "zksync",
  zora: "zora",
  nova: "arbitrum-nova",
  xlayer: "x-layer",
  apechain: "apechain",
  flow: "flow-evm",
  fantom: "fantom",
  conflux: "conflux",
};

const NATIVE_LOGO: Partial<Record<SupportedChain, string>> = {
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  base: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  arb: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  op: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  bsc: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  lens: "https://coin-images.coingecko.com/coins/images/30663/small/gho-token-logo.png",
  world: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
};

const NATIVE_NETWORKS = {
  bitcoin: Network.bitcoin,
  doge: Network.doge,
  tron: Network.tron,
  aptos: Network.aptos,
  sui: Network.sui,
  starknet: Network.starknet,
  ton: Network.ton,
  near: Network.near,
  arweave: Network.arweave,
  solana: Network.solana,
} as const;

export type NativeChain = keyof typeof NATIVE_NETWORKS;

export function isNativeChain(chain: string): chain is NativeChain {
  return Object.hasOwn(NATIVE_NETWORKS, chain);
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function isBase58Id(value: string, byteLength: number) {
  if (value.length < byteLength || value.length > Math.ceil(byteLength * 1.366)) return false;
  let number = BigInt(0);
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return false;
    number = number * BigInt(58) + BigInt(digit);
  }
  const leadingZeros = value.match(/^1*/)?.[0].length ?? 0;
  return leadingZeros + (number ? Math.ceil(number.toString(16).length / 2) : 0) === byteLength;
}

export function isValidTransactionId(chain: string, value: string) {
  switch (chain) {
    case "solana": return isBase58Id(value, 64);
    case "near":
    case "sui": return isBase58Id(value, 32);
    case "arweave": return /^[A-Za-z0-9_-]{43}$/.test(value);
    case "ton": return /^(?:[\da-f]{64}|[A-Za-z0-9_-]{43})$/i.test(value);
    case "starknet": return /^0x[\da-f]{1,64}$/i.test(value);
    case "bitcoin":
    case "doge":
    case "tron": return /^(?:0x)?[\da-f]{64}$/i.test(value);
    default: return isValidTxHash(value);
  }
}

export function normalizeTransactionId(chain: string, value: string) {
  switch (chain) {
    case "solana":
    case "near":
    case "sui":
    case "arweave": return value;
    case "ton": return value.length === 64 ? value.toLowerCase() : value;
    case "starknet": return `0x${BigInt(value.toLowerCase()).toString(16)}`;
    case "bitcoin":
    case "doge":
    case "tron": return value.toLowerCase().replace(/^0x/, "");
    default: return value.toLowerCase();
  }
}

const RECEIPT_NETWORKS = new Map<string, Network>(
  Object.entries({ ...EVM_NETWORKS, ...NATIVE_NETWORKS }),
);
export const SUPPORTED_CHAINS = [...RECEIPT_NETWORKS.keys()];
export const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

const CHAIN_ALIASES = new Map([
  ["sol", "solana"],
  ["btc", "bitcoin"],
  ["dogecoin", "doge"],
]);

export function normalizeChain(chain?: string | null) {
  const key = chain?.toLowerCase().trim() ?? "eth";
  return CHAIN_ALIASES.get(key) ?? key;
}

export function getReceiptNetwork(chain: string) {
  const network = RECEIPT_NETWORKS.get(chain);
  return network && NETWORK_DATA[network];
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
  const key = normalizeChain(chain);
  const prefix = getReceiptNetwork(key)?.scanPrefixTx;
  return prefix ? `${prefix}${encodeURIComponent(normalizeTransactionId(key, hash))}` : undefined;
}

export function getNativeSymbol(chain: string) {
  return getReceiptNetwork(normalizeChain(chain))?.nativeSymbol ?? "ETH";
}

export function getNativeLogoUrl(chain: string) {
  const key = normalizeChain(chain) as SupportedChain;
  return NATIVE_LOGO[key] ?? (getNativeSymbol(key) === "ETH" ? NATIVE_LOGO.eth ?? null : null);
}

export function normalizeAddress(value?: string) {
  return (value ?? "").toLowerCase();
}

export function isValidTxHash(value: string) {
  return TX_HASH_REGEX.test(value);
}
