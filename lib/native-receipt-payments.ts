import { Buffer } from "node:buffer";
import {
  checkId, endpoint, fee, integer, list, missing, movement, obj, present, read, str, units,
  type NativeResult,
} from "@/lib/native-receipt-source";

const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TRON_USDT = "a614f803b6fd780986a42c78ec9c7f77e6ded13c";

function tronHex(value: unknown) {
  const address = str(value)?.toLowerCase().replace(/^0x/, "");
  if (!address) return undefined;
  if (/^[\da-f]{40}$/.test(address)) return `41${address}`;
  return /^41[\da-f]{40}$/.test(address) ? address : undefined;
}

async function tronAddress(value: unknown) {
  const address = tronHex(value);
  if (!address) return undefined;
  const bytes = Uint8Array.from(Buffer.from(address, "hex"));
  const first = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = new Uint8Array(await crypto.subtle.digest("SHA-256", first)).slice(0, 4);
  let number = BigInt(`0x${address}${Buffer.from(checksum).toString("hex")}`);
  let encoded = "";
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  while (number) {
    encoded = alphabet[Number(number % BigInt(58))] + encoded;
    number /= BigInt(58);
  }
  return encoded;
}

export async function readTronReceipt(hash: string): Promise<NativeResult> {
  const root = endpoint("tron", "https://api.trongrid.io");
  const [tx, info] = await Promise.all([
    read(`${root}/wallet/gettransactionbyid`, { value: hash }),
    read(`${root}/walletsolidity/gettransactioninfobyid`, { value: hash }),
  ]);
  if (!tx.txID) missing();
  checkId(tx.txID, hash);
  if (info.id) checkId(info.id, hash);
  const contract = list(obj(tx.raw_data).contract)[0] ?? {};
  const value = obj(obj(contract.parameter).value);
  const [from, to] = await Promise.all([
    tronAddress(value.owner_address),
    tronAddress(value.to_address ?? value.contract_address),
  ]);
  const status = !info.id ? "pending_or_unknown"
    : info.result === "FAILED" || list(tx.ret)[0]?.contractRet !== "SUCCESS" ? "failed" : "success";
  const moves = [];
  if (status === "success" && contract.type === "TransferContract") {
    moves.push(movement(from, to, units(value.amount, 6), "TRX"));
  }
  if (status === "success") {
    const transfers = list(info.log).filter((log) => {
      const topics = log.topics;
      return Array.isArray(topics) && topics.length === 3 && topics[0] === TRANSFER_TOPIC &&
        tronHex(log.address) === `41${TRON_USDT}`;
    }).slice(0, 100);
    moves.push(...await Promise.all(transfers.map(async (log) => {
      const topics = log.topics as string[];
      const [source, destination] = await Promise.all([
        tronAddress(topics[1].slice(-40)), tronAddress(topics[2].slice(-40)),
      ]);
      const data = str(log.data);
      return movement(source, destination, data ? units(`0x${data}`, 6) : undefined, "USDT");
    })));
  }
  return {
    status, finalized: Boolean(info.id), from, to, movements: moves.filter(present),
    block: str(info.blockNumber),
    timestamp: info.blockTimeStamp ? String(Math.floor(Number(info.blockTimeStamp) / 1000)) : undefined,
    fee: fee(info.fee ?? (info.id ? 0 : undefined), 6, "TRX"),
    method: str(contract.type),
  };
}

export async function readXrplReceipt(hash: string): Promise<NativeResult> {
  const data = await read(endpoint("xrpl", "https://s1.ripple.com:51234"), {
    method: "tx", params: [{ transaction: hash.toUpperCase(), binary: false, api_version: 2 }],
  });
  const result = obj(data.result);
  if (result.error === "txnNotFound") missing();
  if (result.error) throw new Error("XRP Ledger RPC rejected the request.");
  const tx = obj(result.tx_json ?? result);
  checkId(result.hash ?? tx.hash, hash);
  const meta = obj(result.meta);
  const finalized = result.validated === true;
  const status = !finalized ? "pending_or_unknown" : meta.TransactionResult === "tesSUCCESS" ? "success" : "failed";
  const raw = meta.delivered_amount;
  const issued = obj(raw);
  const coin = str(issued.currency);
  const issuer = str(issued.issuer);
  const symbol = coin ? (issuer ? `${coin} (${issuer})` : coin) : "XRP";
  const amount = coin ? str(issued.value) : units(raw, 6);
  const transfer = status === "success" && tx.TransactionType === "Payment"
    ? movement(tx.Account, tx.Destination, amount, symbol) : undefined;
  const date = integer(tx.date ?? result.date);
  return {
    status, finalized, block: str(result.ledger_index), from: str(tx.Account), to: str(tx.Destination),
    timestamp: date !== undefined ? String(date + BigInt(946684800)) : undefined,
    fee: fee(tx.Fee, 6, "XRP"), method: str(tx.TransactionType),
    movements: transfer ? [transfer] : [],
  };
}

export async function readAptosReceipt(hash: string): Promise<NativeResult> {
  const root = endpoint("aptos", "https://api.mainnet.aptoslabs.com/v1");
  const tx = await read(`${root}/transactions/by_hash/${hash}`);
  if (!tx.hash) missing();
  checkId(tx.hash, hash);
  const status = tx.type === "pending_transaction" ? "pending_or_unknown" : tx.success === true ? "success" : tx.success === false ? "failed" : "pending_or_unknown";
  const payload = obj(tx.payload);
  const args = Array.isArray(payload.arguments) ? payload.arguments : [];
  const fn = str(payload.function);
  const simpleApt = fn === "0x1::aptos_account::transfer" ||
    ((fn === "0x1::coin::transfer" || fn === "0x1::aptos_account::transfer_coins") &&
      Array.isArray(payload.type_arguments) && payload.type_arguments[0] === "0x1::aptos_coin::AptosCoin");
  const move = simpleApt && status === "success" ? movement(tx.sender, args[0], units(args[1], 8), "APT") : undefined;
  const gas = integer(tx.gas_used);
  const gasPrice = integer(tx.gas_unit_price);
  const time = integer(tx.timestamp);
  return {
    status, finalized: status !== "pending_or_unknown", block: str(tx.version), from: str(tx.sender),
    to: simpleApt ? str(args[0]) : undefined, method: fn?.split("::").at(-1),
    timestamp: time !== undefined ? String(time / BigInt(1_000_000)) : undefined,
    fee: gas !== undefined && gasPrice !== undefined ? fee(String(gas * gasPrice), 8, "APT") : undefined,
    movements: move ? [move] : [],
  };
}
