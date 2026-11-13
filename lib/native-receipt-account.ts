import { Buffer } from "node:buffer";
import { getExplorerTxUrl } from "@/lib/chain";
import {
  checkId, endpoint, fee, integer, isoTime, list, missing, movement, obj, present, read, rpc, str, units,
  type NativeResult,
} from "@/lib/native-receipt-source";

export async function readNearReceipt(hash: string): Promise<NativeResult> {
  const data = await read(endpoint("near", "https://tx.main.fastnear.com/v0/transactions"), {
    tx_hashes: [hash],
  });
  const row = list(data.transactions)[0];
  if (!row) missing();
  const tx = obj(row.transaction);
  checkId(tx.hash, hash, true);
  const execution = obj(row.execution_outcome);
  const receipts = list(row.receipts);
  const outcomes = [obj(execution.outcome), ...receipts.map(r => obj(obj(r.execution_outcome).outcome))];
  const failed = outcomes.some(o => Object.hasOwn(obj(o.status), "Failure"));
  const receiptId = str(obj(outcomes[0].status).SuccessReceiptId);
  const receipt = receipts.find(r => obj(r.execution_outcome).id === receiptId);
  const directSuccess = Object.hasOwn(obj(obj(obj(receipt?.execution_outcome).outcome).status), "SuccessValue");
  const timestamp = Number(execution.block_timestamp);
  const from = str(tx.signer_id);
  const to = str(tx.receiver_id);
  const actions = list(tx.actions);
  const totalFee = outcomes.reduce((total, o) => total + (integer(o.tokens_burnt) ?? BigInt(0)), BigInt(0));
  return {
    status: failed ? "failed" : directSuccess ? "success" : "pending_or_unknown",
    finalized: false,
    block: str(execution.block_height),
    timestamp: timestamp > 0 ? String(Math.floor(timestamp / 1e9)) : undefined,
    fee: receipts.length ? fee(totalFee.toString(), 24, "NEAR") : undefined, from, to,
    method: str(obj(actions[0]?.FunctionCall).method_name),
    movements: directSuccess && !failed
      ? actions.map(a => movement(from, to, units(obj(a.Transfer).deposit, 24), "NEAR")).filter(present) : [],
  };
}

