import { checkId, endpoint, fee, list, missing, obj, read, str, type NativeResult } from "@/lib/native-receipt-source";

export async function readBitcoinReceipt(hash: string): Promise<NativeResult> {
  const root = endpoint("bitcoin", "https://blockstream.info/api");
  const tx = await read(`${root}/tx/${hash}`);
  if (!tx.txid) missing();
  checkId(tx.txid, hash);
  const status = obj(tx.status);
  const confirmed = status.confirmed === true;
  const height = Number(status.block_height);
  const tip = confirmed ? await read(`${root}/blocks/tip/height`).catch(() => null) : null;
  return {
    status: confirmed ? "success" : "pending_or_unknown",
    finalized: confirmed && Number.isInteger(height) && Number(tip?.value) - height >= 5,
    block: str(status.block_height),
    timestamp: str(status.block_time),
    fee: fee(tx.fee, 8, "BTC"),
    entries: [
      ...list(tx.vin).map(input => {
        const prev = obj(input.prevout);
        return {
          label: input.is_coinbase === true ? "Coinbase input" : "Input",
          address: str(prev.scriptpubkey_address),
          value: fee(prev.value, 8, "BTC"),
        };
      }),
      ...list(tx.vout).map(output => ({
        label: "Output",
        address: str(output.scriptpubkey_address),
        value: fee(output.value, 8, "BTC"),
      })),
    ],
  };
}

export async function readDogeReceipt(hash: string): Promise<NativeResult> {
  const root = endpoint("doge", "https://dogechain.com/api/v3");
  const data = await read(`${root}/tx/${hash}`);
  const tx = obj(obj(data.data).transaction);
  if (!tx.hash) missing();
  checkId(tx.hash, hash);
  const confirmations = Number(tx.confirmations);
  // Dogechain already returns decimal DOGE amounts.
  const amount = (value: unknown) => {
    const decimal = str(value);
    return decimal && /^\d+(?:\.\d+)?$/.test(decimal) ? `${decimal} DOGE` : undefined;
  };
  return {
    status: confirmations > 0 ? "success" : "pending_or_unknown",
    finalized: confirmations >= 6,
    block: str(tx.block_height),
    timestamp: str(tx.time),
    fee: amount(tx.fee),
    entries: [
      ...list(tx.inputs).map(input => ({
        label: input.coinbase ? "Coinbase input" : "Input",
        address: str(input.address),
        value: amount(input.value),
      })),
      ...list(tx.outputs).map(output => ({
        label: "Output",
        address: str(output.address),
        value: amount(output.value),
      })),
    ],
  };
}
