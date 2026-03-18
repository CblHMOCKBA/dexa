'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'

export default function CreateRoomClient() {
  const router = useRouter()
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Введи название'); return }
    setSaving(true); setError(null)

    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        name.trim(),
          description: description.trim() || null,
          is_private:  isPrivate,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.id) {
        setError(data.error ?? 'Ошибка создания. Попробуй ещё раз.')
        setSaving(false)
        return
      }
      router.push(`/rooms/${data.id}`)
    } catch {
      setError('Ошибка сети. Попробуй ещё раз.')
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* FIX: используем .screen-header + BackButton как во всех других экранах */}
      <div className="screen-header">
        <BackButton href="/chat" />
        <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', flex: 1 }}>
          Новая комната
        </h1>
      </div>

      <div style={{ flex: 1, padding: '20px 16px' }}>
        <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>

          {/* Аватар-превью */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <div style={{
              width: 76, height: 76, borderRadius: 22,
              background: name ? '#EBF2FF' : '#F2F3F5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34, fontWeight: 700,
              color: name ? '#1249A8' : '#CDD0D8',
              transition: 'all 0.2s var(--spring-smooth)',
              border: name ? '2px solid #C5D9F5' : '2px solid transparent',
            }}>
              {name ? name[0].toUpperCase() : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CDD0D8" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              )}
            </div>
          </div>

          {/* Название */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Название *
            </label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Apple · Горбушка"
              required className="input" autoFocus
            />
          </div>

          {/* Описание */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Описание
            </label>
            <input
              value={description} onChange={e => setDesc(e.target.value)}
              placeholder="Чат для дилеров Apple" className="input"
            />
          </div>

          {/* Приватность */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9498AB', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Доступ
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { val: true,  icon: '🔒', label: 'Закрытая', desc: 'Только по invite-ссылке' },
                { val: false, icon: '🌐', label: 'Открытая', desc: 'Виден в каталоге комнат' },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => setIsPrivate(opt.val)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                    background: isPrivate === opt.val ? '#EBF2FF' : '#fff',
                    border: `1.5px solid ${isPrivate === opt.val ? '#1E6FEB' : '#E0E1E6'}`,
                    borderRadius: 14, transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: isPrivate === opt.val ? '#1249A8' : '#1A1C21', marginBottom: 2 }}>
                      {opt.label}
                    </p>
                    <p style={{ fontSize: 13, color: '#9498AB' }}>{opt.desc}</p>
                  </div>
                  {/* Радио-кружок */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isPrivate === opt.val ? '#1E6FEB' : '#CDD0D8'}`,
                    background: isPrivate === opt.val ? '#1E6FEB' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {isPrivate === opt.val && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ color: '#E8251F', fontSize: 13, fontWeight: 500 }}>{error}</p>
          )}

          <button type="submit" disabled={saving || !name.trim()} className="btn-primary" style={{ marginTop: 4 }}>
            {saving ? 'Создаём...' : 'Создать комнату'}
          </button>
        </form>
      </div>
    </div>
  )
}
