export default function NewListingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: 430,
      margin: '0 auto',
      minHeight: '100dvh',
      background: 'var(--bg)',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
    }}>
      {children}
    </div>
  )
}
