'use client'

type Point = { price: number; date: string }

export default function PriceChart({ data }: { data: Point[] }) {
  if (data.length < 2) {
    return (
      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: '#9498AB' }}>Недостаточно данных для графика</p>
      </div>
    )
  }

  const W = 340, H = 80, PAD = 8
  const prices = data.map(d => d.price)
  const min    = Math.min(...prices)
  const max    = Math.max(...prices)
  const range  = max - min || 1

  function x(i: number) { return PAD + (i / (data.length - 1)) * (W - PAD * 2) }
  function y(p: number) { return PAD + (1 - (p - min) / range) * (H - PAD * 2) }

  const pts  = data.map((d, i) => `${x(i)},${y(d.price)}`).join(' ')
  const area = `M ${x(0)},${H} L ${x(0)},${y(data[0].price)} ${data.map((d, i) => `L ${x(i)},${y(d.price)}`).join(' ')} L ${x(data.length - 1)},${H} Z`

  const isUp = data[data.length - 1].price >= data[0].price
  const color = isUp ? '#00B173' : '#E8251F'
  const fillId = `grad-${Math.random().toString(36).slice(2, 6)}`

  const first = data[0].price
  const last  = data[data.length - 1].price
  const pct   = Math.round(((last - first) / first) * 100)

  return (
    <div>
      {/* Мини-стат */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 10, color: '#9498AB' }}>Первая сделка</p>
          <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1A1C21' }}>
            {first.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: '#9498AB' }}>Последняя</p>
          <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1A1C21' }}>
            {last.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <p style={{ fontSize: 10, color: '#9498AB' }}>Динамика</p>
          <p style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>
            {pct > 0 ? '+' : ''}{pct}%
          </p>
        </div>
      </div>

      {/* SVG график */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Площадь под графиком */}
        <path d={area} fill={`url(#${fillId})`}/>

        {/* Линия */}
        <polyline
          points={pts}
          fill="none" stroke={color} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        />

        {/* Точки */}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.price)} r="3"
            fill="#fff" stroke={color} strokeWidth="2"/>
        ))}

        {/* Последняя точка — крупнее */}
        <circle cx={x(data.length - 1)} cy={y(last)} r="5"
          fill={color} stroke="#fff" strokeWidth="2"/>
      </svg>

      {/* Даты */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#9498AB' }}>{data[0].date}</span>
        <span style={{ fontSize: 10, color: '#9498AB' }}>{data[data.length - 1].date}</span>
      </div>
    </div>
  )
}
