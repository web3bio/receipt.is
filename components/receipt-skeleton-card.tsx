function AddressSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="receipt-address">
      <div
        className="receipt-skeleton receipt-skeleton--title"
        style={{ width: titleWidth, maxWidth: "100%" }}
      />
      <div className="receipt-address-row">
        <div className="receipt-skeleton receipt-skeleton--avatar-lg" />
        <div className="receipt-address-body">
          <p className="receipt-address-name receipt-address-name--skeleton">
            <span className="receipt-skeleton receipt-skeleton--bar-lg" />
          </p>
          <p className="receipt-address-text">
            <span className="receipt-address-skeleton-text-fill">
              <span className="receipt-skeleton receipt-skeleton--bar" />
            </span>
            <span className="receipt-skeleton receipt-skeleton--copy" />
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReceiptSkeletonCard() {
  return (
    <article className="receipt-card" aria-busy="true">
      <header className="receipt-topbar">
        <div className="receipt-skeleton receipt-skeleton--badge" />
        <div className="receipt-skeleton receipt-skeleton--share" />
      </header>

      <section className="receipt-overview">
        <div className="receipt-skeleton receipt-skeleton--price" />
        <div className="receipt-skeleton-overview">
          <div className="receipt-skeleton-overview-line">
            <div className="receipt-skeleton receipt-skeleton--mini-avatar" />
            <div className="receipt-skeleton receipt-skeleton--bar-lg" />
            <div className="receipt-skeleton receipt-skeleton--pill" />
            <div className="receipt-skeleton-amount-group">
              <div className="receipt-skeleton receipt-skeleton--token-icon" />
              <div className="receipt-skeleton receipt-skeleton--amount" />
            </div>
            <div className="receipt-skeleton receipt-skeleton--pill" />
          </div>
          <div className="receipt-skeleton-overview-line">
            <div className="receipt-skeleton receipt-skeleton--mini-avatar" />
            <div className="receipt-skeleton receipt-skeleton--bar-lg" />
            <div className="receipt-skeleton receipt-skeleton--time" />
          </div>
        </div>
        <hr className="receipt-divider" />
        <div className="receipt-skeleton receipt-skeleton--note" />
      </section>

      <section className="receipt-flow">
        <AddressSkeleton titleWidth="2rem" />
        <div className="btn btn-sm btn-action receipt-flow-arrow" aria-hidden>
          <svg
            width={18}
            height={18}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="m7 16h18m0 0-8.5-8.5m8.5 8.5-8.5 8.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </div>
        <AddressSkeleton titleWidth="1.6rem" />
      </section>

      <footer className="receipt-footer">
        <ul className="receipt-detail-list">
          <li className="receipt-detail-row">
            <div className="receipt-skeleton receipt-skeleton--detail-label" />
            <div className="receipt-skeleton receipt-skeleton--detail-value" />
          </li>
          <li className="receipt-detail-row">
            <div className="receipt-skeleton receipt-skeleton--detail-label" />
            <div className="receipt-skeleton receipt-skeleton--detail-value" />
          </li>
          <li className="receipt-detail-row">
            <div className="receipt-skeleton receipt-skeleton--detail-label" />
            <div className="receipt-skeleton receipt-skeleton--detail-value" />
          </li>
          <li className="receipt-detail-row">
            <div className="receipt-skeleton receipt-skeleton--detail-label" />
            <div className="receipt-skeleton receipt-skeleton--detail-value-long" />
          </li>
        </ul>
        <div className="receipt-skeleton receipt-skeleton--explorer" />
      </footer>
    </article>
  );
}
