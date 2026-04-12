export default function CounterpartiesLoading() {
  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div className="skeleton" style={{ width: 100, height: 22 }} />
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
        </div>
        {/* Search */}
        <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 14, marginTop: 12 }} />
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div className="skeleton" style={{ width: 50, height: 32, borderRadius: 20 }} />
          <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 20 }} />
          <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 20 }} />
        </div>
      </div>

      {/* Contact cards */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="skeleton-round" style={{ width: 44, height: 44, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton" style={{ width: '55%', height: 15 }} />
              <div className="skeleton" style={{ width: '30%', height: 12 }} />
            </div>
            <div className="skeleton" style={{ width: 70, height: 24, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
