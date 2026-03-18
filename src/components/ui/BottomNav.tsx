'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  {
    href: '/feed',
    label: 'Лента',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/chat',
    label: 'Чаты',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24"
        fill={on ? '#1E6FEB' : 'none'}
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    href: '/warehouse',
    label: 'Склад',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/>
        <path d="M10 12h4"/>
      </svg>
    ),
  },
  {
    href: '/counterparties',
    label: 'Контакты',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Профиль',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

// Маршруты где нижняя навигация не нужна
const HIDDEN_PATHS = ['/chat/', '/rooms/']

export default function BottomNav() {
  const path = usePathname()

  // Скрываем в открытых диалогах и комнатах
  const isHidden = HIDDEN_PATHS.some(p => path.startsWith(p))
  if (isHidden) return null

  return (
    <nav style={{
      position: 'fixed',
      bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 50,
      pointerEvents: 'none',
      pointerEvents: 'auto',
      // Pill shape
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 6px',
      gap: 2,
      borderRadius: 9999,
      // Glass material
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      // Borders — glass edge simulation
      border: '1px solid rgba(255,255,255,0.75)',
      outline: '1px solid rgba(0,0,0,0.05)',
      outlineOffset: -1,
      // Depth
      boxShadow: `
        0 2px 8px rgba(0,0,0,0.06),
        0 8px 28px rgba(0,0,0,0.09),
        inset 0 1px 0 rgba(255,255,255,0.9),
        inset 0 -1px 0 rgba(0,0,0,0.03)
      `,
      maxWidth: 'calc(100vw - 28px)',
      // Smooth entry
      animation: 'pop-in 0.3s var(--spring-bounce) both',
    }}>
      {/* Top highlight streak */}
      <span style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 40%, white 50%, rgba(255,255,255,0.95) 60%, transparent)',
        borderRadius: 9999, pointerEvents: 'none',
      }} />

      {ITEMS.map(item => {
        const on = path.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '7px 14px',
              borderRadius: 9999,
              minWidth: 54,
              // Active state — inner bubble
              background: on
                ? 'linear-gradient(160deg, rgba(30,111,235,0.16) 0%, rgba(30,111,235,0.09) 100%)'
                : 'transparent',
              boxShadow: on
                ? 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(30,111,235,0.10)'
                : 'none',
              transition: 'background 0.2s ease, box-shadow 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {item.icon(on)}
            <span style={{
              fontSize: 10,
              fontWeight: on ? 700 : 500,
              color: on ? '#1E6FEB' : '#9498AB',
              letterSpacing: '0.01em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
