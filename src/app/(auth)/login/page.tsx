'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const UTP = [
  'Складской учёт',
  'B2B торговля',
  'Серийный учёт',
  'Сделки с торгом',
  'Накладные за 1 клик',
  'Аналитика продаж',
  'Сканер штрихкода',
  'Контрагенты и долги',
]

const FEATURES = [
  { icon: '📦', text: 'Склад с серийниками и маржой' },
  { icon: '📷', text: 'Сканер штрихкода — автозаполнение' },
  { icon: '🤝', text: 'P2P сделки как на бирже' },
  { icon: '📄', text: 'Накладные PDF одной кнопкой' },
  { icon: '💬', text: 'Чат и торг прямо в сделке' },
  { icon: '📊', text: 'Аналитика и учёт контрагентов' },
]

function TypewriterText() {
  const [utpIndex, setUtpIndex]     = useState(0)
  const [displayed, setDisplayed]   = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused]     = useState(false)

  useEffect(() => {
    const current = UTP[utpIndex]

    if (isPaused) {
      const t = setTimeout(() => { setIsPaused(false); setIsDeleting(true) }, 1800)
      return () => clearTimeout(t)
    }

    if (isDeleting) {
      if (displayed.length === 0) {
        setIsDeleting(false)
        setUtpIndex(i => (i + 1) % UTP.length)
        return
      }
      const t = setTimeout(() => setDisplayed(d => d.slice(0, -1)), 38)
      return () => clearTimeout(t)
    }

    if (displayed.length === current.length) {
      setIsPaused(true)
      return
    }

    const t = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 75)
    return () => clearTimeout(t)
  }, [displayed, isDeleting, isPaused, utpIndex])

  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 26,
      fontWeight: 700,
      color: '#F0B90B',
      letterSpacing: '-0.01em',
      display: 'inline-block',
      minHeight: 38,
    }}>
      {displayed}
      <span style={{
        display: 'inline-block',
        width: 2, height: '0.9em',
        background: '#F0B90B',
        marginLeft: 3,
        verticalAlign: 'middle',
        animation: 'blink 1s step-end infinite',
      }}/>
    </span>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Неверный email или пароль')
      setLoading(false)
      return
    }
    router.push('/feed')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Логотип + typewriter */}
      <div style={{ marginBottom: 28, animation: 'fade-in-down 0.6s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 40, fontWeight: 900,
            letterSpacing: '-0.03em', color: '#fff',
          }}>
            <span style={{ color: '#F0B90B' }}>D</span>EXA
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#F0B90B',
            border: '1px solid rgba(240,185,11,0.35)',
            borderRadius: 5, padding: '2px 7px',
            letterSpacing: '0.1em', fontFamily: 'monospace',
          }}>
            BETA
          </span>
        </div>

        <div style={{ minHeight: 44, marginBottom: 8 }}>
          <TypewriterText />
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
          Операционная платформа для B2B дилеров электроники
        </p>
      </div>

      {/* Список фич */}
      {!showForm && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 7,
          marginBottom: 24,
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 11,
              animation: `fade-in-up 0.5s ease ${0.2 + i * 0.06}s both`,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
                {f.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Кнопки / форма */}
      {!showForm ? (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'fade-in-up 0.6s ease 0.7s both',
        }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', padding: '15px',
              borderRadius: 14, border: 'none',
              background: '#F0B90B', color: '#0A0A0F',
              fontSize: 15, fontWeight: 800,
              cursor: 'pointer',
              transition: 'transform 0.14s, box-shadow 0.14s',
              boxShadow: '0 4px 20px rgba(240,185,11,0.25)',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget
              b.style.transform = 'scale(1.02)'
              b.style.boxShadow = '0 6px 28px rgba(240,185,11,0.35)'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget
              b.style.transform = 'scale(1)'
              b.style.boxShadow = '0 4px 20px rgba(240,185,11,0.25)'
            }}
          >
            Войти в платформу
          </button>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <button style={{
              width: '100%', padding: '13px',
              borderRadius: 14,
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.12)',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
            }}
            >
              Нет аккаунта? Зарегистрироваться
            </button>
          </Link>
        </div>
      ) : (
        <div style={{ animation: 'fade-in-up 0.25s ease both' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                color: 'rgba(255,255,255,0.38)', marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>Email</label>
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="dealer@gmail.com" type="email" required autoFocus
                style={{
                  width: '100%', padding: '13px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, color: '#fff',
                  fontSize: 15, outline: 'none',
                  transition: 'border-color 0.15s', fontFamily: 'system-ui',
                }}
                onFocus={e => { e.target.style.borderColor = '#F0B90B' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
              />
            </div>

            {/* Пароль */}
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                color: 'rgba(255,255,255,0.38)', marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>Пароль</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  required
                  style={{
                    width: '100%', padding: '13px 48px 13px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, color: '#fff',
                    fontSize: 15, outline: 'none',
                    transition: 'border-color 0.15s', fontFamily: 'system-ui',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#F0B90B' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 4, display: 'flex', alignItems: 'center',
                    color: showPassword ? '#F0B90B' : 'rgba(255,255,255,0.3)',
                    transition: 'color 0.15s',
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(232,37,31,0.12)',
                border: '1px solid rgba(232,37,31,0.25)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <p style={{ color: '#FF6B6B', fontSize: 13 }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              borderRadius: 12, border: 'none',
              background: loading ? 'rgba(240,185,11,0.45)' : '#F0B90B',
              color: '#0A0A0F', fontSize: 15, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}>
              {loading ? 'Входим...' : 'Войти'}
            </button>

            <button type="button" onClick={() => setShowForm(false)} style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)', fontSize: 13,
              cursor: 'pointer', padding: '4px',
            }}>
              ← Назад
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>
            Нет аккаунта?{' '}
            <Link href="/register" style={{ color: '#F0B90B', fontWeight: 600, textDecoration: 'none' }}>
              Зарегистрироваться
            </Link>
          </p>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
