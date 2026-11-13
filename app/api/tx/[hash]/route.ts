import { NextRequest } from "next/server";
import {
  isNativeChain,
  isValidTransactionId,
  normalizeChain,
  SUPPORTED_CHAINS,
  getReceiptNetwork,
} from "@/lib/chain";
import { getPublicRpcUrl } from "@/lib/evm-rpc";
import { receiptErrorMessage, receiptErrorStatus } from "@/lib/tx-errors";
import { getCachedTxReceipt } from "@/lib/tx-receipt-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params;
    const chain = normalizeChain(request.nextUrl.searchParams.get("chain"));
    const apiKey = process.env.ETHERSCAN_API_KEY;

    if (!isValidTransactionId(chain, hash)) {
      return Response.json(
        { error: "Invalid transaction ID for this network." },
        { status: 400 },
      );
    }

    if (!getReceiptNetwork(chain)) {
      return Response.json(
        {
          error: `Unsupported chain '${chain}'. Supported: ${SUPPORTED_CHAINS.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    if (!isNativeChain(chain) && !getPublicRpcUrl(chain) && !apiKey) {
      return Response.json(
        { error: "Missing ETHERSCAN_API_KEY in environment variables." },
        { status: 500 },
      );
    }

    const payload = await getCachedTxReceipt(chain, hash, apiKey, request.headers.get("host"));
    return Response.json({ ...payload, hash });
  } catch (error) {
    return Response.json(
      { error: receiptErrorMessage(error) },
      { status: receiptErrorStatus(error) },
    );
  }
}
