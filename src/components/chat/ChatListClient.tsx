'use client'

import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import PullIndicator from '@/components/ui/PullIndicator'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Chat, Room } from '@/types'
import Avatar from '@/components/ui/Avatar'

function SkeletonChat() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'center' }}>
      <div className="skeleton-round" style={{ width: 48, height: 48, flexShrink: 0 }}/>
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '50%', height: 14, marginBottom: 6 }}/>
        <div className="skeleton" style={{ width: '75%', height: 12 }}/>
      </div>
      <div className="skeleton" style={{ width: 28, height: 12, borderRadius: 4 }}/>
    </div>
  )
}

// Время последнего сообщения — Telegram-стиль
function msgTime(d: string) {
  const date = new Date(d)
  const now  = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diff === 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Вчера'
  if (diff < 7)  return date.toLocaleDateString('ru-RU', { weekday: 'short' })
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

type Props = {
  chats: Chat[]
  rooms: Room[]
  currentUserId: string
}

export default function ChatListClient({ chats, rooms, currentUserId }: Props) {
  const { pullDistance, isRefreshing, triggered } = usePullToRefresh()
  const router = useRouter()

  async function joinRoom(roomId: string) {
    setJoiningRoom(roomId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setJoiningRoom(null); return }
    await supabase.from('room_members').insert({
      room_id: roomId, user_id: user.id, role: 'member',
      joined_at: new Date().toISOString(), invited_by: user.id,
    })
    setJoinedRooms(p => new Set([...p, roomId]))
    setJoiningRoom(null)
    router.push(`/rooms/${roomId}`)
  }

  const [tab, setTab] = useState<'personal' | 'rooms'>('personal')
  const [search, setSearch] = useState('')
  const [joiningRoom, setJoiningRoom] = useState<string | null>(null)
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set())

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats
    const q = search.toLowerCase()
    return chats.filter(c => {
      const partner = c.buyer_id === currentUserId ? c.seller : c.buyer
      return partner?.name?.toLowerCase().includes(q) ||
             (c.listing as { title?: string })?.title?.toLowerCase().includes(q)
    })
  }, [chats, search, currentUserId])

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms
    const q = search.toLowerCase()
    return rooms.filter(r => r.name.toLowerCase().includes(q))
  }, [rooms, search])

  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>

      {/* FIX: header фиксированной высоты — не прыгает при смене таба */}
      <PullIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} triggered={triggered} />
      <div className="page-header pt-safe">

        {/* Строка 1: заголовок + кнопка создать (всегда на месте) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
          /* FIX: кнопка "Создать" всегда в DOM, но скрыта когда не нужна */
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Чаты</h1>

          {/* FIX: кнопка всегда занимает место, но становится прозрачной */}
          <Link href="/rooms/new" style={{
            pointerEvents: tab === 'rooms' ? 'auto' : 'none',
            opacity: tab === 'rooms' ? 1 : 0,
            transition: 'opacity 0.15s',
          }}>
            <button style={{
              background: '#1E6FEB', color: '#fff', border: 'none',
              borderRadius: 10, padding: '7px 14px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'transform 0.14s var(--spring-bounce)',
            }}>
              + Создать
            </button>
          </Link>
        </div>

        {/* Строка 1.5: поиск */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по чатам..."
            style={{
              width: '100%', height: 38, borderRadius: 12,
              background: '#F2F3F5', border: '1.5px solid transparent',
              paddingLeft: 36, paddingRight: 12, fontSize: 14, color: '#1A1C21',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#2AABEE' }}
            onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: '#CDD0D8', border: 'none', borderRadius: '50%',
              width: 18, height: 18, cursor: 'pointer', color: 'white', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          )}
        </div>

        {/* Строка 2: табы */}
        <div style={{ display: 'flex', background: '#F2F3F5', borderRadius: 12, padding: 3 }}>
          {(['personal', 'rooms'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#1A1C21' : '#9498AB',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
              fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            }}>
              {t === 'personal'
                ? `Личные${chats.length > 0 ? ` · ${chats.length}` : ''}`
                : `Комнаты${rooms.length > 0 ? ` · ${rooms.length}` : ''}`
              }
            </button>
          ))}
        </div>
      </div>

      {/* Личные диалоги */}
      {tab === 'personal' && (
        <>
          {chats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20, background: '#EBF2FF',
                margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="#1E6FEB" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Нет диалогов</p>
              <p style={{ color: '#9498AB', fontSize: 14 }}>Напиши продавцу из ленты</p>
            </div>
          ) : (
            <div className="stagger" style={{ background: '#fff' }}>
              {filteredChats.length === 0 && search ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: '#9498AB', fontSize: 14 }}>
                  Ничего не найдено по «{search}»
                </div>
              ) : filteredChats.map(chat => {
                const partner  = chat.buyer_id === currentUserId ? chat.seller : chat.buyer
                const pName    = partner?.name ?? 'Продавец'
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const lastMsgs = (chat as any).last_message
                const lastMsg  = Array.isArray(lastMsgs) ? lastMsgs[lastMsgs.length - 1] : lastMsgs
                const timeStr  = lastMsg?.created_at ? msgTime(lastMsg.created_at) : msgTime(chat.created_at)
                const rawText = lastMsg?.text ?? ''
                const isCard  = rawText.startsWith('LISTING_CARD:')
                const displayText = isCard ? '📦 Карточка товара' : rawText
                const prefix  = lastMsg?.sender_id === currentUserId ? 'Вы: ' : ''
                const preview = lastMsg?.text
                  ? `${prefix}${displayText}`
                  : chat.listing ? `📦 ${(chat.listing as { title: string }).title}` : 'Новый чат'
                return (
                  <Link key={chat.id} href={`/chat/${chat.id}`}
                    className="press-card" style={{ display: 'block', textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderBottom: '1px solid #F0F1F4',
                    }}>
                      <Avatar name={pName} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pName}</p>
                          <span style={{ fontSize: 11, color: '#9498AB', flexShrink: 0, marginLeft: 8 }}>{timeStr}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#9498AB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {preview}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Комнаты */}
      {tab === 'rooms' && (
        <div style={{ padding: '12px 16px 0' }}>
          {rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20, background: '#EBF2FF',
                margin: '0 auto 16px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 28,
              }}>🏠</div>
              <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 6 }}>Нет комнат</p>
              <p style={{ color: '#9498AB', fontSize: 14, marginBottom: 20 }}>
                Создай закрытый чат для своей группы
              </p>
              <Link href="/rooms/new">
                <button style={{
                  background: '#1E6FEB', color: '#fff', border: 'none',
                  borderRadius: 12, padding: '12px 24px',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}>
                  Создать комнату
                </button>
              </Link>
            </div>
          ) : (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredRooms.map(room => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const isMember = (room as any).is_member !== false || joinedRooms.has(room.id)
                const isJoining = joiningRoom === room.id
                return isMember ? (
                  <Link key={room.id} href={`/rooms/${room.id}`}
                    className="press-card" style={{ textDecoration: 'none' }}>
                    <div className="card-press" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                        background: '#EBF2FF', color: '#1249A8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700,
                      }}>
                        {room.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {room.name}
                          </p>
                          {room.my_role === 'owner' && (
                            <span style={{ fontSize: 10, background: '#FFF8E0', color: '#7A5E00', borderRadius: 5, padding: '1px 6px', fontWeight: 700, flexShrink: 0 }}>owner</span>
                          )}
                          {room.is_private && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                            </svg>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: '#9498AB' }}>
                          {room.member_count ?? '?'} участников{room.description && ` · ${room.description}`}
                        </p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CDD0D8" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  </Link>
                ) : (
                  /* Публичная комната — кнопка Вступить */
                  <div key={room.id} className="card-press" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 16, border: '1px solid #E0E1E6' }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                      background: '#F2F3F5', color: '#9498AB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 700,
                    }}>
                      {room.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {room.name}
                        </p>
                        <span style={{ fontSize: 10, background: '#E6F9F3', color: '#006644', borderRadius: 5, padding: '1px 6px', fontWeight: 700, flexShrink: 0 }}>публичная</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#9498AB' }}>
                        {room.member_count ?? 0} участников{room.description && ` · ${room.description}`}
                      </p>
                    </div>
                    <button
                      onClick={() => joinRoom(room.id)}
                      disabled={isJoining}
                      style={{
                        padding: '7px 14px', borderRadius: 10, border: 'none',
                        background: '#1E6FEB', color: '#fff',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        opacity: isJoining ? 0.7 : 1, flexShrink: 0,
                      }}>
                      {isJoining ? '...' : 'Вступить'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
