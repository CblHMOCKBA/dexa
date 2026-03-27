'use client'

import { useState, useEffect, useRef } from 'react'
import type { OrderStatus } from '@/types'

type Props = {
  createdAt: string
  timerMinutes: number
  orderStatus: OrderStatus
  onExpire?: () => void
}

export default function OrderTimer({ createdAt, timerMinutes, orderStatus, onExpire }: Props) {
  const [secsLeft, setSecsLeft] = useState<number>(0)
  const [mounted, setMounted]   = useState(false)
  const expiredRef = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    expiredRef.current = false
    const deadline = new Date(createdAt).getTime() + timerMinutes * 60 * 1000

    function tick() {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setSecsLeft(left)

      // Авто-отмена ТОЛЬКО если ордер всё ещё pending
      if (left === 0 && !expiredRef.current && orderStatus === 'pending') {
        expiredRef.current = true
        onExpire?.()
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [createdAt, timerMinutes, orderStatus, onExpire])

  // Не показываем таймер если ордер уже не pending
  if (!mounted || orderStatus !== 'pending') return null

  const pct   = secsLeft / (timerMinutes * 60)
  const mins  = Math.floor(secsLeft / 60)
  const secs  = secsLeft % 60
  const label = `${mins}:${String(secs).padStart(2, '0')}`
  const color   = pct > 0.5 ? '#00B173' : pct > 0.2 ? '#F5A623' : '#E8251F'
  const bgColor = pct > 0.5 ? '#E6F9F3' : pct > 0.2 ? '#FFF4E0' : '#FFEBEA'

  if (secsLeft === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F2F3F5', borderRadius: 8, padding: '4px 10px' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
        </svg>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#9498AB', fontWeight: 600 }}>
          Время истекло
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: bgColor, borderRadius: 8, padding: '4px 10px', transition: 'background 0.5s' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
      </svg>
      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color, minWidth: 38 }}>
        {label}
      </span>
      <div style={{ width: 48, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: color, borderRadius: 2,
          width: `${pct * 100}%`,
          transition: 'width 1s linear, background 0.5s',
        }}/>
      </div>
    </div>
  )
}
