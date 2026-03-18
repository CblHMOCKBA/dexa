export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A0A0F',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      paddingTop: 'calc(24px + env(safe-area-inset-top))',
      paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Сетка */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(30,111,235,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30,111,235,0.05) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }}/>

      {/* Свечение снизу */}
      <div style={{
        position: 'absolute', bottom: -120, left: '50%',
        transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse at center, rgba(240,185,11,0.1) 0%, transparent 70%)',
        zIndex: 0, pointerEvents: 'none',
      }}/>

      {/* Свечение сверху слева */}
      <div style={{
        position: 'absolute', top: -80, left: -80,
        width: 400, height: 400,
        background: 'radial-gradient(ellipse at center, rgba(30,111,235,0.07) 0%, transparent 70%)',
        zIndex: 0, pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
        {children}
      </div>
    </div>
  )
}
