export const CHAIN_TO_ID = {
  eth: "1",
  base: "8453",
  bsc: "56",
  arb: "42161",
  op: "10",
} as const;

export type SupportedChain = keyof typeof CHAIN_TO_ID;

export const SUPPORTED_CHAINS = Object.keys(CHAIN_TO_ID) as SupportedChain[];
export const SUPPORTED_CHAIN_SET = new Set<string>(SUPPORTED_CHAINS);

export function normalizeChain(chain?: string | null) {
  return chain?.toLowerCase().trim() ?? "eth";
}

export function getChainId(chain: string) {
  return CHAIN_TO_ID[chain as SupportedChain];
}
