'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// В MVP invite-коды проверяются на фронте
// В production — перенести проверку в API route
const VALID_INVITE_CODES = ['DEXA2024', 'GORBUSHKA', 'DEALER001']

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep]         = useState<'invite' | 'register'>('invite')
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName]         = useState('')
  const [shopName, setShopName] = useState('')
  const [location, setLocation] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, shop_name: shopName, location },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Обновляем профиль после создания
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ name, shop_name: shopName || null, location: location || null })
        .eq('id', user.id)
    }

    router.push('/feed')
    router.refresh()
  }

  if (step === 'invite') {
    return (
      <div className="card p-6 animate-slide-up">
        <h2 className="text-lg font-semibold mb-2">Доступ по приглашению</h2>
        <p className="text-muted text-sm mb-6">
          Dexa — закрытая платформа. Введи invite-код чтобы зарегистрироваться.
        </p>

        <form onSubmit={checkInvite} className="space-y-4">
          <input
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="Введи invite-код"
            required
            className="input text-center tracking-widest uppercase font-mono"
          />
          {error && <p className="text-accent text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            Продолжить
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-white hover:text-accent transition-colors">
            Войти
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="card p-6 animate-slide-up">
      <h2 className="text-lg font-semibold mb-6">Создать аккаунт</h2>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1.5">Имя *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Алексей"
            required
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">Название точки</label>
          <input
            type="text"
            value={shopName}
            onChange={e => setShopName(e.target.value)}
            placeholder="ТехноПоинт"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">Локация</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Горбушка · B-12"
            className="input"
          />
        </div>

        <div className="border-t border-border pt-4">
          <label className="block text-sm text-muted mb-1.5">Email *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="dealer@mail.ru"
            required
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">Пароль *</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Минимум 6 символов"
            minLength={6}
            required
            className="input"
          />
        </div>

        {error && <p className="text-accent text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  )
}
