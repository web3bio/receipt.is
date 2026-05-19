import { NextRequest } from "next/server";
import {
  getChainId,
  isValidTxHash,
  normalizeChain,
  SUPPORTED_CHAINS,
} from "@/lib/chain";
import { receiptErrorMessage, receiptErrorStatus } from "@/lib/tx-errors";
import { buildTxReceipt } from "@/lib/tx-receipt";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params;
    const chain = normalizeChain(request.nextUrl.searchParams.get("chain"));
    const chainId = getChainId(chain);
    const apiKey = process.env.ETHERSCAN_API_KEY;

    if (!isValidTxHash(hash)) {
      return Response.json(
        { error: "Invalid tx hash. Expected 0x-prefixed 64-byte hash." },
        { status: 400 },
      );
    }

    if (!chainId) {
      return Response.json(
        {
          error: `Unsupported chain '${chain}'. Supported: ${SUPPORTED_CHAINS.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    if (!apiKey) {
      return Response.json(
        { error: "Missing ETHERSCAN_API_KEY in environment variables." },
        { status: 500 },
      );
    }

    const payload = await buildTxReceipt(chain, hash, apiKey);
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      { error: receiptErrorMessage(error) },
      { status: receiptErrorStatus(error) },
    );
  }
}
