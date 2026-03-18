'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Room } from '@/types'

type Props = {
  status: 'valid' | 'invalid' | 'expired' | 'exhausted'
  inviteCode?: string
  room?: Room
  userId?: string
  usesLeft?: number | null
}

const STATUS_CONFIG = {
  invalid:   { icon: '❌', title: 'Ссылка недействительна', desc: 'Эта invite-ссылка не существует или была отозвана.', color: '#E8251F', bg: '#FFEBEA' },
  expired:   { icon: '⏰', title: 'Срок ссылки истёк',      desc: 'Попроси создателя сгенерировать новую ссылку.',       color: '#F5A623', bg: '#FFF4E0' },
  exhausted: { icon: '🚫', title: 'Лимит исчерпан',         desc: 'По этой ссылке уже вступило максимальное кол-во людей.', color: '#9498AB', bg: '#F2F3F5' },
  valid:     { icon: '🏠', title: '',                        desc: '',                                                     color: '#1E6FEB', bg: '#EBF2FF' },
}

export default function JoinClient({ status, inviteCode, room, userId, usesLeft }: Props) {
  const router  = useRouter()
  const [joining, setJoining] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const cfg = STATUS_CONFIG[status]

  async function join() {
    if (!inviteCode || !room || !userId || joining) return
    setJoining(true); setError(null)

    const supabase = createClient()

    // 1. Вступаем в комнату
    const { error: joinErr } = await supabase
      .from('room_members')
      .insert({ room_id: room.id, user_id: userId })

    if (joinErr) {
      setError('Ошибка вступления. Попробуй ещё раз.')
      setJoining(false)
      return
    }

    // 2. FIX: правильно декрементируем uses_left и инкрементируем used_count
    if (usesLeft !== null && usesLeft !== undefined) {
      // Лимитированная ссылка — уменьшаем остаток
      await supabase
        .from('invite_links')
        .update({
          uses_left:  usesLeft - 1,
          used_count: supabase.rpc as unknown as number, // используем SQL
        })
        .eq('code', inviteCode)

      // Простой вариант без RPC
      await supabase.rpc('decrement_invite_uses', { invite_code: inviteCode })
    } else {
      // Безлимитная — только счётчик
      await supabase
        .from('invite_links')
        .update({ used_count: (0 + 1) }) // оптимистично, не критично
        .eq('code', inviteCode)
    }

    router.push(`/rooms/${room.id}`)
  }

  if (status !== 'valid') {
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 24, background: cfg.bg,
            margin: '0 auto 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 34,
          }}>
            {cfg.icon}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21', marginBottom: 8 }}>
            {cfg.title}
          </h2>
          <p style={{ color: '#9498AB', fontSize: 14, lineHeight: 1.6 }}>
            {cfg.desc}
          </p>
          <button onClick={() => router.push('/chat')} style={{
            marginTop: 24, padding: '12px 28px', borderRadius: 12,
            background: '#1E6FEB', color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>
            На главную
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24, background: '#EBF2FF',
            margin: '0 auto 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#1249A8',
          }}>
            {room?.name[0].toUpperCase()}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>
            {room?.name}
          </h2>

          {room?.description && (
            <p style={{ color: '#9498AB', fontSize: 14, marginBottom: 4 }}>
              {room.description}
            </p>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, marginBottom: 24,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#9498AB" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span style={{ fontSize: 13, color: '#9498AB' }}>
              {room?.is_private ? '🔒 Закрытая комната' : '🌐 Открытая комната'}
            </span>
          </div>

          {usesLeft !== null && usesLeft !== undefined && (
            <p style={{ fontSize: 12, color: '#9498AB', marginBottom: 16 }}>
              Осталось мест: <strong style={{ color: '#1A1C21' }}>{usesLeft}</strong>
            </p>
          )}

          {error && (
            <p style={{ color: '#E8251F', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button onClick={join} disabled={joining} style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: '#1E6FEB', color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700,
            cursor: joining ? 'not-allowed' : 'pointer',
            opacity: joining ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
            {joining ? 'Вступаем...' : 'Вступить в комнату'}
          </button>

          <button onClick={() => router.push('/chat')} style={{
            width: '100%', marginTop: 8, padding: '12px', borderRadius: 12,
            background: 'transparent', color: '#9498AB', border: 'none',
            fontSize: 14, cursor: 'pointer',
          }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
