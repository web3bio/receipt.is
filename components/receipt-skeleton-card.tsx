import Image from "next/image";

function AddressSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="receipt-address-skeleton">
      <div
        className="receipt-skeleton receipt-address-skeleton-title"
        style={{ width: titleWidth, maxWidth: "100%" }}
      />
      <div className="receipt-address-skeleton-row">
        <div className="receipt-skeleton receipt-address-skeleton-avatar" />
        <div className="receipt-address-skeleton-body">
          <div className="receipt-skeleton receipt-skeleton-identity-bar-lg" />
          <div className="receipt-skeleton receipt-skeleton-identity-bar" />
        </div>
        <div className="receipt-skeleton receipt-address-skeleton-copy" />
      </div>
    </div>
  );
}

export default function ReceiptSkeletonCard() {
  return (
    <section className="receipt-shell">
      <article className="receipt-card" aria-busy="true">
        <header className="receipt-topbar">
          <div className="receipt-skeleton receipt-skeleton-badge" />
          <div className="receipt-skeleton receipt-skeleton-share" />
        </header>

        <section className="receipt-overview-skeleton">
          <div className="receipt-overview-skeleton-header">
            <div className="receipt-skeleton receipt-skeleton-price" />
          </div>
          <div className="receipt-overview-skeleton-flow">
            <div className="receipt-overview-skeleton-line">
              <div className="receipt-skeleton receipt-skeleton-mini-avatar" />
              <div className="receipt-skeleton receipt-skeleton-identity-bar-lg" />
              <div className="receipt-skeleton receipt-skeleton-pill" />
              <div className="receipt-overview-skeleton-amount-with-icon">
                <div className="receipt-skeleton receipt-skeleton-token-icon" />
                <div className="receipt-skeleton receipt-skeleton-amount" />
              </div>
              <div className="receipt-skeleton receipt-skeleton-pill" />
            </div>
            <div className="receipt-overview-skeleton-line">
              <div className="receipt-skeleton receipt-skeleton-mini-avatar" />
              <div className="receipt-skeleton receipt-skeleton-identity-bar-lg" />
              <div className="receipt-skeleton receipt-skeleton-time" />
            </div>
          </div>
          <hr className="receipt-divider" />
          <div className="receipt-skeleton receipt-skeleton-note" />
        </section>

        <section className="receipt-flow">
          <AddressSkeleton titleWidth="2.25rem" />
          <div className="receipt-flow-arrow" aria-hidden>
            <Image src="/icon-arrow.svg" alt="" width={18} height={18} />
          </div>
          <AddressSkeleton titleWidth="1.75rem" />
        </section>

        <footer className="receipt-footer">
          <ul className="receipt-detail-list">
            <li className="receipt-detail-row">
              <div className="receipt-skeleton receipt-skeleton-detail-label" />
              <div className="receipt-skeleton receipt-skeleton-detail-value" />
            </li>
            <li className="receipt-detail-row">
              <div className="receipt-skeleton receipt-skeleton-detail-label" />
              <div className="receipt-skeleton receipt-skeleton-detail-value" />
            </li>
            <li className="receipt-detail-row">
              <div className="receipt-skeleton receipt-skeleton-detail-label" />
              <div className="receipt-skeleton receipt-skeleton-detail-value" />
            </li>
            <li className="receipt-detail-row">
              <div className="receipt-skeleton receipt-skeleton-detail-label" />
              <div className="receipt-skeleton receipt-skeleton-detail-value-long" />
            </li>
          </ul>
          <div className="receipt-skeleton receipt-skeleton-explorer" />
        </footer>
      </article>
    </section>
  );
}
