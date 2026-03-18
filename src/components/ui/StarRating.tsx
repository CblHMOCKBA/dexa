'use client'

type Props = {
  value: number        // 0–5, может быть дробным для отображения
  size?: number
  interactive?: boolean
  onChange?: (v: number) => void
}

export default function StarRating({ value, size = 16, interactive, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i}
          width={size} height={size} viewBox="0 0 24 24"
          fill={i <= Math.round(value) ? '#F0B90B' : 'none'}
          stroke={i <= Math.round(value) ? '#F0B90B' : '#CDD0D8'}
          strokeWidth="1.5"
          style={{ cursor: interactive ? 'pointer' : 'default', flexShrink: 0 }}
          onClick={() => interactive && onChange?.(i)}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </div>
  )
}
