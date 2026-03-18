'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

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
  // Убираем Apple префиксы: (S), S/, SN:, и одиночную S в начале
  const clean = raw.trim()
    .replace(/^\(S\)\s*/i, '')   // (S) JTCWH5YW30
    .replace(/^S\/N[:\s#.]*/i, '') // S/N: JTCWH5YW30
    .replace(/^SN[:\s#.]*/i, '')   // SN: JTCWH5YW30
    .replace(/^S\s+/i, '')         // S JTCWH5YW30 (с пробелом)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  // Если осталась одиночная S в начале перед серийником
  // SJTCWH5YW30 → проверяем без S
  // Серийник Apple всегда начинается с буквы которая входит в сам серийник
  // Эвристика: если первая буква S и без неё длина 10-12 — убираем S

  if (/^\d{15}$/.test(value)) {
    if (mode === 'upc') return null
    return { type: 'imei', value: value }
  }
  if (/^\d{8,14}$/.test(value)) {
    if (mode === 'serial' || mode === 'imei') return null
    return { type: 'upc', value: value }
  }
  if (/^[A-Z0-9]{6,15}$/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)) {
    if (mode === 'upc') return null
    return { type: 'serial', value: value }
  }
  return null
}

export default function BarcodeScanner({ onScan, onClose, mode = 'any', hint }: Props) {
  const [scanned, setScanned]     = useState(false)
  const [debugText, setDebugText] = useState('')
  const [manualValue, setManualValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Рамка — позиция и размер (в процентах от экрана)
  const [frame, setFrame] = useState({ x: 10, y: 35, w: 80, h: 15 })
  const dragRef   = useRef<{ type: 'move' | 'resize-br' | 'resize-bl'; startX: number; startY: number; startFrame: typeof frame } | null>(null)

  const formats = mode === 'upc'
    ? ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const
    : mode === 'serial' || mode === 'imei'
    ? ['code_128', 'code_39', 'qr_code', 'data_matrix'] as const
    : ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'] as const

  const handleScan = useCallback((detectedCodes: Array<{ rawValue: string; format: string; boundingBox?: DOMRectReadOnly }>) => {
    if (scanned) return
    for (const code of detectedCodes) {
      const parsed = classifyAndClean(code.rawValue, mode)
      setDebugText(`"${code.rawValue.slice(0, 30)}" → ${parsed ? parsed.type + ':' + parsed.value : 'игнор'}`)
      if (parsed) {
        setScanned(true)
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
        onScan({ ...parsed, format: code.format })
        return
      }
    }
  }, [scanned, mode, onScan])

  // Touch handlers для перетаскивания рамки
  function onFrameTouchStart(e: React.TouchEvent, type: 'move' | 'resize-br' | 'resize-bl') {
    e.stopPropagation()
    const touch = e.touches[0]
    dragRef.current = { type, startX: touch.clientX, startY: touch.clientY, startFrame: { ...frame } }
  }

  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!dragRef.current || !containerRef.current) return
      const touch = e.touches[0]
      const rect  = containerRef.current.getBoundingClientRect()
      const dx = ((touch.clientX - dragRef.current.startX) / rect.width) * 100
      const dy = ((touch.clientY - dragRef.current.startY) / rect.height) * 100
      const sf = dragRef.current.startFrame

      if (dragRef.current.type === 'move') {
        setFrame(f => ({
          ...f,
          x: Math.max(0, Math.min(100 - sf.w, sf.x + dx)),
          y: Math.max(0, Math.min(100 - sf.h, sf.y + dy)),
        }))
      } else if (dragRef.current.type === 'resize-br') {
        setFrame(f => ({
          ...f,
          w: Math.max(20, Math.min(100 - sf.x, sf.w + dx)),
          h: Math.max(8,  Math.min(100 - sf.y, sf.h + dy)),
        }))
      } else if (dragRef.current.type === 'resize-bl') {
        const newX = Math.max(0, Math.min(sf.x + sf.w - 20, sf.x + dx))
        const newW = sf.w - (newX - sf.x)
        setFrame(f => ({
          ...f,
          x: newX,
          w: Math.max(20, newW),
          h: Math.max(8, Math.min(100 - sf.y, sf.h + dy)),
        }))
      }
    }

    function onTouchEnd() { dragRef.current = null }

    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Mouse поддержка для десктопа
  function onFrameMouseDown(e: React.MouseEvent, type: 'move' | 'resize-br' | 'resize-bl') {
    e.stopPropagation()
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, startFrame: { ...frame } }

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dx = ((ev.clientX - dragRef.current.startX) / rect.width) * 100
      const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100
      const sf = dragRef.current.startFrame

      if (dragRef.current.type === 'move') {
        setFrame(f => ({
          ...f,
          x: Math.max(0, Math.min(100 - sf.w, sf.x + dx)),
          y: Math.max(0, Math.min(100 - sf.h, sf.y + dy)),
        }))
      } else if (dragRef.current.type === 'resize-br') {
        setFrame(f => ({
          ...f,
          w: Math.max(20, Math.min(100 - sf.x, sf.w + dx)),
          h: Math.max(8,  Math.min(100 - sf.y, sf.h + dy)),
        }))
      } else if (dragRef.current.type === 'resize-bl') {
        const newX = Math.max(0, Math.min(sf.x + sf.w - 20, sf.x + dx))
        const newW = sf.w - (newX - sf.x)
        setFrame(f => ({
          ...f,
          x: newX,
          w: Math.max(20, newW),
          h: Math.max(8, Math.min(100 - sf.y, sf.h + dy)),
        }))
      }
    }

    function onMouseUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

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
    upc:    { title: 'UPC / EAN',      color: '#2AABEE', ex: '4549995649284'   },
    serial: { title: 'Серийный номер', color: '#F0B90B', ex: 'JTCWH5YW30'     },
    imei:   { title: 'IMEI',           color: '#00B173', ex: '350949819943691' },
    any:    { title: 'Сканер',         color: '#F0B90B', ex: ''               },
  }[mode]

  const accentColor = cfg.color

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', paddingTop: 'calc(12px + var(--sat))',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        flexShrink: 0, zIndex: 10,
      }}>
        <button onClick={onClose} style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'rgba(255,255,255,0.12)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
            Сканер · <span style={{ color: accentColor }}>{cfg.title}</span>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>
            {hint ?? 'Перемести рамку на нужный штрихкод'}
          </p>
        </div>

        {/* Пример значения */}
        {cfg.ex && (
          <div style={{
            background: 'rgba(255,255,255,0.08)', borderRadius: 8,
            padding: '4px 10px',
          }}>
            <p style={{ color: accentColor, fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>
              {cfg.ex}
            </p>
          </div>
        )}
      </div>

      {/* Камера + рамка */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Видео через yudiel */}
        <Scanner
          onScan={handleScan}
          onError={err => console.warn('Scanner:', err)}
          formats={formats as unknown as Parameters<typeof Scanner>[0]['formats']}
          paused={scanned}
          constraints={{ facingMode: 'environment' }}
          components={{ torch: false, finder: false, zoom: false }}
          styles={{
            container: { width: '100%', height: '100%' },
            video: { width: '100%', height: '100%', objectFit: 'cover' },
          }}
        />

        {/* Затемнение с дыркой под рамку */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'rgba(0,0,0,0.55)',
          maskImage: `
            radial-gradient(ellipse at ${frame.x + frame.w / 2}% ${frame.y + frame.h / 2}%,
              transparent ${Math.min(frame.w, frame.h) * 0.3}%,
              black 100%
            )
          `,
          WebkitMaskImage: `
            radial-gradient(ellipse at ${frame.x + frame.w / 2}% ${frame.y + frame.h / 2}%,
              transparent ${Math.min(frame.w, frame.h) * 0.3}%,
              black 100%
            )
          `,
        }}/>

        {/* Рамка — перетаскиваемая */}
        <div
          style={{
            position: 'absolute',
            left: `${frame.x}%`,
            top: `${frame.y}%`,
            width: `${frame.w}%`,
            height: `${frame.h}%`,
            cursor: 'move',
            touchAction: 'none',
          }}
          onMouseDown={e => onFrameMouseDown(e, 'move')}
          onTouchStart={e => onFrameTouchStart(e, 'move')}
        >
          {/* Угловые маркеры */}
          {[
            { top: -1, left: -1,   borderTop: `3px solid ${accentColor}`, borderLeft: `3px solid ${accentColor}`,   borderRadius: '3px 0 0 0' },
            { top: -1, right: -1,  borderTop: `3px solid ${accentColor}`, borderRight: `3px solid ${accentColor}`,  borderRadius: '0 3px 0 0' },
            { bottom: -1, left: -1,  borderBottom: `3px solid ${accentColor}`, borderLeft: `3px solid ${accentColor}`,   borderRadius: '0 0 0 3px' },
            { bottom: -1, right: -1, borderBottom: `3px solid ${accentColor}`, borderRight: `3px solid ${accentColor}`,  borderRadius: '0 0 3px 0' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...s }}/>
          ))}

          {/* Горизонтальные линии рамки */}
          <div style={{ position: 'absolute', top: -1, left: 20, right: 20, height: 1, background: `rgba(${accentColor === '#F0B90B' ? '240,185,11' : accentColor === '#2AABEE' ? '42,171,238' : '0,177,115'},0.4)` }}/>
          <div style={{ position: 'absolute', bottom: -1, left: 20, right: 20, height: 1, background: `rgba(${accentColor === '#F0B90B' ? '240,185,11' : accentColor === '#2AABEE' ? '42,171,238' : '0,177,115'},0.4)` }}/>

          {/* Линия сканирования */}
          <div style={{
            position: 'absolute', left: 4, right: 4, height: 2,
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            animation: 'scan-line 1.6s ease-in-out infinite',
            boxShadow: `0 0 8px ${accentColor}`,
          }}/>

          {/* Иконка перемещения в центре */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.4, pointerEvents: 'none',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5">
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M12 3v18M3 12h18"/>
            </svg>
          </div>

          {/* Ручка resize правый нижний */}
          <div
            style={{
              position: 'absolute', bottom: -12, right: -12,
              width: 28, height: 28, borderRadius: 8,
              background: accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'se-resize', touchAction: 'none', zIndex: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
            onMouseDown={e => onFrameMouseDown(e, 'resize-br')}
            onTouchStart={e => onFrameTouchStart(e, 'resize-br')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </div>

          {/* Ручка resize левый нижний */}
          <div
            style={{
              position: 'absolute', bottom: -12, left: -12,
              width: 28, height: 28, borderRadius: 8,
              background: accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'sw-resize', touchAction: 'none', zIndex: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
            onMouseDown={e => onFrameMouseDown(e, 'resize-bl')}
            onTouchStart={e => onFrameTouchStart(e, 'resize-bl')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <polyline points="9 3 3 3 3 9"/><polyline points="15 21 21 21 21 15"/>
              <line x1="3" y1="3" x2="10" y2="10"/><line x1="21" y1="21" x2="14" y2="14"/>
            </svg>
          </div>
        </div>

        {/* Дебаг */}
        {debugText && (
          <div style={{
            position: 'absolute', top: 8, left: 16, right: 16,
            textAlign: 'center', pointerEvents: 'none', zIndex: 5,
          }}>
            <span style={{
              background: 'rgba(0,0,0,0.8)', color: 'rgba(255,255,255,0.7)',
              fontSize: 10, borderRadius: 10, padding: '3px 12px',
              fontFamily: 'monospace',
            }}>
              {debugText}
            </span>
          </div>
        )}

        {/* Подсказка снизу рамки */}
        <div style={{
          position: 'absolute',
          top: `${frame.y + frame.h + 2}%`,
          left: `${frame.x}%`,
          width: `${frame.w}%`,
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 10,
            fontFamily: 'monospace',
          }}>
            {cfg.ex}
          </span>
        </div>
      </div>

      {/* Нижняя панель */}
      <div style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        padding: '12px 16px',
        paddingBottom: 'calc(12px + var(--sab))',
        flexShrink: 0,
      }}>
        {/* Подсказка по режиму */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, justifyContent: 'center' }}>
          {mode === 'serial' && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              Перемести рамку на строку с серийником · потяни углы чтобы изменить размер
            </span>
          )}
          {mode === 'upc' && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              Наведи горизонтальную рамку на штрихкод UPC/EAN
            </span>
          )}
          {mode === 'imei' && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              Наведи рамку на штрихкод IMEI
            </span>
          )}
        </div>

        {/* Ручной ввод */}
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={manualValue}
            onChange={e => setManualValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitManual()}
            placeholder={
              mode === 'upc' ? 'Введи UPC вручную...' :
              mode === 'imei' ? 'Введи IMEI вручную...' :
              'Введи S/N вручную...'
            }
            inputMode={mode === 'upc' || mode === 'imei' ? 'numeric' : 'text'}
            autoCapitalize="characters"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.08)',
              border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 12,
              padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
            onFocus={e => { e.target.style.borderColor = accentColor }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)' }}
          />
          <button onClick={submitManual} disabled={manualValue.trim().length < 4} style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: manualValue.trim().length >= 4 ? '#1E6FEB' : 'rgba(255,255,255,0.08)',
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
          0%   { top: 4px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 6px); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
