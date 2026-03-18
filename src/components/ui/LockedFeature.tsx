export default function LockedFeature({
  label, version = 'v1.0', children
}: { label: string; version?: string; children: React.ReactNode }) {
  return (
    <div className="locked-wrap">
      <div className="locked-content">{children}</div>
      <div className="locked-badge">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid #E0E1E6',
          borderRadius: 10, padding: '5px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="#9498AB" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#5A5E72', fontFamily: 'var(--font-mono)' }}>
            {label}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#1E6FEB',
            background: '#EBF2FF', borderRadius: 5,
            padding: '2px 6px', fontFamily: 'var(--font-mono)',
          }}>
            {version}
          </span>
        </div>
      </div>
    </div>
  )
}
