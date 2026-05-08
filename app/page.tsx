export default function Home() {
  return (
    <main className="receipt-page">
      <article className="receipt-card receipt-card--intro">
        <h1 className="receipt-intro-title">Web3.bio receipt</h1>
        <p className="receipt-intro-text">
          Open <code className="receipt-intro-code">/[chain]/[txHash]</code> in
          your browser, e.g.{" "}
          <code className="receipt-intro-code">
            /eth/0xabc...64-hex-chars
          </code>
          .
        </p>
        <p className="receipt-intro-text receipt-intro-muted">
          chain: eth, base, bsc, arb, op
        </p>
      </article>
    </main>
  );
}
