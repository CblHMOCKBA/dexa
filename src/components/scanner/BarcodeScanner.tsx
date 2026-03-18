'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

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

// Очищаем и парсим raw значение из сканера
function parseRaw(raw: string, mode: Mode): { type: ScanResult['type']; value: string } | null {
  const text = raw.trim()

  // Apple серийник: "(S) JTCWH5YW30" или "S JTCWH5YW30" или просто "JTCWH5YW30"
  if (mode === 'serial' || mode === 'any') {
    // Убираем префикс (S) который Apple печатает рядом со штрихкодом
    const appleMatch = text.match(/^\(S\)\s*([A-Z0-9]{6,20})$/i)
      || text.match(/^S\s+([A-Z0-9]{6,20})$/i)
      || text.match(/^([A-Z0-9]{6,20})$/i)

    if (appleMatch) {
      const sn = appleMatch[1].toUpperCase()
      // Серийник должен содержать и буквы и цифры
      if (/[A-Z]/.test(sn) && /\d/.test(sn) && sn.length >= 6 && sn.length <= 20) {
        return { type: 'serial', value: sn }
      }
    }
  }

  // IMEI — ровно 15 цифр
  if (mode === 'imei' || mode === 'any') {
    const imeiMatch = text.match(/\d{15}/)
    if (imeiMatch) return { type: 'imei', value: imeiMatch[0] }
  }

  // UPC/EAN — только цифры 8-14 символов
  if (mode === 'upc' || mode === 'any') {
    if (/^\d{8,14}$/.test(text)) return { type: 'upc', value: text }
  }

  return null
}

