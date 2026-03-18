'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const VALID_INVITE_CODES = ['DEXA2024', 'GORBUSHKA', 'DEALER001']

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep]             = useState<'invite' | 'register'>('invite')
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName]             = useState('')
  const [shopName, setShopName]     = useState('')
  const [location, setLocation]     = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  function checkInvite(e: React.FormEvent) {
    e.preventDefault()
    if (VALID_INVITE_CODES.includes(inviteCode.toUpperCase().trim())) {
      setStep('register')
      setError(null)
    } else {
      setError('Неверный invite-код')
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, shop_name: shopName, location },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // FIX: явный тип чтобы TypeScript не выводил never
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const profileUpdate: { name: string; shop_name: string | null; location: string | null } = {
        name,
        shop_name: shopName || null,
        location:  location || null,
      }
      await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id)
    }

    router.push('/feed')
    router.refresh()
  }

  if (step === 'invite') {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', color: '#1A1C21' }}>
            <span style={{ color: '#F0B90B' }}>D</span>EXA
          </h1>
          <p style={{ color: '#9498AB', marginTop: 6, fontSize: 14 }}>Закрытая платформа для дилеров</p>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Invite-код</h2>
          <p style={{ fontSize: 14, color: '#9498AB', marginBottom: 20 }}>
            Доступ только по приглашению
          </p>
          <form onSubmit={checkInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="DEXA2024"
              className="input"
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', fontSize: 18, textAlign: 'center' }}
              autoFocus
            />
            {error && <p style={{ color: '#E8251F', fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn-primary">Продолжить</button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#9498AB' }}>
            Уже есть аккаунт?{' '}
            <Link href="/login" style={{ color: '#1E6FEB', fontWeight: 600, textDecoration: 'none' }}>
              Войти
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', color: '#1A1C21' }}>
          <span style={{ color: '#F0B90B' }}>D</span>EXA
        </h1>
        <p style={{ color: '#9498AB', marginTop: 6, fontSize: 14 }}>Регистрация</p>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Имя *
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Михаил Дроздов" required className="input" autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Точка / магазин
            </label>
            <input value={shopName} onChange={e => setShopName(e.target.value)}
              placeholder="Горбушка B-12" className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Локация
            </label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Горбушка" className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Email *
            </label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="dealer@gmail.com" type="email" required className="input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Пароль *
            </label>
            <input value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Минимум 6 символов" type="password" required minLength={6} className="input" />
          </div>

          {error && <p style={{ color: '#E8251F', fontSize: 13 }}>{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#9498AB' }}>
          Уже есть аккаунт?{' '}
          <Link href="/login" style={{ color: '#1E6FEB', fontWeight: 600, textDecoration: 'none' }}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
