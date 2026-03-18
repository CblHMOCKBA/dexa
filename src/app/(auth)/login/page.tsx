'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
    <div className="card p-6 animate-slide-up">
      <h2 className="text-lg font-semibold mb-6">Войти в Dexa</h2>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="dealer@gorbushka.ru"
            required
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="input"
          />
        </div>

        {error && (
          <p className="text-accent text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-6">
        Нет аккаунта?{' '}
        <Link href="/register" className="text-white hover:text-accent transition-colors">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  )
}
