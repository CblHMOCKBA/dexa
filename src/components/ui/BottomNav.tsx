'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  {
    href: '/feed',
    label: 'Лента',
    icon: (on: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
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
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    href: '/warehouse',
    label: 'Склад',
    icon: (on: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
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
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
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
        stroke={on ? '#1E6FEB' : '#9498AB'} strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const path = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 50,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid #EDEEF2',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {ITEMS.map(item => {
        const on = path.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} style={{
            flex: 1, textDecoration: 'none',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, paddingTop: 10, paddingBottom: 8,
            WebkitTapHighlightColor: 'transparent',
          }}>
            {/* Активный индикатор */}
            <div style={{ position: 'relative' }}>
              {on && (
                <span style={{
                  position: 'absolute',
                  top: -4, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%',
                  background: '#1E6FEB',
                }} />
              )}
              {item.icon(on)}
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: on ? 700 : 500,
              color: on ? '#1E6FEB' : '#9498AB',
              letterSpacing: '0.01em',
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
