'use client'

import { useState } from 'react'

export type FilterState = {
  brand: string
  condition: 'all' | 'new' | 'used'
  minPrice: string
  maxPrice: string
  location: string
  sort: 'newest' | 'price_asc' | 'price_desc' | 'popular'
}

export const EMPTY_FILTER: FilterState = {
  brand: '', condition: 'all', minPrice: '', maxPrice: '',
  location: 'Горбушка', sort: 'newest',
}

const BRANDS   = ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Google', 'OnePlus', 'Sony', 'Lenovo']
const LOCATIONS = [
  { id: 'Горбушка', label: 'Горбушка', active: true },
  { id: 'Митино',   label: 'Митино',   active: false },
  { id: 'Савёловский', label: 'Савёловский', active: false },
  { id: 'Царицыно', label: 'Царицыно', active: false },
]
const SORTS = [
  { id: 'newest',    label: 'Сначала новые',   icon: '🕐' },
  { id: 'price_asc', label: 'Сначала дешевле', icon: '↑' },
  { id: 'price_desc',label: 'Сначала дороже',  icon: '↓' },
  { id: 'popular',   label: 'Популярные',      icon: '🔥' },
]

type Props = {
  value: FilterState
  onApply: (f: FilterState) => void
  onClose: () => void
}

export default function FilterSheet({ value, onApply, onClose }: Props) {
  const [local, setLocal] = useState<FilterState>(value)

  function set<K extends keyof FilterState>(k: K, v: FilterState[K]) {
    setLocal(p => ({ ...p, [k]: v }))
  }

  function reset() { setLocal(EMPTY_FILTER) }

  const activeCount = [
    local.brand !== '',
    local.condition !== 'all',
    local.minPrice !== '' || local.maxPrice !== '',
    local.location !== 'Горбушка',
    local.sort !== 'newest',
  ].filter(Boolean).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="anim-sheet" style={{
        background: '#fff', borderRadius: '24px 24px 0 0',
        maxHeight: '90dvh', overflowY: 'auto',
        paddingBottom: 'calc(20px + var(--sab))',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E1E6' }}/>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1C21' }}>Фильтры</h2>
            {activeCount > 0 && (
              <span style={{
                background: '#1E6FEB', color: '#fff',
                borderRadius: '50%', width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                animation: 'bounce-in 0.25s var(--spring-bounce) both',
              }}>
                {activeCount}
              </span>
            )}
          </div>
          <button onClick={reset} style={{
            color: '#E8251F', fontSize: 13, fontWeight: 600,
            background: '#FFEBEA', border: 'none',
            borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
          }}>
            Сбросить
          </button>
        </div>

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Локация */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
              Рынок
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LOCATIONS.map(loc => (
                <button key={loc.id} onClick={() => loc.active && set('location', loc.id)}
                  style={{
                    padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                    border: local.location === loc.id ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
                    background: local.location === loc.id ? '#EBF2FF' : loc.active ? '#fff' : '#F8F8FA',
                    color: local.location === loc.id ? '#1249A8' : loc.active ? '#1A1C21' : '#CDD0D8',
                    cursor: loc.active ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}>
                  {loc.label}
                  {!loc.active && (
                    <span style={{
                      position: 'absolute', top: -6, right: -4,
                      fontSize: 9, background: '#E0E1E6', color: '#9498AB',
                      borderRadius: 4, padding: '1px 4px', fontWeight: 700,
                    }}>
                      soon
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Бренд */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
              Бренд
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => set('brand', '')} style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                border: local.brand === '' ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
                background: local.brand === '' ? '#EBF2FF' : '#fff',
                color: local.brand === '' ? '#1249A8' : '#5A5E72',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                Все
              </button>
              {BRANDS.map(b => (
                <button key={b} onClick={() => set('brand', local.brand === b ? '' : b)}
                  style={{
                    padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                    border: local.brand === b ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
                    background: local.brand === b ? '#EBF2FF' : '#fff',
                    color: local.brand === b ? '#1249A8' : '#5A5E72',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Состояние */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
              Состояние
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {([['all','Любое','🔀'],['new','Новый','✨'],['used','Б/У','🔄']] as const).map(([val, label, ico]) => (
                <button key={val} onClick={() => set('condition', val)} style={{
                  padding: '12px 8px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  border: local.condition === val ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
                  background: local.condition === val ? '#EBF2FF' : '#fff',
                  color: local.condition === val ? '#1249A8' : '#5A5E72',
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 20 }}>{ico}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Цена */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
              Цена ₽
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <input type="number" placeholder="От" value={local.minPrice}
                  onChange={e => set('minPrice', e.target.value)}
                  className="input" style={{ paddingRight: 36 }} />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9498AB', pointerEvents: 'none' }}>₽</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input type="number" placeholder="До" value={local.maxPrice}
                  onChange={e => set('maxPrice', e.target.value)}
                  className="input" style={{ paddingRight: 36 }} />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9498AB', pointerEvents: 'none' }}>₽</span>
              </div>
            </div>
            {/* Быстрые диапазоны */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {[['до 50к', '', '50000'], ['50–150к', '50000', '150000'], ['150к+', '150000', '']].map(([label, min, max]) => (
                <button key={label} onClick={() => { set('minPrice', min); set('maxPrice', max) }}
                  style={{
                    padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                    border: '1.5px solid #E0E1E6',
                    background: local.minPrice === min && local.maxPrice === max ? '#EBF2FF' : '#F2F3F5',
                    color: local.minPrice === min && local.maxPrice === max ? '#1249A8' : '#5A5E72',
                    cursor: 'pointer',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Сортировка */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
              Сортировка
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SORTS.map(s => (
                <button key={s.id} onClick={() => set('sort', s.id as FilterState['sort'])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 12,
                    border: local.sort === s.id ? '2px solid #1E6FEB' : '1.5px solid #E0E1E6',
                    background: local.sort === s.id ? '#EBF2FF' : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 18, width: 28 }}>{s.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: local.sort === s.id ? '#1249A8' : '#1A1C21' }}>
                    {s.label}
                  </span>
                  {local.sort === s.id && (
                    <svg style={{ marginLeft: 'auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E6FEB" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Apply */}
          <button onClick={() => { onApply(local); onClose() }}
            className="btn-primary" style={{ width: '100%', marginBottom: 4 }}>
            Применить{activeCount > 0 ? ` · ${activeCount} фильтра` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
