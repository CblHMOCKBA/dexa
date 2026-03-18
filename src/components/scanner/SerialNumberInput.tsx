'use client'

import { useState } from 'react'
import BarcodeScanner, { type ScanResult } from '@/components/scanner/BarcodeScanner'
import { validateIMEI } from '@/lib/api/upc'

export type SerialEntry = {
  serial_number: string
  imei: string
  valid: boolean
}

type Props = {
  quantity: number
  onChange: (entries: SerialEntry[]) => void
  isSmartphone?: boolean // включает валидацию IMEI
}

export default function SerialNumberInput({ quantity, onChange, isSmartphone }: Props) {
  const [entries, setEntries] = useState<SerialEntry[]>(
    Array.from({ length: quantity }, () => ({ serial_number: '', imei: '', valid: false }))
  )
  const [scanIdx, setScanIdx]     = useState<number | null>(null)
  const [expanded, setExpanded]   = useState(true)
  const [skipAll, setSkipAll]     = useState(false)

  if (quantity <= 0) return null

  function update(i: number, field: keyof SerialEntry, val: string) {
    const next = entries.map((e, idx) => {
      if (idx !== i) return e
      const updated = { ...e, [field]: val }
      // Валидация IMEI
      if (field === 'imei') {
        updated.valid = !val || validateIMEI(val)
      } else if (field === 'serial_number') {
        updated.valid = val.length > 0
      }
      return updated
    })
    setEntries(next)
    onChange(next)
  }

  function handleScan(i: number, result: ScanResult) {
    setScanIdx(null)
    // IMEI — 15 цифр
    if (/^\d{15}$/.test(result.value)) {
      update(i, 'imei', result.value)
    } else {
      update(i, 'serial_number', result.value)
    }
  }

  function handleSkipAll() {
    setSkipAll(true)
    const cleared = entries.map(e => ({ ...e, serial_number: '', imei: '', valid: true }))
    setEntries(cleared)
    onChange(cleared)
  }

  const filled   = entries.filter(e => e.serial_number || e.imei).length
  const progress = Math.round((filled / quantity) * 100)

  return (
    <div>
      {/* Заголовок с прогрессом */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button onClick={() => setExpanded(p => !p)} style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Серийные номера
              </p>
              <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: filled === quantity ? '#00B173' : '#1E6FEB', fontWeight: 700 }}>
                {filled} / {quantity}
              </p>
            </div>
            {/* Прогресс-бар */}
            <div style={{ height: 4, background: '#F0F1F4', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: filled === quantity ? '#00B173' : '#1E6FEB',
                width: `${progress}%`, transition: 'width 0.3s ease',
              }}/>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2.5"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
      </div>

      {expanded && !skipAll && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map((entry, i) => (
            <div key={i} style={{
              background: '#F8F9FF', borderRadius: 12, padding: '12px',
              border: `1.5px solid ${entry.imei || entry.serial_number ? '#1E6FEB' : '#E0E8FF'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1249A8' }}>
                  Единица {i + 1} из {quantity}
                </p>
                {(entry.serial_number || entry.imei) && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00B173" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={entry.serial_number}
                  onChange={e => update(i, 'serial_number', e.target.value)}
                  placeholder="Серийный номер"
                  style={{
                    flex: 1, background: '#fff', border: '1.5px solid #E0E1E6',
                    borderRadius: 10, padding: '10px 12px',
                    fontSize: 13, color: '#1A1C21', outline: 'none',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                {/* Кнопка сканировать */}
                <button onClick={() => setScanIdx(i)} style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: '#1E6FEB', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                    <rect x="7" y="7" width="10" height="10" rx="1"/>
                  </svg>
                </button>
              </div>

              {/* IMEI для смартфонов */}
              {isSmartphone && (
                <div style={{ marginTop: 8 }}>
                  <input
                    value={entry.imei}
                    onChange={e => update(i, 'imei', e.target.value)}
                    placeholder="IMEI (15 цифр)"
                    maxLength={15}
                    style={{
                      width: '100%', background: '#fff',
                      border: `1.5px solid ${entry.imei && !entry.valid ? '#E8251F' : '#E0E1E6'}`,
                      borderRadius: 10, padding: '10px 12px',
                      fontSize: 13, color: '#1A1C21', outline: 'none',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  {entry.imei && !entry.valid && (
                    <p style={{ fontSize: 11, color: '#E8251F', marginTop: 4 }}>
                      Неверный IMEI (проверка по алгоритму Луна)
                    </p>
                  )}
                  {entry.imei && entry.valid && (
                    <p style={{ fontSize: 11, color: '#00B173', marginTop: 4 }}>✓ IMEI валиден</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Пропустить все */}
          <button onClick={handleSkipAll} style={{
            width: '100%', padding: '10px', borderRadius: 10,
            background: 'transparent', color: '#9498AB',
            border: '1px dashed #CDD0D8', cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
          }}>
            Пропустить серийные номера
          </button>
        </div>
      )}

      {skipAll && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#F2F3F5', borderRadius: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9498AB" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
          </svg>
          <p style={{ fontSize: 13, color: '#9498AB' }}>S/N пропущены — можно добавить позже</p>
          <button onClick={() => setSkipAll(false)} style={{ marginLeft: 'auto', fontSize: 12, color: '#1E6FEB', background: 'none', border: 'none', cursor: 'pointer' }}>
            Добавить
          </button>
        </div>
      )}

      {/* Сканер */}
      {scanIdx !== null && (
        <BarcodeScanner
          mode="serial"
          hint="Наведи на штрихкод серийного номера или QR на коробке"
          onScan={r => handleScan(scanIdx, r)}
          onClose={() => setScanIdx(null)}
        />
      )}
    </div>
  )
}
