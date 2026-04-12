export default function ChatDetailLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#F2F3F5', position: 'fixed', inset: 0 }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px 10px', paddingTop: 'calc(10px + var(--sat))',
        background: 'rgba(255,255,255,0.97)', borderBottom: '1px solid #E8E9ED',
      }}>
        <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 6 }} />
        <div className="skeleton-round" style={{ width: 40, height: 40 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 4 }} />
          <div className="skeleton" style={{ width: 80, height: 12 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
        </div>
      </div>

      {/* Listing context bar */}
      <div style={{ flexShrink: 0, padding: '8px 12px', background: 'rgba(255,255,255,0.97)', borderBottom: '1px solid #E8E9ED' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: '60%', height: 13, marginBottom: 4 }} />
            <div className="skeleton" style={{ width: '30%', height: 15 }} />
          </div>
          <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 6 }} />
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div className="skeleton" style={{ width: '65%', height: 42, borderRadius: '4px 18px 18px 18px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div className="skeleton" style={{ width: '55%', height: 36, borderRadius: '18px 18px 4px 18px', background: 'rgba(42,171,238,0.15)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div className="skeleton" style={{ width: '45%', height: 36, borderRadius: '4px 18px 18px 18px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div className="skeleton" style={{ width: '70%', height: 52, borderRadius: '18px 18px 4px 18px', background: 'rgba(42,171,238,0.15)' }} />
        </div>
      </div>

      {/* Input area */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', paddingBottom: 'calc(10px + var(--sab))',
        background: 'rgba(255,255,255,0.97)', borderTop: '1px solid #E8E9ED',
      }}>
        <div className="skeleton" style={{ flex: 1, height: 44, borderRadius: 22 }} />
        <div className="skeleton-round" style={{ width: 44, height: 44 }} />
      </div>
    </div>
  )
}
