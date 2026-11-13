import {
  checkId, endpoint, fee, isoTime, list, missing, obj, read, str, units,
  type NativeResult,
} from "@/lib/native-receipt-source";

export async function readUtxoReceipt(
  chain: "bitcoin" | "litecoin" | "dogecoin",
  hash: string,
): Promise<NativeResult> {
  const bitcoin = chain === "bitcoin";
  const symbol = bitcoin ? "BTC" : chain === "litecoin" ? "LTC" : "DOGE";
  const root = endpoint(chain, bitcoin ? "https://blockstream.info/api"
    : `https://api.blockcypher.com/v1/${symbol.toLowerCase()}/main`);
  const tx = await read(`${root}/${bitcoin ? "tx" : "txs"}/${hash}`);
  if (!Object.keys(tx).length) missing();
  checkId(tx.txid ?? tx.hash, hash);
  const status = obj(tx.status);
  const confirmations = Number(tx.confirmations ?? 0);
  const confirmed = bitcoin ? status.confirmed === true : confirmations > 0;
  const height = Number(status.block_height);
  const tipResult = bitcoin && confirmed ? await read(`${root}/blocks/tip/height`).catch(() => null) : null;
  const tip = Number(tipResult?.value);
  const inputs = bitcoin ? list(tx.vin) : list(tx.inputs);
  const outputs = bitcoin ? list(tx.vout) : list(tx.outputs);
  return {
    status: confirmed ? "success" : "pending_or_unknown",
    finalized: bitcoin ? Number.isInteger(height) && tip - height >= 5 : confirmations >= 6,
    block: confirmed ? str(status.block_height ?? tx.block_height) : undefined,
    timestamp: bitcoin ? str(status.block_time) : isoTime(tx.confirmed),
    fee: fee(tx.fee ?? tx.fees, 8, symbol),
    method: "Transaction",
    entries: [
      ...inputs.map((input) => {
        const prev = obj(input.prevout);
        const coinbase = input.is_coinbase === true || input.coinbase === true;
        const address = str(prev.scriptpubkey_address) ?? str((input.addresses as unknown[] | undefined)?.[0]);
        return { label: coinbase ? "Coinbase input" : "Input", address,
          value: fee(prev.value ?? input.output_value, 8, symbol) };
      }),
      ...outputs.map((output) => ({
        label: "Output",
        address: str(output.scriptpubkey_address) ?? str((output.addresses as unknown[] | undefined)?.[0]),
        value: fee(output.value, 8, symbol) ?? units(output.value, 8),
      })),
    ],
  };
}
