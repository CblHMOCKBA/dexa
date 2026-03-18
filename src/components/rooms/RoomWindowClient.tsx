'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Room, RoomMessage, RoomMember } from '@/types'
import Avatar from '@/components/ui/Avatar'

type Props = {
  room: Room
  initialMessages: RoomMessage[]
  members: RoomMember[]
  currentUserId: string
  myRole: 'owner' | 'admin' | 'member'
}

export default function RoomWindowClient({ room, initialMessages, members, currentUserId, myRole }: Props) {
  const router = useRouter()
  const [msgs, setMsgs]           = useState<RoomMessage[]>(initialMessages)
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteCode, setInviteCode]   = useState<string | null>(null)
  const [copyDone, setCopyDone]       = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const seenIds   = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [msgs])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`room-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_messages',
        filter: `room_id=eq.${room.id}`,
      }, payload => {
        const m = payload.new as RoomMessage
        if (seenIds.current.has(m.id)) return
        seenIds.current.add(m.id)
        setMsgs(prev => [...prev, m])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room.id])

  function resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
  }

  async function send() {
    const t = text.trim()
    if (!t || sending) return
    setSending(true); setText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    const supabase = createClient()
    const { data } = await supabase
      .from('room_messages')
      .insert({ room_id: room.id, sender_id: currentUserId, text: t })
      .select('id').single()
    if (data?.id) seenIds.current.add(data.id)
    setSending(false)
  }

  async function generateInvite() {
    const supabase = createClient()
    const { data } = await supabase
      .from('invite_links')
      .insert({ room_id: room.id, created_by: currentUserId })
      .select('code').single()
    if (data) setInviteCode(data.code)
  }

  async function copyInvite() {
    if (!inviteCode) return
    const url = `${window.location.origin}/join/${inviteCode}`
    await navigator.clipboard.writeText(url)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  async function kickMember(userId: string) {
    if (userId === currentUserId) return
    const supabase = createClient()
    await supabase.from('room_members')
      .delete().eq('room_id', room.id).eq('user_id', userId)
    router.refresh()
  }

  function senderName(senderId: string) {
    const m = members.find(m => m.user_id === senderId)
    return m?.profile?.name ?? 'Участник'
  }

  const isAdmin = myRole === 'owner' || myRole === 'admin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#F2F3F5' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', paddingTop: 'calc(12px + var(--sat))',
        background: '#fff', borderBottom: '1px solid #E0E1E6', flexShrink: 0,
      }}>
        <Link href="/chat">
          <div className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </div>
        </Link>

        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: '#EBF2FF', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#1249A8',
        }}>
          {room.name[0].toUpperCase()}
        </div>

        {/* FIX: убран дублирующийся style prop — был баг с двумя style на одном div */}
        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => { setShowMembers(s => !s); setShowInvite(false) }}
        >
          <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21', lineHeight: 1.2 }}>
            {room.name}
          </p>
          <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>
            {members.length} участников · нажми для списка
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { setShowInvite(s => !s); setShowMembers(false) }}
            className="btn-icon"
            style={{
              background: showInvite ? '#EBF2FF' : 'transparent',
              border: showInvite ? 'none' : '1px solid #E0E1E6',
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={showInvite ? '#1E6FEB' : '#9498AB'} strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </button>
        )}
      </div>

      {/* Список участников */}
      {showMembers && (
        <div style={{
          background: '#fff', borderBottom: '1px solid #E0E1E6',
          padding: '12px 16px', flexShrink: 0,
          maxHeight: 220, overflowY: 'auto',
          animation: 'fade-up 0.15s ease both',
        }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: '#9498AB',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)', marginBottom: 8,
          }}>
            Участники · {members.length}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={m.profile?.name ?? '?'} size="xs" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>
                    {m.profile?.name ?? 'Участник'}
                    {m.user_id === currentUserId && (
                      <span style={{ color: '#9498AB', fontWeight: 400 }}> (вы)</span>
                    )}
                  </p>
                  {m.profile?.location && (
                    <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>
                      {m.profile.location}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 5,
                  background: m.role === 'owner' ? '#FFF8E0' : m.role === 'admin' ? '#EBF2FF' : '#F2F3F5',
                  color: m.role === 'owner' ? '#7A5E00' : m.role === 'admin' ? '#1249A8' : '#9498AB',
                }}>
                  {m.role}
                </span>
                {isAdmin && m.user_id !== currentUserId && m.role !== 'owner' && (
                  <button onClick={() => kickMember(m.user_id)} style={{
                    width: 26, height: 26, borderRadius: 6, border: 'none',
                    background: '#FFEBEA', color: '#E8251F', cursor: 'pointer',
                    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite панель */}
      {showInvite && (
        <div style={{
          background: '#fff', borderBottom: '1px solid #E0E1E6',
          padding: '12px 16px', flexShrink: 0,
          animation: 'fade-up 0.15s ease both',
        }}>
          <p style={{
            fontSize: 12, fontWeight: 700, color: '#9498AB',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)', marginBottom: 10,
          }}>
            Пригласить участников
          </p>
          {!inviteCode ? (
            <button onClick={generateInvite} style={{
              width: '100%', padding: '11px', borderRadius: 12,
              background: '#EBF2FF', color: '#1249A8', border: 'none',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              Создать invite-ссылку
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                flex: 1, background: '#F2F3F5', borderRadius: 10,
                padding: '10px 12px', overflow: 'hidden',
              }}>
                <p style={{ fontSize: 11, color: '#9498AB', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                  Ссылка
                </p>
                <p style={{
                  fontSize: 12, color: '#1A1C21', fontFamily: 'var(--font-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`}
                </p>
              </div>
              <button onClick={copyInvite} style={{
                padding: '0 16px', borderRadius: 10,
                background: copyDone ? '#E6F9F3' : '#1E6FEB',
                color: copyDone ? '#006644' : '#fff',
                border: 'none', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
              }}>
                {copyDone ? '✓ Скопировано' : 'Копировать'}
              </button>
            </div>
          )}
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 8 }}>
            Код комнаты:{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1A1C21' }}>
              {room.invite_code}
            </span>
          </p>
        </div>
      )}

      {/* Сообщения */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>👋</p>
            <p style={{ color: '#9498AB', fontSize: 14 }}>
              Начало комнаты «{room.name}»
            </p>
          </div>
        )}
        {msgs.map(m => {
          const own  = m.sender_id === currentUserId
          const name = own ? 'Вы' : senderName(m.sender_id)
          return (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: own ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end', gap: 6,
            }}>
              {!own && <Avatar name={name} size="xs" />}
              <div style={{ maxWidth: '78%' }}>
                {!own && (
                  <p style={{
                    fontSize: 11, fontWeight: 700, color: '#1E6FEB',
                    marginBottom: 3, paddingLeft: 4,
                  }}>
                    {name}
                  </p>
                )}
                <div style={{
                  padding: '9px 13px',
                  borderRadius: own ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: own ? '#2AABEE' : '#fff',
                  color: own ? '#fff' : '#1A1C21',
                  fontSize: 15, lineHeight: 1.45,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.text}
                </div>
                <p style={{
                  fontSize: 10, color: '#9498AB', fontFamily: 'var(--font-mono)',
                  marginTop: 3, textAlign: own ? 'right' : 'left',
                }}>
                  {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  {m.is_edited && ' · изменено'}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Инпут */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '8px 12px',
        paddingBottom: 'calc(8px + var(--sab))',
        background: '#fff', borderTop: '1px solid #E0E1E6', flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); resize(e.target) }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder={`Сообщение в ${room.name}...`}
          rows={1}
          style={{
            flex: 1, background: '#F2F3F5', border: '1.5px solid #E0E1E6',
            borderRadius: 22, padding: '10px 16px',
            fontSize: 15, color: '#1A1C21', outline: 'none',
            resize: 'none', overflow: 'hidden',
            minHeight: 44, maxHeight: 100,
            fontFamily: 'system-ui', transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = '#2AABEE' }}
          onBlur={e => { e.target.style.borderColor = '#E0E1E6' }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: text.trim() ? '#2AABEE' : '#E0E1E6',
            border: 'none', cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s', transform: 'translateY(-1px)',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m22 2-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
