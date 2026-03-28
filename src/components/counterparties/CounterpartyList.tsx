'use client'

import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import PullIndicator from '@/components/ui/PullIndicator'

import { useState } from 'react'
import Link from 'next/link'
import type { Counterparty } from '@/types'

const TYPE_LABEL: Record<string, string> = { supplier: 'Поставщик', buyer: 'Покупатель', both: 'Оба', courier: 'Курьер' }
const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  supplier: { bg: '#EBF2FF', color: '#1249A8' },
  buyer:    { bg: '#E6F9F3', color: '#006644' },
  both:     { bg: '#F0E8FF', color: '#5B00CC' },
  courier:  { bg: '#FFF4E0', color: '#7A4F00' },
}

function BalancePill({ balance }: { balance: number }) {
  if (balance === 0) return <span style={{ fontSize: 11, color: '#9498AB' }}>В балансе</span>
  const isOwed = balance > 0 // мне должны
  return (
    <span style={{
      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
      color: isOwed ? '#006644' : '#A8170F',
      background: isOwed ? '#E6F9F3' : '#FFEBEA',
      padding: '2px 8px', borderRadius: 6,
    }}>
      {isOwed ? '+' : '−'}{Math.abs(balance).toLocaleString('ru-RU')} ₽
    </span>
  )
}

export default function CounterpartyList({ counterparties }: { counterparties: Counterparty[] }) {
  const { pullDistance, isRefreshing, triggered } = usePullToRefresh()
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'supplier' | 'buyer' | 'both' | 'courier'>('all')

  const filtered = counterparties.filter(c => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) ||
             (c.company?.toLowerCase().includes(q) ?? false) ||
             (c.phone?.includes(q) ?? false)
    }
    return true
  })

  const totalDebt    = counterparties.reduce((s, c) => s + Math.max(0, -(c.balance ?? 0)), 0)
  const totalOwed    = counterparties.reduce((s, c) => s + Math.max(0, c.balance ?? 0), 0)

  return (
    <div className="page-with-nav pb-nav" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <PullIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} triggered={triggered} />
      <div className="page-header pt-safe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1C21' }}>Контакты</h1>
          <Link href="/counterparties/new">
            <button style={{
              background: '#1E6FEB', color: '#fff', border: 'none',
              borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              + Добавить
            </button>
          </Link>
        </div>

        {/* Поиск */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Имя, компания, телефон..." className="input" style={{ paddingLeft: 40 }} />
        </div>

        {/* Фильтр типа */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all','supplier','buyer','both','courier'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: typeFilter === t ? '#1E6FEB' : '#ECEDF0',
              color: typeFilter === t ? '#fff' : '#5A5E72',
            }}>
              {t === 'all' ? 'Все' : t === 'courier' ? '🚚 Курьеры' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Итоговый баланс */}
      {(totalDebt > 0 || totalOwed > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 16px 0' }}>
          <div className="card" style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 4 }}>Мне должны</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#00B173' }}>
              {totalOwed.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 11, color: '#9498AB', marginBottom: 4 }}>Я должен</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#E8251F' }}>
              {totalDebt.toLocaleString('ru-RU')} ₽
            </p>
          </div>
        </div>
      )}

      {/* Список */}
      <div style={{ padding: '12px 16px 0' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🤝</p>
            <p style={{ fontWeight: 700, color: '#1A1C21', marginBottom: 8 }}>
              {counterparties.length === 0 ? 'Нет контрагентов' : 'Нет совпадений'}
            </p>
            <p style={{ fontSize: 14, color: '#9498AB', marginBottom: 20 }}>
              Добавь поставщиков и покупателей
            </p>
            <Link href="/counterparties/new">
              <button style={{ background: '#EBF2FF', color: '#1249A8', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                + Добавить первого
              </button>
            </Link>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(c => {
              const tc = TYPE_COLOR[c.type ?? 'buyer'] ?? TYPE_COLOR['buyer']
              return (
                <Link key={c.id} href={`/counterparties/${c.id}`} className="press-card" style={{ textDecoration: 'none' }}>
                  <div className="card anim-card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

                      {/* Аватар */}
                      <div style={{
                        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                        background: tc.bg, color: tc.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700,
                      }}>
                        {c.type === 'courier' ? '🚚' : (c.name?.[0] ?? '?').toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1C21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </p>
                          <span style={{ fontSize: 10, background: tc.bg, color: tc.color, borderRadius: 5, padding: '2px 7px', fontWeight: 700, flexShrink: 0 }}>
                            {TYPE_LABEL[c.type] ?? c.type}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          {c.company && (
                            <span style={{ fontSize: 12, color: '#5A5E72' }}>{c.company}</span>
                          )}
                          {c.phone && (
                            <span style={{ fontSize: 12, color: '#9498AB', fontFamily: 'var(--font-mono)' }}>{c.phone}</span>
                          )}
                          {c.deals_count !== undefined && c.deals_count > 0 && (
                            <span style={{ fontSize: 11, color: '#9498AB' }}>{c.deals_count} сделок</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {c.balance !== undefined && <BalancePill balance={c.balance} />}
                          {c.discount_pct > 0 && (
                            <span style={{ fontSize: 11, background: '#FFF8E0', color: '#7A5E00', borderRadius: 5, padding: '2px 7px', fontWeight: 600 }}>
                              скидка {c.discount_pct}%
                            </span>
                          )}
                          {c.tags?.map(tag => (
                            <span key={tag} style={{ fontSize: 10, background: '#F2F3F5', color: '#5A5E72', borderRadius: 5, padding: '2px 6px' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CDD0D8" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 4 }}>
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
