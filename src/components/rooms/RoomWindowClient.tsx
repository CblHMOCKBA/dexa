'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Room, RoomMessage, RoomMember, Listing } from '@/types'
import Avatar from '@/components/ui/Avatar'
import ListingCardMessage, { encodeListingCard, decodeListingCard, type ListingCardData } from '@/components/chat/ListingCardMessage'

type OptimisticRoomMessage = RoomMessage & {
  status?: 'sending' | 'sent' | 'error'
  temp?: boolean
}

type Props = {
  room: Room
  initialMessages: RoomMessage[]
  members: RoomMember[]
  currentUserId: string
  myRole: 'owner' | 'admin' | 'member'
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDateSep(d: string) {
  const date = new Date(d)
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export default function RoomWindowClient({ room, initialMessages, members: initialMembers, currentUserId, myRole }: Props) {
  const router = useRouter()
  const [msgs, setMsgs]             = useState<OptimisticRoomMessage[]>(initialMessages)
  const [members, setMembers]        = useState<RoomMember[]>(initialMembers)
  const [text, setText]              = useState('')
  const [panel, setPanel]            = useState<'none' | 'members' | 'invite' | 'share'>('none')
  const [inviteCode, setInviteCode]  = useState<string | null>(null)
  const [copyDone, setCopyDone]      = useState(false)
  const [myListings, setMyListings]  = useState<Listing[]>([])
  const [loadingListings, setLoadingListings] = useState(false)
  const [showMenu, setShowMenu]         = useState(false)
  const [menuAction, setMenuAction]     = useState<'none'|'leave'|'delete'|'clear'>('none')
  const [menuLoading, setMenuLoading]   = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const seenIds   = useRef<Set<string>>(new Set(initialMessages.map(m => m.id)))

  const isAdmin = myRole === 'owner' || myRole === 'admin'

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

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
        setMsgs(prev => {
          const tempIdx = prev.findIndex(x => x.temp && x.sender_id === m.sender_id && x.text === m.text)
          if (tempIdx >= 0) {
            const updated = [...prev]
            updated[tempIdx] = { ...m, status: 'sent' }
            return updated
          }
          return [...prev, { ...m, status: 'sent' }]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room.id])

  useEffect(() => {
    if (panel !== 'members') return
    const supabase = createClient()
    supabase.from('room_members').select('*, profile:profiles(*)')
      .eq('room_id', room.id)
      .then(({ data }) => { if (data) setMembers(data as RoomMember[]) })
  }, [panel])

  useEffect(() => {
    if (panel !== 'share' || myListings.length > 0) return
    setLoadingListings(true)
    const supabase = createClient()
    supabase.from('listings').select('id,title,price,brand,status')
      .eq('seller_id', currentUserId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setMyListings((data as Listing[]) ?? []); setLoadingListings(false) })
  }, [panel])

  async function leaveRoom() {
    setMenuLoading(true)
    const supabase = createClient()
    await supabase.from('room_members').delete().eq('room_id', room.id).eq('user_id', currentUserId)
    router.push('/chat')
  }

  async function deleteRoom() {
    if (myRole !== 'owner') return
    setMenuLoading(true)
    const supabase = createClient()
    await supabase.from('room_messages').delete().eq('room_id', room.id)
    await supabase.from('room_members').delete().eq('room_id', room.id)
    await supabase.from('rooms').delete().eq('id', room.id)
    router.push('/chat')
  }

  async function clearRoomHistory() {
    if (!isAdmin) return
    setMenuLoading(true)
    const supabase = createClient()
    await supabase.from('room_messages').delete().eq('room_id', room.id)
    setMsgs([])
    setMenuLoading(false)
    setMenuAction('none')
    setShowMenu(false)
  }

  function exportRoomHistory() {
    const lines = msgs.map(m => {
      const name = senderName(m.sender_id)
      const time = new Date(m.created_at).toLocaleString('ru-RU')
      return `[${time}] ${name}: ${m.text}`
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `dexa-room-${room.name}-${new Date().toISOString().slice(0,10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  function resize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
  }

  async function send(customText?: string) {
    const t = (customText ?? text).trim()
    if (!t) return
    if (!customText) { setText(''); if (inputRef.current) inputRef.current.style.height = 'auto' }

    const tempId = `temp-${Date.now()}-${Math.random()}`
    const tempMsg: OptimisticRoomMessage = {
      id: tempId, room_id: room.id, sender_id: currentUserId,
      text: t, reply_to: null, is_edited: false,
      created_at: new Date().toISOString(),
      status: 'sending', temp: true,
    }
    seenIds.current.add(tempId)
    setMsgs(prev => [...prev, tempMsg])

    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('room_messages')
        .insert({ room_id: room.id, sender_id: currentUserId, text: t })
        .select('id').single()
      if (error) throw error
      if (data?.id) seenIds.current.add(data.id)
      setMsgs(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: data?.id ?? tempId, status: 'sent', temp: false } : m
      ))
    } catch {
      setMsgs(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'error' } : m
      ))
    }
  }

  async function retrySend(msg: OptimisticRoomMessage) {
    setMsgs(prev => prev.filter(m => m.id !== msg.id))
    await send(msg.text)
  }

  async function shareListingCard(listing: Listing) {
    const cardData: ListingCardData = {
      id:          listing.id,
      title:       listing.title,
      price:       listing.price,
      brand:       listing.brand ?? null,
      model:       (listing as { model?: string }).model ?? null,
      condition:   listing.condition,
      seller_id:   listing.seller_id,
      seller_name: (listing.seller as { name?: string })?.name ?? 'Продавец',
      status:      listing.status as 'active' | 'reserved' | 'sold',
    }
    await send(encodeListingCard(cardData))
    setPanel('none')
  }

  async function generateInvite() {
    const supabase = createClient()
    const { data } = await supabase.from('invite_links')
      .insert({ room_id: room.id, created_by: currentUserId })
      .select('code').single()
    if (data) setInviteCode(data.code)
  }

  async function copyInvite() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`)
    setCopyDone(true); setTimeout(() => setCopyDone(false), 2200)
  }

  async function kickMember(userId: string) {
    if (userId === currentUserId) return
    const supabase = createClient()
    await supabase.from('room_members').delete().eq('room_id', room.id).eq('user_id', userId)
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  function senderName(id: string) {
    const m = members.find(m => m.user_id === id)
    return m?.profile?.name ?? 'Участник'
  }

  function isSameGroup(i: number) {
    if (i === 0) return false
    return msgs[i].sender_id === msgs[i - 1].sender_id &&
           isSameDay(msgs[i].created_at, msgs[i - 1].created_at)
  }

  function membersLabel() {
    const n = members.length
    if (n === 1) return '1 участник'
    if (n < 5)  return `${n} участника`
    return `${n} участников`
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', minHeight: '-webkit-fill-available',
      background: '#F2F3F5', overflow: 'hidden',
      position: 'fixed', inset: 0,
    }}>

      {/* ── HEADER ── */}
      <div style={{
        flexShrink: 0, zIndex: 20,
        position: 'sticky', top: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px 10px', paddingTop: 'calc(10px + var(--sat))',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8E9ED',
      }}>
        <Link href="/chat" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Link>

        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: '#EBF2FF', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#1249A8',
        }}>
          {room.name[0].toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => setPanel(p => p === 'members' ? 'none' : 'members')}>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#1A1C21', lineHeight: 1.2 }}>{room.name}</p>
          <p style={{ fontSize: 12, color: '#9498AB' }}>{membersLabel()}</p>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setPanel(p => p === 'share' ? 'none' : 'share')} style={{
            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: panel === 'share' ? '#EBF2FF' : '#F2F3F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={panel === 'share' ? '#1E6FEB' : '#9498AB'} strokeWidth="2">
              <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
              <rect x="3" y="13" width="8" height="8" rx="1"/><path d="M13 17h8M17 13v8"/>
            </svg>
          </button>
          {isAdmin && (
            <button onClick={() => setPanel(p => p === 'invite' ? 'none' : 'invite')} style={{
              width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: panel === 'invite' ? '#EBF2FF' : '#F2F3F5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={panel === 'invite' ? '#1E6FEB' : '#9498AB'} strokeWidth="2">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </button>
          )}

          {/* ⋮ Меню */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(v => !v)} style={{
              width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: showMenu ? '#F2F3F5' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="5"  r="1.5" fill="#9498AB"/>
                <circle cx="12" cy="12" r="1.5" fill="#9498AB"/>
                <circle cx="12" cy="19" r="1.5" fill="#9498AB"/>
              </svg>
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute', top: 42, right: 0, zIndex: 50,
                background: 'white', borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                minWidth: 220, overflow: 'hidden',
                animation: 'pop-in 0.18s var(--spring-bounce) both',
              }}>
                {[
                  { icon: '💬', label: 'Поделиться товаром', action: () => { setShowMenu(false); setPanel('share') }, color: '#1A1C21' },
                  { icon: '📥', label: 'Экспорт истории',    action: exportRoomHistory, color: '#1A1C21' },
                  ...(isAdmin ? [{ icon: '🗑', label: 'Очистить историю', action: () => setMenuAction('clear'), color: '#F0B90B' }] : []),
                  { icon: '🚪', label: 'Покинуть комнату',  action: () => setMenuAction('leave'), color: '#E8251F' },
                  ...(myRole === 'owner' ? [{ icon: '🚫', label: 'Удалить комнату', action: () => setMenuAction('delete'), color: '#E8251F' }] : []),
                ].map((item, i, arr) => (
                  <button key={item.label} onClick={item.action} style={{
                    width: '100%', padding: '13px 16px', border: 'none', cursor: 'pointer',
                    background: 'white', display: 'flex', alignItems: 'center', gap: 12,
                    borderBottom: i < arr.length - 1 ? '1px solid #F2F3F5' : 'none',
                    textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: item.color }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {showMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />}

      {/* Диалог подтверждения */}
      {(menuAction === 'delete' || menuAction === 'leave' || menuAction === 'clear') && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px',
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: '24px',
            width: '100%', maxWidth: 320,
            animation: 'pop-in 0.2s var(--spring-bounce) both',
          }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1C21', marginBottom: 8, textAlign: 'center' }}>
              {menuAction === 'delete' ? 'Удалить комнату?' : menuAction === 'leave' ? 'Покинуть комнату?' : 'Очистить историю?'}
            </p>
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              {menuAction === 'delete' ? 'Комната и все сообщения будут удалены навсегда'
                : menuAction === 'leave' ? 'Вы покинете комнату. Вернуться можно по invite-ссылке'
                : 'Все сообщения комнаты будут удалены'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setMenuAction('none'); setShowMenu(false) }} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                background: '#F2F3F5', color: '#1A1C21', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Отмена</button>
              <button
                onClick={menuAction === 'delete' ? deleteRoom : menuAction === 'leave' ? leaveRoom : clearRoomHistory}
                disabled={menuLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                  background: menuAction === 'clear' ? '#F0B90B' : '#E8251F',
                  color: menuAction === 'clear' ? '#1A1C21' : 'white',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  opacity: menuLoading ? 0.6 : 1,
                }}
              >
                {menuLoading ? '...' : menuAction === 'delete' ? 'Удалить' : menuAction === 'leave' ? 'Покинуть' : 'Очистить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ПАНЕЛЬ: УЧАСТНИКИ ── */}
      {panel === 'members' && (
        <div style={{
          flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED',
          maxHeight: 240, overflowY: 'auto',
          animation: 'slide-up 0.2s var(--spring-smooth) both',
        }}>
          <div style={{ padding: '10px 16px 4px', position: 'sticky', top: 0, background: 'white', borderBottom: '1px solid #F2F3F5' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Участники · {members.length}
            </p>
          </div>
          {members.map(m => (
            <div key={m.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 16px', borderBottom: '1px solid #F2F3F5',
            }}>
              <Avatar name={m.profile?.name ?? '?'} size="xs" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>
                  {m.profile?.name ?? 'Участник'}
                  {m.user_id === currentUserId && <span style={{ color: '#9498AB', fontWeight: 400 }}> (вы)</span>}
                </p>
                {m.profile?.location && <p style={{ fontSize: 11, color: '#9498AB' }}>{m.profile.location}</p>}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                background: m.role === 'owner' ? '#FFF8E0' : m.role === 'admin' ? '#EBF2FF' : '#F2F3F5',
                color: m.role === 'owner' ? '#7A5E00' : m.role === 'admin' ? '#1249A8' : '#9498AB',
              }}>
                {m.role}
              </span>
              {isAdmin && m.user_id !== currentUserId && m.role !== 'owner' && (
                <button onClick={() => kickMember(m.user_id)} style={{
                  width: 26, height: 26, borderRadius: 6, border: 'none',
                  background: '#FFEBEA', color: '#E8251F', cursor: 'pointer',
                  fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ПАНЕЛЬ: ПОДЕЛИТЬСЯ ── */}
      {panel === 'share' && (
        <div style={{
          flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED',
          padding: '12px 16px', maxHeight: 260, overflowY: 'auto',
          animation: 'slide-up 0.2s var(--spring-smooth) both',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Поделиться товаром
          </p>
          {loadingListings ? (
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '12px 0' }}>...</p>
          ) : myListings.length > 0 ? (
            myListings.map(l => (
              <button key={l.id} onClick={() => shareListingCard(l)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                background: '#F8F9FB', borderRadius: 12, padding: '10px 12px',
                border: '1.5px solid #E0E1E6', cursor: 'pointer', marginBottom: 6, textAlign: 'left',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{l.title}</p>
                  <p style={{ fontSize: 12, color: '#00B173', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {l.price.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2">
                  <path d="m22 2-7 20-4-9-9-4 20-7z"/>
                </svg>
              </button>
            ))
          ) : (
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', padding: '12px 0' }}>
              Нет активных товаров
            </p>
          )}
        </div>
      )}

      {/* ── ПАНЕЛЬ: INVITE ── */}
      {panel === 'invite' && (
        <div style={{
          flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED',
          padding: '12px 16px', animation: 'slide-up 0.2s var(--spring-smooth) both',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Пригласить
          </p>
          {!inviteCode ? (
            <button onClick={generateInvite} style={{
              width: '100%', padding: '11px', borderRadius: 12,
              background: '#EBF2FF', color: '#1249A8', border: 'none',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Создать invite-ссылку</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: '#F2F3F5', borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
                <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 2 }}>Ссылка</p>
                <p style={{ fontSize: 12, color: '#1A1C21', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`}
                </p>
              </div>
              <button onClick={copyInvite} style={{
                padding: '0 16px', borderRadius: 10, border: 'none',
                background: copyDone ? '#E6F9F3' : '#1E6FEB',
                color: copyDone ? '#006644' : '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
              }}>
                {copyDone ? '✓' : 'Копировать'}
              </button>
            </div>
          )}
          <p style={{ fontSize: 11, color: '#9498AB', marginTop: 8 }}>
            Код: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1A1C21' }}>{room.invite_code}</span>
          </p>
        </div>
      )}

      {/* ── СООБЩЕНИЯ ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 2,
        WebkitOverflowScrolling: 'touch',
      }}>
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 6 }}>
            <div style={{ fontSize: 48 }}>👋</div>
            <p style={{ fontWeight: 700, color: '#1A1C21', marginTop: 4 }}>{room.name}</p>
            <p style={{ fontSize: 13, color: '#9498AB', textAlign: 'center', maxWidth: 200 }}>
              {room.description ?? 'Начало групповой комнаты'}
            </p>
          </div>
        )}

        {msgs.map((m, i) => {
          const own     = m.sender_id === currentUserId
          const group   = isSameGroup(i)
          const showSep = i === 0 || !isSameDay(m.created_at, msgs[i - 1].created_at)
          const name    = senderName(m.sender_id)
          const showAvatar = !own && (!msgs[i + 1] || msgs[i + 1].sender_id !== m.sender_id)

          return (
            <div key={m.id}>
              {showSep && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 8px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#9498AB',
                    background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)',
                    padding: '4px 12px', borderRadius: 20,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}>
                    {formatDateSep(m.created_at)}
                  </span>
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: own ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end', gap: 6,
                marginTop: group && !showSep ? 1 : 6,
              }}>
                {!own && (
                  <div style={{ width: 28, flexShrink: 0 }}>
                    {showAvatar && <Avatar name={name} size="xs" />}
                  </div>
                )}

                <div style={{ maxWidth: '78%', opacity: m.status === 'sending' ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                  {!own && !group && !decodeListingCard(m.text) && (
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#1E6FEB', marginBottom: 2, paddingLeft: 4 }}>
                      {name}
                    </p>
                  )}
                  {(() => {
                    const cardData = decodeListingCard(m.text)
                    if (cardData) {
                      return (
                        <ListingCardMessage
                          data={cardData}
                          currentUserId={currentUserId}
                          isOwn={own}
                          timeStr={formatTime(m.created_at)}
                          deliveryStatus={own ? <span style={{ fontSize: 10, opacity: 0.65 }}>{m.status === 'sending' ? '⏳' : '✓'}</span> : undefined}
                        />
                      )
                    }
                    return (
                      <>
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: own
                            ? (group && !showSep ? '18px 4px 4px 18px' : '18px 18px 4px 18px')
                            : (group && !showSep ? '4px 18px 18px 4px' : '4px 18px 18px 18px'),
                          background: m.status === 'error' ? '#FFEBEA' : own ? '#2AABEE' : '#fff',
                          color: m.status === 'error' ? '#A8170F' : own ? '#fff' : '#1A1C21',
                          fontSize: 15, lineHeight: 1.45,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {m.text}
                          <span style={{ fontSize: 10, marginLeft: 8, float: 'right', marginTop: 2, whiteSpace: 'nowrap', opacity: 0.65, fontFamily: 'var(--font-mono)' }}>
                            {formatTime(m.created_at)}
                            {own && ` ${m.status === 'sending' ? '⏳' : m.status === 'error' ? '!' : '✓'}`}
                          </span>
                        </div>
                        {m.status === 'error' && (
                          <button onClick={() => retrySend(m)} style={{
                            display: 'block', marginTop: 4, marginLeft: 'auto',
                            fontSize: 11, color: '#E8251F', fontWeight: 700,
                            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                          }}>↻ Повторить</button>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── INPUT ── */}
      <div style={{
        flexShrink: 0, zIndex: 20,
        position: 'sticky', bottom: 0,
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '8px 12px', paddingBottom: 'calc(10px + var(--sab))',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid #E8E9ED',
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); resize(e.target) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={`Сообщение...`}
          rows={1}
          style={{
            flex: 1, background: '#F2F3F5', border: '1.5px solid transparent',
            borderRadius: 22, padding: '10px 16px', fontSize: 15, color: '#1A1C21',
            outline: 'none', resize: 'none', overflow: 'hidden',
            minHeight: 44, maxHeight: 100, fontFamily: 'system-ui',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#2AABEE' }}
          onBlur={e => { e.target.style.background = '#F2F3F5'; e.target.style.borderColor = 'transparent' }}
        />
        <button onClick={() => send()} disabled={!text.trim()} style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none',
          background: text.trim() ? '#2AABEE' : '#E0E1E6',
          cursor: text.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, transform 0.1s',
          transform: text.trim() ? 'scale(1)' : 'scale(0.9)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m22 2-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
