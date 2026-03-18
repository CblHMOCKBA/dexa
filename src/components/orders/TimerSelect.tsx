'use client'

type Props = {
  value: number
  onChange: (mins: number) => void
}

const OPTIONS = [
  { mins: 15, label: '15 мин' },
  { mins: 30, label: '30 мин', default: true },
  { mins: 60, label: '1 час' },
]

export default function TimerSelect({ value, onChange }: Props) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Время на подтверждение
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {OPTIONS.map(opt => (
          <button key={opt.mins} type="button" onClick={() => onChange(opt.mins)}
            style={{
              flex: 1, padding: '9px 4px', borderRadius: 10,
              border: value === opt.mins ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
              background: value === opt.mins ? '#EBF2FF' : '#fff',
              color: value === opt.mins ? '#1249A8' : '#5A5E72',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.12s',
              fontFamily: 'var(--font-mono)',
            }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