export async function readSuiReceipt(hash: string): Promise<NativeResult> {
  const query = `query ($digest: String!) {
    transaction(digest: $digest) {
      digest sender { address }
      gasInput { gasSponsor { address } }
      kind {
        __typename
        ... on ProgrammableTransaction {
          inputs(first: 50) { nodes { ... on MoveValue { json } } }
          commands(first: 50) {
            pageInfo { hasNextPage }
            nodes {
              ... on MoveCallCommand {
                function { fullyQualifiedName }
                arguments { __typename ... on Input { ix } }
              }
            }
          }
        }
      }
      effects {
        status timestamp checkpoint { sequenceNumber }
        gasEffects { gasSummary { computationCost storageCost storageRebate } }
        balanceChanges(first: 50) { pageInfo { hasNextPage } nodes { owner { address } amount coinType { repr } } }
      }
    }
  }`;
  const result = await read(endpoint("sui", "https://graphql.mainnet.sui.io/graphql"), {
    query, variables: { digest: hash },
  });
  if (result.errors) throw new Error("Sui GraphQL rejected the request.");
  const tx = obj(obj(result.data).transaction);
  if (!tx.digest) missing();
  checkId(tx.digest, hash, true);
  const effects = obj(tx.effects);
  const block = str(obj(effects.checkpoint).sequenceNumber);
  const status = effects.status === "SUCCESS" ? "success" : effects.status === "FAILURE" ? "failed" : "pending_or_unknown";
  const gas = obj(obj(effects.gasEffects).gasSummary);
  const computation = integer(gas.computationCost);
  const storage = integer(gas.storageCost);
  const rebate = integer(gas.storageRebate);
  const gasTotal = computation !== undefined && storage !== undefined && rebate !== undefined ? computation + storage - rebate : undefined;
  const balances = obj(effects.balanceChanges);
  const entries = status === "success" ? list(balances.nodes).flatMap(row => {
    const coin = str(obj(row.coinType).repr);
    const raw = integer(row.amount);
    const address = str(obj(row.owner).address);
    if (!coin || raw === undefined || raw === BigInt(0) || !address) return [];
    const native = /^0x0*2::sui::SUI$/.test(coin);
    return [{
      label: "Balance change", address,
      value: native ? `${raw < BigInt(0) ? "-" : "+"}${units((raw < BigInt(0) ? -raw : raw).toString(), 9)} SUI`
        : `${raw} base units · ${coin}`,
    }];
  }) : [];
  const kind = obj(tx.kind);
  const inputs = list(obj(kind.inputs).nodes);
  const commands = obj(kind.commands);
  const gasOwner = str(obj(obj(tx.gasInput).gasSponsor).address);
  // For a direct split of the gas coin, the gas owner is the source and the
  // typed Move arguments provide the exact amount and recipient.
  const movements = status === "success" && !obj(commands.pageInfo).hasNextPage
    ? list(commands.nodes).map(command => {
        const name = str(obj(command.function).fullyQualifiedName);
        const [coin, amount, recipient] = list(command.arguments);
        if (!name || !/^0x0*2::pay::split_and_transfer$/.test(name) ||
            coin?.__typename !== "GasCoin" || amount?.__typename !== "Input" ||
            recipient?.__typename !== "Input" || typeof amount.ix !== "number" ||
            typeof recipient.ix !== "number") return;
        const to = str(inputs[recipient.ix]?.json);
        const value = integer(inputs[amount.ix]?.json);
        if (!to || !/^0x[\da-f]{64}$/i.test(to) || value === undefined || value <= BigInt(0)) return;
        return movement(gasOwner, to, units(value.toString(), 9), "SUI");
      }).filter(present)
    : [];
  return {
    status, block, finalized: Boolean(block) && !obj(balances.pageInfo).hasNextPage && !obj(commands.pageInfo).hasNextPage,
    from: str(obj(tx.sender).address), timestamp: isoTime(effects.timestamp),
    fee: gasTotal === undefined ? undefined : fee(gasTotal.toString(), 9, "SUI"),
    method: kind.__typename && kind.__typename !== "ProgrammableTransaction"
      ? str(kind.__typename)
      : "Transaction",
    movements, entries,
  };
}

const STARK_TOKENS: Record<string, string> = {
  "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7": "ETH",
  "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d": "STRK",
};
const STARK_TRANSFER = BigInt("0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9");

export async function readStarknetReceipt(hash: string): Promise<NativeResult> {
  const url = endpoint("starknet");
  const [tx, receipt] = await Promise.all([
    rpc(url, "starknet_getTransactionByHash", [hash]),
    rpc(url, "starknet_getTransactionReceipt", [hash]),
  ]);
  if (!receipt.transaction_hash) missing();
  checkId(receipt.transaction_hash, hash);
  const blockHash = str(receipt.block_hash);
  const block = blockHash ? await rpc(url, "starknet_getBlockWithTxHashes", [{ block_hash: blockHash }]) : {};
  const from = str(tx.sender_address ?? tx.contract_address);
  const gas = obj(receipt.actual_fee);
  const gasToken = gas.unit === "FRI" ? "STRK" : "ETH";
  const status = receipt.execution_status === "SUCCEEDED" ? "success"
    : receipt.execution_status === "REVERTED" ? "failed" : "pending_or_unknown";
  const movements = status === "success" ? list(receipt.events).map(event => {
    const keys = Array.isArray(event.keys) ? event.keys : [];
    const data = Array.isArray(event.data) ? event.data : [];
    const token = integer(event.from_address);
    const symbol = token === undefined ? undefined : STARK_TOKENS[`0x${token.toString(16)}`];
    if (!symbol || integer(keys[0]) !== STARK_TRANSFER) return;
    const [source, destination, low, high] = keys.length === 3 ? [...keys.slice(1), ...data] : data;
    const lo = integer(low);
    const hi = integer(high);
    if (lo === undefined || hi === undefined) return;
    const raw = lo + (hi << BigInt(128));
    // The fee transfer is emitted as an ERC-20 event to the sequencer.
    if (integer(destination) === integer(block.sequencer_address) &&
      raw === integer(gas.amount) && symbol === gasToken) return;
    return movement(source, destination, units(raw.toString(), 18), symbol);
  }).filter(present) : [];
  return {
    status, finalized: receipt.finality_status === "ACCEPTED_ON_L1",
    block: str(receipt.block_number ?? block.block_number), timestamp: str(block.timestamp),
    from, method: str(tx.type), fee: gas.unit ? fee(gas.amount, 18, gasToken) : undefined, movements,
  };
}

