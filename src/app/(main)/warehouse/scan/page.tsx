import BackButton from '@/components/ui/BackButton'
import SerialSearch from '@/components/scanner/SerialSearch'

export default function ScanPage() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="screen-header">
        <BackButton href="/warehouse" />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21' }}>
            Поиск по S/N
          </h1>
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 1 }}>
            Полная история устройства
          </p>
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        <SerialSearch />
      </div>
    </div>
  )
}