export default function BarcodeScanner({ onScan, onClose, mode = 'any', hint }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const scannedRef = useRef(false)
  const readerRef  = useRef<{ reset: () => void } | null>(null)

  const [status, setStatus]       = useState<'loading' | 'scanning' | 'error'>('loading')
  const [errorMsg, setErrorMsg]   = useState('')
  const [torchOn, setTorchOn]     = useState(false)
  const [debugText, setDebugText] = useState('')

  const handleResult = useCallback((raw: string, format: string) => {
    if (scannedRef.current) return

    const parsed = parseRaw(raw.trim(), mode)
    setDebugText(`"${raw.trim()}" → ${parsed ? parsed.type + ': ' + parsed.value : 'игнор'}`)

    if (!parsed) return

    scannedRef.current = true
    if ('vibrate' in navigator) navigator.vibrate(120)
    onScan({ ...parsed, format })
  }, [mode, onScan])

  useEffect(() => {
    let stopped = false
    scannedRef.current = false
    setDebugText('')

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('scanning')
      } catch {
        setStatus('error')
        setErrorMsg('Нет доступа к камере. Разреши доступ в настройках.')
        return
      }

      try {
        const [{ BrowserMultiFormatReader }, zxingLib] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        const { DecodeHintType, BarcodeFormat } = zxingLib
        const hints = new Map()

        if (mode === 'upc') {
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,  BarcodeFormat.UPC_E,
          ])
        } else {
          // serial и imei — оба Code-128 на коробке Apple
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.DATA_MATRIX,
            BarcodeFormat.EAN_13,   // на случай any
          ])
        }
        hints.set(DecodeHintType.TRY_HARDER, true)

        const reader = new BrowserMultiFormatReader(hints)
        readerRef.current = reader as unknown as { reset: () => void }
        if (!videoRef.current || stopped) return

        reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (stopped || scannedRef.current) return
          if (result) handleResult(result.getText(), result.getBarcodeFormat().toString())
        })
        return
      } catch (e) {
        console.warn('@zxing failed', e)
      }

      // Fallback BarcodeDetector
      if ('BarcodeDetector' in window) {
        type BDType = { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string; format: string }>> }
        const fmts = mode === 'upc'
          ? ['ean_13', 'ean_8', 'upc_a', 'upc_e']
          : ['code_128', 'code_39', 'qr_code', 'ean_13']
        const detector = new (window as unknown as { BarcodeDetector: new (o: object) => BDType }).BarcodeDetector({ formats: fmts })
        const scan = async () => {
          if (stopped || scannedRef.current) return
          const v = videoRef.current
          if (v && v.readyState >= 2) {
            try {
              const codes = await detector.detect(v)
              if (codes.length > 0) handleResult(codes[0].rawValue, codes[0].format)
            } catch {}
          }
          requestAnimationFrame(scan)
        }
        requestAnimationFrame(scan)
      }
    }

    start()
    return () => {
      stopped = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      try { readerRef.current?.reset() } catch {}
    }
  }, [handleResult, mode])

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn(p => !p)
    } catch {}
  }

  // Конфигурация прицела под каждый режим
  const cfg = {
    upc:    { title: 'UPC / EAN',      sub: hint ?? 'Штрихкод JAN справа на коробке',          w: 300, h: 90,  ex: '4549995649284'   },
    serial: { title: 'Серийный номер', sub: hint ?? 'Штрихкод под "(S) Serial No." на коробке', w: 300, h: 90,  ex: 'JTCWH5YW30'      },
    imei:   { title: 'IMEI',           sub: hint ?? 'Штрихкод под "IMEI/MEID" на коробке',      w: 300, h: 90,  ex: '350949819943691'  },
    any:    { title: 'Сканер',         sub: hint ?? 'Наведи на штрихкод',                       w: 300, h: 90,  ex: ''                },
  }[mode]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', paddingTop: 'calc(16px + var(--sat))', background: 'rgba(0,0,0,0.85)' }}>
        <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            Сканер · <span style={{ color: '#F0B90B' }}>{cfg.title}</span>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>{cfg.sub}</p>
        </div>
        <button onClick={toggleTorch} style={{ width: 40, height: 40, borderRadius: 12, background: torchOn ? '#F0B90B' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={torchOn ? '#000' : 'white'} strokeWidth="2"><path d="M8 2h8l4 6-8 14L4 8z"/></svg>
        </button>
      </div>

      {/* Камера */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline autoPlay />

        {status === 'scanning' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Затемнение — узкая горизонтальная полоса для всех режимов */}
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
              maskImage: `radial-gradient(ellipse ${cfg.w}px ${cfg.h}px at center, transparent 0%, black 100%)`,
              WebkitMaskImage: `radial-gradient(ellipse ${cfg.w}px ${cfg.h}px at center, transparent 0%, black 100%)`,
            }}/>

            {/* Рамка */}
            <div style={{ position: 'relative', width: cfg.w, height: cfg.h }}>
              {[
                { top: 0,    left: 0,   borderTop: '3px solid #F0B90B',    borderLeft: '3px solid #F0B90B',   borderRadius: '4px 0 0 0' },
                { top: 0,    right: 0,  borderTop: '3px solid #F0B90B',    borderRight: '3px solid #F0B90B',  borderRadius: '0 4px 0 0' },
                { bottom: 0, left: 0,   borderBottom: '3px solid #F0B90B', borderLeft: '3px solid #F0B90B',   borderRadius: '0 0 0 4px' },
                { bottom: 0, right: 0,  borderBottom: '3px solid #F0B90B', borderRight: '3px solid #F0B90B',  borderRadius: '0 0 4px 0' },
              ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }}/>)}
              <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #F0B90B, transparent)', animation: 'scan-line 1.8s ease-in-out infinite' }}/>
            </div>

            {/* Пример */}
            {cfg.ex && (
              <div style={{ position: 'absolute', top: `calc(50% + ${cfg.h / 2 + 14}px)`, left: 0, right: 0, textAlign: 'center' }}>
                <span style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.5)', fontSize: 11, borderRadius: 20, padding: '4px 14px', fontFamily: 'monospace' }}>
                  {cfg.ex}
                </span>
              </div>
            )}
          </div>
        )}

        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTop: '3px solid #F0B90B', animation: 'spin 0.9s linear infinite' }}/>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Запуск камеры...</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: '#FFEBEA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📷</div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, textAlign: 'center' }}>Нет доступа к камере</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>{errorMsg}</p>
          </div>
        )}

        {/* Дебаг */}
        {debugText && (
          <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, textAlign: 'center' }}>
            <span style={{ background: 'rgba(0,0,0,0.75)', color: 'rgba(255,255,255,0.55)', fontSize: 10, borderRadius: 10, padding: '3px 12px', fontFamily: 'monospace' }}>
              {debugText}
            </span>
          </div>
        )}
      </div>

      {/* Ручной ввод */}
      <div style={{ background: 'rgba(0,0,0,0.9)', padding: '16px', paddingBottom: 'calc(16px + var(--sab))' }}>
        <ManualInput mode={mode} example={cfg.ex} onScan={onScan} />
      </div>

      <style>{`
        @keyframes scan-line {
          0%   { top: 6px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 8px); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function ManualInput({ mode, example, onScan }: { mode: Mode; example: string; onScan: (r: ScanResult) => void }) {
  const [value, setValue] = useState('')

  const ph = {
    upc:    `UPC: ${example || '4549995649284'}`,
    serial: `S/N: ${example || 'JTCWH5YW30'}`,
    imei:   `IMEI: ${example || '350949819943691'}`,
    any:    'Введи значение...',
  }[mode]

  function submit() {
    const clean = value.trim().toUpperCase()
    if (!clean) return
    const parsed = parseRaw(clean, mode)
    const type: ScanResult['type'] = parsed?.type ?? (mode === 'any' ? 'serial' : mode as ScanResult['type'])
    onScan({ type, value: parsed?.value ?? clean, format: 'manual' })
    setValue('')
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={ph}
        inputMode={mode === 'upc' || mode === 'imei' ? 'numeric' : 'text'}
        autoCapitalize="characters"
        style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'var(--font-mono)' }}
      />
      <button onClick={submit} disabled={!value.trim()} style={{
        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
        background: value.trim() ? '#1E6FEB' : 'rgba(255,255,255,0.1)',
        border: 'none', cursor: value.trim() ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  )
}
