'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  {
    href: '/feed',
    label: 'Лента',
    icon: (on: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/chat',
    label: 'Чаты',
    icon: (on: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24"
        fill={on ? '#1E6FEB' : 'none'}
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    href: '/warehouse',
    label: 'Склад',
    icon: (on: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/>
        <path d="M10 12h4"/>
      </svg>
    ),
  },
  {
    href: '/counterparties',
    label: 'Контакты',
    icon: (on: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

const HIDDEN_PATHS = ['/chat/', '/rooms/', '/roadmap']

export default function BottomNav() {
  const path = usePathname()

  if (HIDDEN_PATHS.some(p => path.startsWith(p))) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 50,
      display: 'flex',
      justifyContent: 'center',
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      background: 'linear-gradient(to top, rgba(242,243,245,0.98) 60%, transparent)',
      pointerEvents: 'none',
    }}>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '8px 12px',
        borderRadius: 28,
        pointerEvents: 'all',
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border: '1px solid rgba(255, 255, 255, 0.9)',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.10),
          0 2px 8px rgba(0, 0, 0, 0.06),
          inset 0 1px 0 rgba(255, 255, 255, 0.95),
          inset 0 -1px 0 rgba(0, 0, 0, 0.04)
        `,
      }}>
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
                gap: 3,
                width: 64,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: 20,
                flexShrink: 0,
                position: 'relative',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.2s ease, box-shadow 0.2s ease',
                background: on
                  ? 'rgba(30, 111, 235, 0.10)'
                  : 'transparent',
                boxShadow: on
                  ? 'inset 0 1px 0 rgba(30,111,235,0.15), 0 1px 4px rgba(30,111,235,0.08)'
                  : 'none',
              }}
            >
              <span style={{
                display: 'flex',
                transform: on ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                {item.icon(on)}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: on ? 700 : 500,
                color: on ? '#1E6FEB' : '#9498AB',
                letterSpacing: '0.01em',
                lineHeight: 1,
                transition: 'color 0.15s',
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
