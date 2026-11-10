import { SUPPORTED_CHAINS } from "@/lib/chain";

export default function Home() {
  return (
    <main className="receipt-page">
      <article className="receipt-card receipt-card--intro">
        <h1 className="receipt-intro-title">Web3 Receipt</h1>
        <p className="receipt-intro-text">
          Open <code className="receipt-intro-code">/[chain]/[txHash]</code> in
          your browser, e.g.{" "}
          <code className="receipt-intro-code">/eth/0xabc...64-hex-chars</code>.
        </p>
        <p className="receipt-intro-text receipt-intro-muted">
          chain: {SUPPORTED_CHAINS.join(", ")}
        </p>
      </article>
    </main>
  );
}
