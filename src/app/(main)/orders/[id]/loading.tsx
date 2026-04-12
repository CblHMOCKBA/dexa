export default function OrderDetailLoading() {
  return (
    <div className="pb-nav" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: 70, height: 17 }} />
          <div className="skeleton" style={{ width: 90, height: 11, marginTop: 4 }} />
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Main card */}
        <div className="card" style={{ padding: 16 }}>
          {/* Product */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div className="skeleton" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '70%', height: 16, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: '40%', height: 22 }} />
            </div>
          </div>
          {/* Status badge */}
          <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 8, marginBottom: 16 }} />
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                <div className="skeleton-round" style={{ width: 12, height: 12, flexShrink: 0 }} />
                {i < 3 && <div className="skeleton" style={{ flex: 1, height: 3, margin: '0 3px' }} />}
              </div>
            ))}
          </div>
          {/* Partner */}
          <div className="skeleton" style={{ width: '100%', height: 58, borderRadius: 12 }} />
        </div>

        {/* Counter offer card */}
        <div className="card" style={{ padding: 16 }}>
          <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: '100%', height: 48, borderRadius: 12 }} />
        </div>

        {/* Actions card */}
        <div className="card" style={{ padding: 16 }}>
          <div className="skeleton" style={{ width: 80, height: 14, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: '100%', height: 48, borderRadius: 12, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  )
}
