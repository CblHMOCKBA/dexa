export default function ListingDetailLoading() {
  return (
    <div className="pb-nav" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 100, height: 17, marginLeft: 8 }} />
      </div>

      {/* Photo */}
      <div className="skeleton" style={{ width: '100%', height: 260, borderRadius: 0 }} />

      <div style={{ padding: '16px' }}>
        {/* Title + price */}
        <div className="skeleton" style={{ width: '80%', height: 20, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '35%', height: 28, marginBottom: 16 }} />

        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 60, height: 24, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 50, height: 24, borderRadius: 6 }} />
        </div>

        {/* Description */}
        <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '90%', height: 14, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: 20 }} />

        {/* Seller card */}
        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton-round" style={{ width: 44, height: 44 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: 120, height: 15, marginBottom: 4 }} />
            <div className="skeleton" style={{ width: 80, height: 12 }} />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div className="skeleton" style={{ flex: 1, height: 48, borderRadius: 12 }} />
          <div className="skeleton" style={{ flex: 1, height: 48, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  )
}
