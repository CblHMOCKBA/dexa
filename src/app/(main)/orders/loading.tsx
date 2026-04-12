export default function OrdersLoading() {
  return (
    <div className="pb-nav" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <div className="skeleton" style={{ width: 70, height: 22 }} />
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8 }}>
        <div className="skeleton" style={{ width: 50, height: 32, borderRadius: 20 }} />
        <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 20 }} />
        <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 20 }} />
        <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 20 }} />
      </div>

      {/* Order cards */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="skeleton" style={{ width: 100, height: 14 }} />
              <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 6 }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="skeleton" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton" style={{ width: '70%', height: 15 }} />
                <div className="skeleton" style={{ width: '40%', height: 20 }} />
                <div className="skeleton" style={{ width: '55%', height: 12 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
