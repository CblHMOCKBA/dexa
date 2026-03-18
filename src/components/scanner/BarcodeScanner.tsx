'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

// SSR: импортируем только на клиенте
const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then(m => m.Scanner),
  { ssr: false }
)

export type ScanResult = {
  type: 'upc' | 'serial' | 'imei'
  value: string
  format: string
}

type Mode = 'upc' | 'serial' | 'imei' | 'any'

type Props = {
  onScan: (result: ScanResult) => void
  onClose: () => void
  mode?: Mode
  hint?: string
}

function classifyAndClean(raw: string, mode: Mode): { type: ScanResult['type']; value: string } | null {
  // Убираем Apple префикс (S)
  const clean = raw.trim()
    .replace(/^\(S\)\s*/i, '')
    .replace(/^S\/N[:\s]*/i, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  // IMEI — ровно 15 цифр
  if (/^\d{15}$/.test(clean)) {
    if (mode === 'upc') return null
    return { type: 'imei', value: clean }
  }

  // UPC/EAN — только цифры 8-14
  if (/^\d{8,14}$/.test(clean)) {
    if (mode === 'serial' || mode === 'imei') return null
    return { type: 'upc', value: clean }
  }

  // Серийник — буквы + цифры 6-15 символов
  if (/^[A-Z0-9]{6,15}$/.test(clean) && /[A-Z]/.test(clean) && /[0-9]/.test(clean)) {
    if (mode === 'upc') return null
    return { type: 'serial', value: clean }
  }

  return null
}

export default function BarcodeScanner({ onScan, onClose, mode = 'any', hint }: Props) {
  const [scanned, setScanned]   = useState(false)
  const [debugText, setDebugText] = useState('')
  const [torchOn, setTorchOn]   = useState(false)
  const [paused, setPaused]     = useState(false)
  const [manualValue, setManualValue] = useState('')

  // Форматы зависят от режима
  const formats = mode === 'upc'
    ? ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const
    : mode === 'serial' || mode === 'imei'
    ? ['code_128', 'code_39', 'qr_code', 'data_matrix'] as const
    : ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'] as const

  const handleScan = useCallback((detectedCodes: Array<{ rawValue: string; format: string }>) => {
    if (scanned) return
    for (const code of detectedCodes) {
      const parsed = classifyAndClean(code.rawValue, mode)
      setDebugText(`"${code.rawValue}" → ${parsed ? parsed.type + ':' + parsed.value : 'игнор'}`)
      if (parsed) {
        setScanned(true)
        if ('vibrate' in navigator) navigator.vibrate(120)
        onScan({ ...parsed, format: code.format })
        return
      }
    }
  }, [scanned, mode, onScan])

  function submitManual() {
    const parsed = classifyAndClean(manualValue, mode)
    if (parsed) {
      onScan({ ...parsed, format: 'manual' })
    } else if (manualValue.trim().length >= 4) {
      const type: ScanResult['type'] = mode === 'imei' ? 'imei' : mode === 'upc' ? 'upc' : 'serial'
      onScan({ type, value: manualValue.trim().toUpperCase(), format: 'manual' })
    }
  }

  const cfg = {
    upc:    { title: 'UPC / EAN',       hint: hint ?? 'Штрихкод JAN на коробке',               ex: '4549995649284'    },
    serial: { title: 'Серийный номер',  hint: hint ?? 'Штрихкод под "(S) Serial No."',          ex: 'JTCWH5YW30'      },
    imei:   { title: 'IMEI',            hint: hint ?? 'Штрихкод под "IMEI/MEID"',               ex: '350949819943691'  },
    any:    { title: 'Сканер',          hint: hint ?? 'Наведи на штрихкод',                     ex: ''                },
  }[mode]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px', paddingTop: 'calc(16px + var(--sat))',
        background: 'rgba(0,0,0,0.85)',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,0.15)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            Сканер · <span style={{ color: '#F0B90B' }}>{cfg.title}</span>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{cfg.hint}</p>
        </div>
        <button onClick={() => setTorchOn(p => !p)} style={{
          width: 40, height: 40, borderRadius: 12,
          background: torchOn ? '#F0B90B' : 'rgba(255,255,255,0.15)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={torchOn ? '#000' : 'white'} strokeWidth="2">
            <path d="M8 2h8l4 6-8 14L4 8z"/>
          </svg>
        </button>
      </div>

      {/* Сканер */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Scanner
          onScan={handleScan}
          onError={err => console.warn('Scanner error:', err)}
          formats={formats as unknown as Parameters<typeof Scanner>[0]['formats']}
          paused={paused || scanned}
          constraints={{ facingMode: 'environment' }}
          components={{
            torch: false, // управляем сами
            finder: false, // рисуем свой прицел
            zoom: false,
          }}
          styles={{
            container: { width: '100%', height: '100%' },
            video: { width: '100%', height: '100%', objectFit: 'cover' },
          }}
        />

        {/* Наш прицел поверх */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Затемнение */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            maskImage: 'radial-gradient(ellipse 300px 100px at center, transparent 0%, black 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 300px 100px at center, transparent 0%, black 100%)',
          }}/>

          {/* Рамка */}
          <div style={{ position: 'relative', width: 300, height: 100 }}>
            {[
              { top: 0,    left: 0,   borderTop: '3px solid #F0B90B', borderLeft: '3px solid #F0B90B',   borderRadius: '4px 0 0 0' },
              { top: 0,    right: 0,  borderTop: '3px solid #F0B90B', borderRight: '3px solid #F0B90B',  borderRadius: '0 4px 0 0' },
              { bottom: 0, left: 0,   borderBottom: '3px solid #F0B90B', borderLeft: '3px solid #F0B90B',   borderRadius: '0 0 0 4px' },
              { bottom: 0, right: 0,  borderBottom: '3px solid #F0B90B', borderRight: '3px solid #F0B90B',  borderRadius: '0 0 4px 0' },
            ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }}/>)}

            <div style={{
              position: 'absolute', left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg, transparent, #F0B90B, transparent)',
              animation: 'scan-line 1.8s ease-in-out infinite',
            }}/>
          </div>

          {/* Пример */}
          {cfg.ex && (
            <div style={{ position: 'absolute', top: 'calc(50% + 66px)', left: 0, right: 0, textAlign: 'center' }}>
              <span style={{
                background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.45)',
                fontSize: 11, borderRadius: 20, padding: '4px 14px', fontFamily: 'monospace',
              }}>
                {cfg.ex}
              </span>
            </div>
          )}
        </div>

        {/* Дебаг */}
        {debugText && (
          <div style={{ position: 'absolute', top: 12, left: 16, right: 16, textAlign: 'center', pointerEvents: 'none' }}>
            <span style={{
              background: 'rgba(0,0,0,0.75)', color: 'rgba(255,255,255,0.6)',
              fontSize: 10, borderRadius: 10, padding: '3px 12px', fontFamily: 'monospace',
            }}>
              {debugText}
            </span>
          </div>
        )}
      </div>

      {/* Ручной ввод */}
      <div style={{
        background: 'rgba(0,0,0,0.9)', padding: '16px',
        paddingBottom: 'calc(16px + var(--sab))',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={manualValue}
            onChange={e => setManualValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitManual()}
            placeholder={
              mode === 'upc' ? `UPC: ${cfg.ex}` :
              mode === 'imei' ? `IMEI: ${cfg.ex}` :
              `S/N: ${cfg.ex || 'JTCWH5YW30'}`
            }
            inputMode={mode === 'upc' || mode === 'imei' ? 'numeric' : 'text'}
            autoCapitalize="characters"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.1)',
              border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12,
              padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <button onClick={submitManual} disabled={manualValue.trim().length < 4} style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: manualValue.trim().length >= 4 ? '#1E6FEB' : 'rgba(255,255,255,0.1)',
            border: 'none', cursor: manualValue.trim().length >= 4 ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scan-line {
          0%   { top: 6px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 8px); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
