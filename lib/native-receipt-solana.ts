import {
  checkId, endpoint, fee, list, missing, movement, obj, present, rpc, str, units,
  type NativeResult,
} from "@/lib/native-receipt-source";

const SPL_SYMBOLS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  So11111111111111111111111111111111111111112: "WSOL",
};

export async function readSolanaReceipt(signature: string): Promise<NativeResult> {
  const tx = await rpc(endpoint("solana"), "getTransaction", [
    signature, { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 1 },
  ]);
  if (!tx.transaction) missing();
  const transaction = obj(tx.transaction);
  const signatures = Array.isArray(transaction.signatures) ? transaction.signatures : [];
  checkId(signatures[0], signature, true);
  const message = obj(transaction.message);
  const accounts = list(message.accountKeys);
  const meta = obj(tx.meta);
  const tokenAccounts = new Map<string, { owner?: string; mint?: string; decimals?: number }>();
  for (const balance of [...list(meta.preTokenBalances), ...list(meta.postTokenBalances)]) {
    const account = str(accounts[Number(balance.accountIndex)]?.pubkey);
    if (!account) continue;
    tokenAccounts.set(account, {
      owner: str(balance.owner),
      mint: str(balance.mint),
      decimals: Number(obj(balance.uiTokenAmount).decimals),
    });
  }
  const status = !Object.hasOwn(meta, "err") ? "pending_or_unknown" : meta.err === null ? "success" : "failed";
  const instructions = [...list(message.instructions), ...list(meta.innerInstructions).flatMap(group => list(group.instructions))];
  const movements = status === "success" ? instructions.map(instruction => {
    const parsed = obj(instruction.parsed);
    const info = obj(parsed.info);
    if (instruction.program === "system" && (parsed.type === "transfer" || parsed.type === "transferWithSeed")) {
      return movement(info.source, info.destination, units(info.lamports, 9), "SOL");
    }
    if ((instruction.program !== "spl-token" && instruction.program !== "spl-token-2022") ||
      (parsed.type !== "transfer" && parsed.type !== "transferChecked")) return;
    const source = tokenAccounts.get(str(info.source) ?? "");
    const destination = tokenAccounts.get(str(info.destination) ?? "");
    const mint = str(info.mint) ?? source?.mint ?? destination?.mint;
    if (!mint || (source?.mint && source.mint !== mint) || (destination?.mint && destination.mint !== mint)) return;
    const amount = obj(info.tokenAmount);
    const decimals = Number(amount.decimals ?? source?.decimals ?? destination?.decimals);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 80) return;
    return movement(source?.owner ?? info.source, destination?.owner ?? info.destination,
      units(amount.amount ?? info.amount, decimals), SPL_SYMBOLS[mint] ?? mint);
  }).filter(present) : [];
  return {
    status, finalized: status !== "pending_or_unknown", block: str(tx.slot), timestamp: str(tx.blockTime),
    from: movements.length ? undefined : str(accounts[0]?.pubkey), fee: fee(meta.fee, 9, "SOL"),
    movements, method: "Transaction",
  };
}
