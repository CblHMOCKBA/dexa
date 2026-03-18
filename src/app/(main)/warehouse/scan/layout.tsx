export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg)' }}>
      {children}
    </div>
  )
}
