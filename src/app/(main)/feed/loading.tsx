export default function FeedLoading() {
  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="skeleton" style={{ width: 80, height: 24 }} />
          <div className="skeleton" style={{ width: 110, height: 32, borderRadius: 20 }} />
        </div>
        {/* Search bar */}
        <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 14 }} />
        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div className="skeleton" style={{ width: 80, height: 34, borderRadius: 20 }} />
          <div className="skeleton" style={{ width: 80, height: 34, borderRadius: 20 }} />
          <div className="skeleton" style={{ width: 80, height: 34, borderRadius: 20 }} />
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 10, overflowX: 'hidden' }}>
        <div className="skeleton" style={{ width: 140, height: 80, borderRadius: 16, flexShrink: 0 }} />
        <div className="skeleton" style={{ width: 140, height: 80, borderRadius: 16, flexShrink: 0 }} />
      </div>

      {/* Listing cards */}
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 4 }} />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ padding: 14, display: 'flex', gap: 12 }}>
            <div className="skeleton" style={{ width: 80, height: 80, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ width: '70%', height: 16 }} />
              <div className="skeleton" style={{ width: '40%', height: 14 }} />
              <div className="skeleton" style={{ width: '50%', height: 20 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
