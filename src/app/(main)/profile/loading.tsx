export default function ProfileLoading() {
  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="page-header pt-safe">
        <div className="skeleton" style={{ width: 120, height: 22 }} />
      </div>

      {/* Avatar + info */}
      <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="skeleton-round" style={{ width: 80, height: 80 }} />
        <div className="skeleton" style={{ width: 150, height: 20 }} />
        <div className="skeleton" style={{ width: 100, height: 14 }} />
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="skeleton" style={{ width: 40, height: 22, margin: '0 auto' }} />
            <div className="skeleton" style={{ width: 60, height: 12, marginTop: 4 }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="skeleton" style={{ width: 40, height: 22, margin: '0 auto' }} />
            <div className="skeleton" style={{ width: 60, height: 12, marginTop: 4 }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="skeleton" style={{ width: 40, height: 22, margin: '0 auto' }} />
            <div className="skeleton" style={{ width: 60, height: 12, marginTop: 4 }} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 10 }}>
        <div className="skeleton" style={{ flex: 1, height: 44, borderRadius: 12 }} />
        <div className="skeleton" style={{ flex: 1, height: 44, borderRadius: 12 }} />
      </div>

      {/* Listings */}
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ width: 110, height: 14 }} />
        {[0, 1, 2].map(i => (
          <div key={i} className="card" style={{ padding: 14, display: 'flex', gap: 12 }}>
            <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton" style={{ width: '60%', height: 15 }} />
              <div className="skeleton" style={{ width: '40%', height: 20 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
