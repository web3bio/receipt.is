import { getChainId, type NativeChain } from "@/lib/chain";
import type { TxReceiptPayload } from "@/lib/types";
import { readArweaveReceipt, readNearReceipt, readStarknetReceipt, readSuiReceipt, readTonReceipt } from "@/lib/native-receipt-account";
import { readAptosReceipt, readTronReceipt, readXrplReceipt } from "@/lib/native-receipt-payments";
import { readUtxoReceipt } from "@/lib/native-receipt-utxo";
import { readSolanaReceipt } from "@/lib/native-receipt-solana";

const READERS = {
  bitcoin: (hash: string) => readUtxoReceipt("bitcoin", hash),
  litecoin: (hash: string) => readUtxoReceipt("litecoin", hash),
  dogecoin: (hash: string) => readUtxoReceipt("dogecoin", hash),
  tron: readTronReceipt,
  aptos: readAptosReceipt,
  xrpl: readXrplReceipt,
  sui: readSuiReceipt,
  starknet: readStarknetReceipt,
  ton: readTonReceipt,
  near: readNearReceipt,
  arweave: readArweaveReceipt,
  solana: readSolanaReceipt,
};

export async function buildNativeReceipt(chain: NativeChain, hash: string): Promise<TxReceiptPayload> {
  const result = await READERS[chain](hash);
  return {
    chain,
    chainId: getChainId(chain) ?? chain,
    hash,
    type: "transaction",
    txStatus: result.status,
    nativeDetails: {
      from: result.from,
      to: result.to,
      movements: result.movements ?? [],
      entries: result.entries,
      fee: result.fee,
      explorerUrl: result.explorerUrl,
      finalized: result.finalized === true,
    },
    functionName: result.method ?? null,
    functionSelector: null,
    contractAddress: null,
    transaction: { from: result.from, to: result.to, blockNumber: result.block },
    receipt: null,
    block: result.block || result.timestamp ? { number: result.block, timestamp: result.timestamp } : null,
    erc20Transfers: { total: 0, transfers: [] },
    tokenInfo: null,
    tokenInfoContractAddress: null,
    calledContract: null,
    ethUsd: null,
    swap: null,
    from: {},
    to: {},
  };
}
