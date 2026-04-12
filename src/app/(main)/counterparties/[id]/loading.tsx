export default function CounterpartyDetailLoading() {
  return (
    <div className="pb-nav" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 120, height: 17, marginLeft: 8 }} />
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Contact card */}
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="skeleton-round" style={{ width: 56, height: 56 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: 140, height: 18, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 90, height: 13, marginBottom: 4 }} />
            <div className="skeleton" style={{ width: 110, height: 13 }} />
          </div>
        </div>

        {/* Balance card */}
        <div className="card" style={{ padding: 16 }}>
          <div className="skeleton" style={{ width: 80, height: 14, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: 120, height: 32, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 12 }} />
        </div>

        {/* Orders history */}
        <div className="card" style={{ padding: 16 }}>
          <div className="skeleton" style={{ width: 130, height: 14, marginBottom: 12 }} />
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="skeleton" style={{ width: 150, height: 14, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 80, height: 11 }} />
              </div>
              <div className="skeleton" style={{ width: 70, height: 18 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
