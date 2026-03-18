'use client'

import { useState } from 'react'
import Link from 'next/link'
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

function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1)  return 'сейчас'
  if (m < 60) return `${m}м`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}ч`
  return `${Math.floor(h / 24)}д`
}

type Props = {
  chats: Chat[]
  rooms: Room[]
  currentUserId: string
}

export default function ChatListClient({ chats, rooms, currentUserId }: Props) {
  const [tab, setTab] = useState<'personal' | 'rooms'>('personal')

  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>

      {/* FIX: header фиксированной высоты — не прыгает при смене таба */}
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
              {chats.map(chat => {
                const partner = chat.buyer_id === currentUserId ? chat.seller : chat.buyer
                const pName   = partner?.name ?? 'Продавец'
                return (
                  <Link key={chat.id} href={`/chat/${chat.id}`} className='press-card'
                    className="press-card" style={{ display: 'block', textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderBottom: '1px solid #F0F1F4',
                    }}>
                      <Avatar name={pName} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21' }}>{pName}</p>
                          <span style={{ fontSize: 11, color: '#9498AB', flexShrink: 0 }}>
                            {ago(chat.created_at)}
                          </span>
                        </div>
                        {chat.listing && (
                          <p style={{ fontSize: 13, color: '#9498AB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📦 {chat.listing.title}
                          </p>
                        )}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="#CDD0D8" strokeWidth="2.5">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
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
              {rooms.map(room => (
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
                          <span style={{ fontSize: 10, background: '#FFF8E0', color: '#7A5E00', borderRadius: 5, padding: '1px 6px', fontWeight: 700, flexShrink: 0 }}>
                            owner
                          </span>
                        )}
                        {room.is_private && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="#9498AB" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                            <rect x="3" y="11" width="18" height="11" rx="2"/>
                            <path d="M7 11V7a5 5 0 0110 0v4"/>
                          </svg>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: '#9498AB' }}>
                        {room.member_count ?? '?'} участников
                        {room.description && ` · ${room.description}`}
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="#CDD0D8" strokeWidth="2.5">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
