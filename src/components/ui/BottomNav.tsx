'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'
import dynamic from 'next/dynamic'

// Lazy load — SSR не поддерживает WebGL эффекты
const LiquidGlass = dynamic(() => import('liquid-glass-react'), { ssr: false })

const ITEMS = [
  {
    href: '/feed',
    label: 'Лента',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : 'rgba(255,255,255,0.75)'}
        strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/chat',
    label: 'Чаты',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24"
        fill={on ? '#1E6FEB' : 'none'}
        stroke={on ? '#1E6FEB' : 'rgba(255,255,255,0.75)'}
        strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    href: '/warehouse',
    label: 'Склад',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : 'rgba(255,255,255,0.75)'}
        strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/>
        <path d="M10 12h4"/>
      </svg>
    ),
  },
  {
    href: '/counterparties',
    label: 'Контакты',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : 'rgba(255,255,255,0.75)'}
        strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1E6FEB' : 'rgba(255,255,255,0.75)'}
        strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const path = usePathname()
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}
    >
      <LiquidGlass
        mouseContainer={containerRef}
        displacementScale={40}
        blurAmount={0.08}
        saturation={160}
        aberrationIntensity={1.5}
        elasticity={0.25}
        cornerRadius={999}
        padding="6px 8px"
        overLight={true}
        style={{ display: 'block' }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
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
                  gap: 2,
                  padding: '6px 16px',
                  borderRadius: 999,
                  minWidth: 56,
                  background: on ? 'rgba(30, 111, 235, 0.15)' : 'transparent',
                  transition: 'background 0.2s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ position: 'relative', display: 'flex' }}>
                  {item.icon(on)}
                </div>
                <span style={{
                  fontSize: 9.5,
                  fontWeight: on ? 700 : 500,
                  color: on ? '#1E6FEB' : 'rgba(255,255,255,0.75)',
                  letterSpacing: '0.01em',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </LiquidGlass>
    </div>
  )
}
