export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh', background: '#F2F3F5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Лого */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontFamily: 'var(--font-unbounded)',
            fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em',
          }}>
            <span style={{ color: '#F0B90B' }}>D</span>
            <span style={{ color: '#1A1C21' }}>EXA</span>
          </div>
          <p style={{ color: '#9498AB', fontSize: 13, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            B2B торговая платформа
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
