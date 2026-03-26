import BackButton from '@/components/ui/BackButton'
import RoadmapClient from '@/components/profile/RoadmapClient'

export default function RoadmapPage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#0A0A0F' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0A0A0F',
      }}>
        <BackButton href="/profile" />
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Roadmap</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Product · Март 2026</p>
        </div>
      </div>
      <RoadmapClient />
    </div>
  )
}
