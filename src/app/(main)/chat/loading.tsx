export default function ChatLoading() {
  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div className="skeleton" style={{ width: 60, height: 22 }} />
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 12 }}>
          <div className="skeleton" style={{ width: '50%', height: 36, borderRadius: '10px 0 0 10px' }} />
          <div className="skeleton" style={{ width: '50%', height: 36, borderRadius: '0 10px 10px 0' }} />
        </div>
      </div>

      {/* Chat items */}
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton" style={{ width: 120, height: 15 }} />
                <div className="skeleton" style={{ width: 40, height: 12 }} />
              </div>
              <div className="skeleton" style={{ width: '80%', height: 13 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
