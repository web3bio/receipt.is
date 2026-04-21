export default function Home() {
  return (
    <main className="receipt-page">
      <div className="receipt-page-wrap">
        <section className="receipt-shell">
          <article className="receipt-card receipt-card--intro">
            <h1 className="receipt-intro-title">Web3.bio receipt</h1>
            <p className="receipt-intro-text">
              在浏览器中打开{" "}
              <code className="receipt-intro-code">/[chain]/[交易哈希]</code>
              ，例如{" "}
              <code className="receipt-intro-code">
                /eth/0xabc…64位十六进制
              </code>
              。
            </p>
            <p className="receipt-intro-text receipt-intro-muted">
              chain：eth、base、bsc、arb、op
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
