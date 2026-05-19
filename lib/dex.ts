import { normalizeChain, normalizeAddress } from "@/lib/chain";
import type { JsonRecord } from "@/lib/types";

const ROUTERS: Record<string, string> = {
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap",
  "0x66a9893cc07d91d95644aedd05d03f95e1dba8af": "Uniswap",
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3",
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2",
  "0x2626664c2603336e57b271c5c0b26f421741e481": "Uniswap",
  "0x6ff5693b99212da76ad316178a184ab56d299b43": "Uniswap",
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24": "Uniswap V2",
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch",
  "0x1111111254fb6c44bac0bed2854e76f90643097d": "1inch",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x",
  "0x0000000000001ff3684f28c67538d4d072c22734": "0x",
  "0xdef171fe48cf0115b1d80b88dc8eab59176fee57": "ParaSwap",
  "0x6131b5fae19ea4f9d964eac0408e4408b66337b5": "KyberSwap",
  "0x9008d19f58aabd9ed0d60971565aa8510560ab41": "CoW Swap",
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": "PancakeSwap",
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": "PancakeSwap",
  "0x1b81d678ffb9c0263b24a97847620c99d213eb14": "PancakeSwap",
  "0x1a0a18ac4becddbd6389559687d1a73d8927e416": "PancakeSwap",
  "0x65b382653f7c31bc0af67f188122035461ec9c76": "PancakeSwap",
  "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap",
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": "Aerodrome",
  "0xa062ae8a9c5e11aaa026fc2670b0d65ccc8b2858": "Velodrome",
  "0x6352a56caadc4f1e25cd6c75970fa768a3304e64": "OpenOcean",
  "0xcf5540fffcdc3d510b18bfca6d2b9987b0772559": "Odos",
  "0x3a23f9434544085267e62c4cc9a83c528420f44c": "Balancer V2",
  "0xba12222222228d8ba445958a75a0704d566bf2c8": "Balancer V2",
};

const CORE: Record<string, string> = {
  "0x000000000004444c5dc75cb358380d2e3de08a90": "Uniswap V4",
  "0x1f98431c8ad98523631ae4a59f267346ea31f984": "Uniswap V3",
  "0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865": "PancakeSwap V3",
  "0x0d3648bd0f6ba53434c290b4d3f45eed4e323bea": "Uniswap V2",
  "0x5c69bee701ef814a2b6a3edd4b1652cb9cc616aa": "Uniswap V2",
};

type SwapHit = { brand?: string; version: "V2" | "V3" | "V4" };

const SWAP_TOPICS: Record<string, SwapHit> = {
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822": {
    version: "V2",
  },
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67": {
    version: "V3",
  },
  "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f": {
    version: "V4",
  },
  "0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83": {
    brand: "PancakeSwap",
    version: "V3",
  },
};

function pickLabel(labels: Set<string>) {
  if (labels.size === 1) return [...labels][0] ?? null;
  if (labels.size > 1) {
    return (
      [...labels].find((l) => l.includes("V4")) ??
      [...labels].find((l) => l.includes("V3")) ??
      [...labels][0] ??
      null
    );
  }
  return null;
}

function findBestSwapHit(receipt: JsonRecord | null | undefined): SwapHit | null {
  const logs = receipt?.logs;
  if (!Array.isArray(logs)) return null;
  let best: SwapHit | null = null;
  for (const raw of logs) {
    const topics = (raw as { topics?: unknown[] }).topics;
    if (!Array.isArray(topics) || topics.length === 0) continue;
    const hit = SWAP_TOPICS[String(topics[0]).toLowerCase()];
    if (!hit) continue;
    if (hit.brand) return hit;
    if (!best) best = hit;
    else if (best.version === "V2" && hit.version !== "V2") best = hit;
  }
  return best;
}

function detectFromLogs(receipt: JsonRecord | null | undefined, chain: string) {
  const best = findBestSwapHit(receipt);
  if (!best) return null;
  if (best.brand) return `${best.brand} ${best.version}`;
  return `${normalizeChain(chain) === "bsc" ? "PancakeSwap" : "Uniswap"} ${best.version}`;
}

export function receiptHasSwapLogs(receipt: JsonRecord | null | undefined) {
  return findBestSwapHit(receipt) !== null;
}

export function resolveDexPlatform(
  receipt: JsonRecord | null | undefined,
  chain: string,
  txTo?: string | null,
) {
  const to = normalizeAddress(txTo ?? undefined);
  if (to && ROUTERS[to]) return ROUTERS[to];

  const logs = receipt?.logs;
  if (Array.isArray(logs)) {
    const labels = new Set<string>();
    for (const raw of logs) {
      const addr = normalizeAddress((raw as { address?: string }).address);
      if (!addr) continue;
      if (ROUTERS[addr]) labels.add(ROUTERS[addr]);
      if (CORE[addr]) labels.add(CORE[addr]);
    }
    const picked = pickLabel(labels);
    if (picked) return picked;
  }

  return detectFromLogs(receipt, chain);
}
