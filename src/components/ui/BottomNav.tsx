'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useEffect, useState } from 'react'

// ── Liquid Glass через SVG feTurbulence + feDisplacementMap ──────────────
// Реализация без внешних зависимостей, работает на React 18
// Эффект: преломление краёв, хроматическая аберрация, упругость на касание

const FILTER_ID = 'liquid-glass-filter'

function LiquidGlassSVG() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter id={FILTER_ID} x="-20%" y="-20%" width="140%" height="140%"
          colorInterpolationFilters="sRGB">
          {/* Базовое смещение — имитирует преломление стекла */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015 0.015"
            numOctaves="2"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          {/* Хроматическая аберрация — красный канал */}
          <feColorMatrix
            in="displaced"
            type="matrix"
            values="1 0 0 0 0.008
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0.6 0"
            result="red-ch"
          />
          {/* Синий канал */}
          <feColorMatrix
            in="displaced"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 -0.008
                    0 0 0 0.6 0"
            result="blue-ch"
          />
          {/* Merge каналов */}
          <feMerge>
            <feMergeNode in="red-ch"/>
            <feMergeNode in="displaced"/>
            <feMergeNode in="blue-ch"/>
          </feMerge>
        </filter>

        {/* Highlight streak — блик на верхней грани */}
        <linearGradient id="glass-highlight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="white" stopOpacity="0"/>
          <stop offset="30%"  stopColor="white" stopOpacity="0.85"/>
          <stop offset="50%"  stopColor="white" stopOpacity="1"/>
          <stop offset="70%"  stopColor="white" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>

        {/* Нижнее отражение */}
        <linearGradient id="glass-reflection" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="white" stopOpacity="0"/>
          <stop offset="50%"  stopColor="white" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Иконки ────────────────────────────────────────────────────────────────

const ITEMS = [
  {
    href: '/feed',
    label: 'Лента',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={on ? '#1976D2' : 'rgba(80,80,100,0.75)'}
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
        fill={on ? '#1976D2' : 'none'}
        stroke={on ? '#1976D2' : 'rgba(80,80,100,0.75)'}
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
        stroke={on ? '#1976D2' : 'rgba(80,80,100,0.75)'}
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
        stroke={on ? '#1976D2' : 'rgba(80,80,100,0.75)'}
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
        stroke={on ? '#1976D2' : 'rgba(80,80,100,0.75)'}
        strokeWidth={on ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

// ── Главный компонент ─────────────────────────────────────────────────────

export default function BottomNav() {
  const path = usePathname()
  const pillRef = useRef<HTMLDivElement>(null)
  const [pressed, setPressed] = useState(false)

  // Упругая реакция на касание — liquid squish
  function handleTouchStart() {
    setPressed(true)
    setTimeout(() => setPressed(false), 350)
  }

  return (
    <>
      {/* SVG фильтры — один раз в DOM */}
      <LiquidGlassSVG />

      <div
        ref={pillRef}
        onTouchStart={handleTouchStart}
        style={{
          position: 'fixed',
          bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: `translateX(-50%) scale(${pressed ? 0.96 : 1})`,
          zIndex: 50,
          // Liquid Glass материал
          background: 'linear-gradient(160deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.68) 100%)',
          backdropFilter: 'blur(28px) saturate(190%) brightness(1.06)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%) brightness(1.06)',
          borderRadius: 9999,
          // SVG displacement filter — преломление краёв
          filter: `url(#${FILTER_ID})`,
          // Многослойные границы — имитация грани стекла
          border: '1px solid rgba(255,255,255,0.80)',
          outline: '1px solid rgba(0,0,0,0.05)',
          outlineOffset: -1,
          // Тени — глубина
          boxShadow: `
            0 2px 8px  rgba(0,0,0,0.07),
            0 8px 32px rgba(0,0,0,0.09),
            0 1px 0   rgba(255,255,255,0.95) inset,
            0 -1px 0  rgba(0,0,0,0.03) inset
          `,
          display: 'flex',
          alignItems: 'center',
          padding: '5px 6px',
          gap: 0,
          overflow: 'visible',
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease',
          maxWidth: 'calc(100vw - 28px)',
          // Блик — верхняя грань
          position: 'fixed' as const,
        }}
      >
        {/* Верхний блик (::before через span) */}
        <span style={{
          position: 'absolute', top: 0, left: '8%', right: '8%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9) 30%, white 50%, rgba(255,255,255,0.9) 70%, transparent)',
          borderRadius: 9999, pointerEvents: 'none', zIndex: 2,
        }} />

        {/* Нижнее отражение */}
        <span style={{
          position: 'absolute', bottom: 0, left: '18%', right: '18%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35) 50%, transparent)',
          borderRadius: 9999, pointerEvents: 'none', zIndex: 2,
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
                // Активный элемент — внутренняя жидкостная таблетка
                background: on
                  ? 'linear-gradient(160deg, rgba(30,111,235,0.18) 0%, rgba(30,111,235,0.10) 100%)'
                  : 'transparent',
                boxShadow: on
                  ? '0 1px 3px rgba(30,111,235,0.12), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(30,111,235,0.07)'
                  : 'none',
                transition: 'background 0.22s ease, box-shadow 0.22s ease, transform 0.15s var(--spring-bounce)',
                WebkitTapHighlightColor: 'transparent',
                cursor: 'pointer',
                position: 'relative',
                zIndex: 3,
              }}
            >
              {item.icon(on)}
              <span style={{
                fontSize: 9.5,
                fontWeight: on ? 700 : 500,
                color: on ? '#1565C0' : 'rgba(70,70,90,0.8)',
                letterSpacing: '0.01em',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                marginTop: 1,
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
