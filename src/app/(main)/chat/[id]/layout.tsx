// Чат занимает весь экран — BottomNav не нужен
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 430, margin: '0 auto' }}>
      {children}
    </div>
  )
}
