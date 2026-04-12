export default function WarehouseLoading() {
  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div className="skeleton" style={{ width: 70, height: 22 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
          </div>
        </div>
        {/* Search */}
        <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 14, marginTop: 12 }} />
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div className="skeleton" style={{ flex: 1, height: 56, borderRadius: 12 }} />
          <div className="skeleton" style={{ flex: 1, height: 56, borderRadius: 12 }} />
          <div className="skeleton" style={{ flex: 1, height: 56, borderRadius: 12 }} />
        </div>
      </div>

      {/* Warehouse items */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card" style={{ padding: 14, display: 'flex', gap: 12 }}>
            <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton" style={{ width: '65%', height: 15 }} />
              <div className="skeleton" style={{ width: '35%', height: 13 }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 6 }} />
                <div className="skeleton" style={{ width: 50, height: 22, borderRadius: 6 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