export async function readTonReceipt(hash: string): Promise<NativeResult> {
  const root = endpoint("ton", "https://toncenter.com/api/v3");
  const bytes = Buffer.from(hash, hash.length === 64 ? "hex" : "base64url");
  const query = new URLSearchParams({ tx_hash: bytes.toString("base64"), limit: "50" });
  const result = await read(`${root}/actions?${query}`);
  const actions = list(result.actions);
  if (!actions.length) missing();
  const first = actions[0];
  const addresses = obj(result.address_book);
  const display = (value: unknown) => str(obj(addresses[str(value) ?? ""]).user_friendly) ?? str(value);
  const movements = actions.map(action => {
    if (action.success !== true) return;
    const d = obj(action.details);
    if (action.type === "ton_transfer") return movement(display(d.source), display(d.destination), units(d.value, 9), "TON");
    if (action.type === "jetton_transfer") {
      const jetton = str(d.asset);
      const metadata = obj(obj(result.metadata)[jetton ?? ""]);
      const token = list(metadata.token_info).find(info => info.type === "jetton_masters");
      const decimals = Number(obj(token?.extra).decimals);
      if (token?.symbol && Number.isInteger(decimals) && decimals >= 0 && decimals <= 80) {
        return movement(display(d.sender), display(d.receiver), units(d.amount, decimals), String(token.symbol));
      }
    }
  }).filter(present);
  const finalized = actions.every(a => a.finality === "finalized");
  const status = !finalized ? "pending_or_unknown"
    : actions.some(a => a.success === false) ? "failed" : "success";
  const firstDetails = obj(first.details);
  return {
    status, finalized: finalized && !result.next_cursor, block: str(first.trace_mc_seqno_end),
    timestamp: str(first.start_utime), method: str(first.type),
    from: display(firstDetails.source ?? firstDetails.sender), to: display(firstDetails.destination ?? firstDetails.receiver), movements,
    explorerUrl: getExplorerTxUrl("ton", bytes.toString("hex")),
  };
}

export async function readArweaveReceipt(hash: string): Promise<NativeResult> {
  const root = endpoint("arweave", "https://arweave.net");
  const [tx, status] = await Promise.all([read(`${root}/tx/${hash}`), read(`${root}/tx/${hash}/status`)]);
  if (!tx.id) missing();
  checkId(tx.id, hash, true);
  const owner = str(tx.owner);
  const from = owner ? Buffer.from(await crypto.subtle.digest("SHA-256", Uint8Array.from(Buffer.from(owner, "base64url")))).toString("base64url") : undefined;
  const blockHash = str(status.block_indep_hash);
  const block = blockHash ? await read(`${root}/block/hash/${blockHash}`) : {};
  const target = str(tx.target);
  const confirmed = Number(status.number_of_confirmations) > 0;
  const move = confirmed && integer(tx.quantity) ? movement(from, target, units(tx.quantity, 12), "AR") : undefined;
  return {
    from, to: target, status: confirmed ? "success" : "pending_or_unknown",
    finalized: Number(status.number_of_confirmations) >= 20,
    block: str(status.block_height), timestamp: str(block.timestamp), fee: fee(tx.reward, 12, "AR"),
    method: integer(tx.data_size) ? "Data upload" : "Transaction", movements: move ? [move] : [],
  };
}
