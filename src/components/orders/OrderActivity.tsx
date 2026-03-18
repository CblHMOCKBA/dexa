'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrderEvent } from '@/types'

const EVENT_CONFIG: Record<string, { icon: string; color: string; bg: string; label: (p: Record<string, unknown>, isMe: boolean) => string }> = {
  created:          { icon: '📋', color: '#1E6FEB', bg: '#EBF2FF', label: (p, m) => `Ордер создан · ${Number(p.total_price).toLocaleString('ru-RU')} ₽` },
  confirmed:        { icon: '✅', color: '#00B173', bg: '#E6F9F3', label: () => 'Продавец подтвердил бронь' },
  delivery_started: { icon: '🚚', color: '#7B4FCC', bg: '#F0E8FF', label: () => 'Товар передан курьеру' },
  completed:        { icon: '🎉', color: '#00B173', bg: '#E6F9F3', label: () => 'Сделка закрыта' },
  cancelled:        { icon: '❌', color: '#E8251F', bg: '#FFEBEA', label: () => 'Ордер отменён' },
  counter_sent:     { icon: '💬', color: '#F5A623', bg: '#FFF4E0', label: (p, m) => `${m ? 'Вы' : 'Встречное'} предложили ${Number(p.price).toLocaleString('ru-RU')} ₽ (раунд ${p.round})` },
  counter_accepted: { icon: '🤝', color: '#00B173', bg: '#E6F9F3', label: (p) => `Цена ${Number(p.price).toLocaleString('ru-RU')} ₽ принята` },
  counter_rejected: { icon: '🚫', color: '#E8251F', bg: '#FFEBEA', label: () => 'Предложение отклонено' },
  approved:         { icon: '👍', color: '#1E6FEB', bg: '#EBF2FF', label: (_, m) => `${m ? 'Вы' : 'Другая сторона'} подтвердили получение` },
  timer_expired:    { icon: '⏰', color: '#9498AB', bg: '#F2F3F5', label: () => 'Время на подтверждение истекло' },
}

function timeLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) +
         ' · ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

type Props = {
  orderId: string
  currentUserId: string
  initialEvents?: OrderEvent[]
}

export default function OrderActivity({ orderId, currentUserId, initialEvents = [] }: Props) {
  const [events, setEvents] = useState<OrderEvent[]>(initialEvents)
  const [open, setOpen]     = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`order-events-${orderId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'order_events',
        filter: `order_id=eq.${orderId}`,
      }, payload => {
        setEvents(prev => [...prev, payload.new as OrderEvent])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [orderId])

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(p => !p)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px 0', marginBottom: open ? 10 : 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
          История действий
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{ position: 'relative', paddingLeft: 20 }}>
          {/* Вертикальная линия */}
          <div style={{
            position: 'absolute', left: 7, top: 8, bottom: 8,
            width: 1.5, background: '#E0E1E6', borderRadius: 1,
          }}/>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map(ev => {
              const cfg    = EVENT_CONFIG[ev.event_type] ?? EVENT_CONFIG['created']
              const isMe   = ev.actor_id === currentUserId
              const payload = (ev.payload ?? {}) as Record<string, unknown>

              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'fade-up 0.2s ease both' }}>
                  {/* Иконка-точка на линии */}
                  <div style={{
                    position: 'absolute', left: 0,
                    width: 16, height: 16, borderRadius: '50%',
                    background: cfg.bg, border: `2px solid ${cfg.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, marginTop: 2, flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 9 }}>{cfg.icon}</span>
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', lineHeight: 1.4 }}>
                      {cfg.label(payload, isMe)}
                    </p>
                    <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {timeLabel(ev.created_at)}
                      {ev.actor_id && (
                        <span style={{ marginLeft: 6, color: isMe ? '#1E6FEB' : '#9498AB' }}>
                          · {isMe ? 'Вы' : 'Партнёр'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
