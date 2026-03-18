// FIX: комната занимает 100dvh — BottomNav перекрывал инпут
// Этот layout переопределяет (main)/layout.tsx для rooms/[id]
export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 430, margin: '0 auto' }}>
      {children}
    </div>
  )
}
