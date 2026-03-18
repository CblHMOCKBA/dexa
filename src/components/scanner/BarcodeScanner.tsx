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

// Классифицируем отсканированное значение
function classify(raw: string): ScanResult['type'] | null {
  const clean = raw.trim()

  // IMEI — ровно 15 цифр
  if (/^\d{15}$/.test(clean)) return 'imei'

  // UPC/EAN — только цифры 8-14 символов
  if (/^\d{8,14}$/.test(clean)) return 'upc'

  // Серийник Apple — буквы + цифры, 8-15 символов
  // JTCWH5YW30 — 10 символов, заглавные буквы и цифры
  if (/^[A-Z0-9]{8,15}$/.test(clean) && /[A-Z]/.test(clean) && /\d/.test(clean)) return 'serial'

  // Серийник в нижнем регистре тоже принимаем
  if (/^[a-zA-Z0-9]{8,15}$/.test(clean) && /[a-zA-Z]/.test(clean) && /\d/.test(clean)) return 'serial'

  return null
}

// Подходит ли результат для текущего режима
function matchesMode(type: ScanResult['type'], mode: Mode): boolean {
  if (mode === 'any') return true
  return type === mode
}

export default function BarcodeScanner({ onScan, onClose, mode = 'any', hint }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const animRef    = useRef<number>(0)
  const streamRef  = useRef<MediaStream | null>(null)
  const scannedRef = useRef(false)
  const readerRef  = useRef<{ reset: () => void } | null>(null)

  const [status, setStatus]     = useState<'loading' | 'scanning' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [torchOn, setTorchOn]   = useState(false)
  const [debugText, setDebugText] = useState<string>('')

  const handleResult = useCallback((raw: string, format: string) => {
    if (scannedRef.current) return

    const clean = raw.trim().toUpperCase()
    const type  = classify(clean)

    // Показываем дебаг что считали
    setDebugText(`${clean} → ${type ?? 'игнор'}`)

    if (!type || !matchesMode(type, mode)) return

    scannedRef.current = true
    if ('vibrate' in navigator) navigator.vibrate(120)
    onScan({ type, value: clean, format })
  }, [mode, onScan])

  useEffect(() => {
    let stopped = false
    scannedRef.current = false
    setDebugText('')

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
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

        // Для UPC — только штрихкоды с цифрами
        // Для serial/imei — Code128 (Apple использует именно его для S/N и IMEI)
        // Для any — всё
        if (mode === 'upc') {
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
          ])
        } else if (mode === 'serial' || mode === 'imei') {
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,  // Apple использует Code-128 для S/N и IMEI
            BarcodeFormat.CODE_39,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.DATA_MATRIX,
          ])
        } else {
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.DATA_MATRIX,
          ])
        }

        hints.set(DecodeHintType.TRY_HARDER, true)

        const reader = new BrowserMultiFormatReader(hints)
        readerRef.current = reader as unknown as { reset: () => void }

        if (!videoRef.current || stopped) return

        reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (stopped || scannedRef.current) return
          if (result) {
            handleResult(result.getText(), result.getBarcodeFormat().toString())
          }
        })
        return
      } catch (e) {
        console.warn('@zxing failed', e)
      }

      // Fallback: нативный BarcodeDetector
      if ('BarcodeDetector' in window) {
        type BDType = { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string; format: string }>> }
        const fmts = mode === 'upc'
          ? ['ean_13', 'ean_8', 'upc_a', 'upc_e']
          : mode === 'serial' || mode === 'imei'
          ? ['code_128', 'code_39', 'qr_code']
          : ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code']

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
          animRef.current = requestAnimationFrame(scan)
        }
        animRef.current = requestAnimationFrame(scan)
      }
    }

    start()
    return () => {
      stopped = true
      cancelAnimationFrame(animRef.current)
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

  const labels: Record<Mode, { title: string; hint: string; example: string; wide: boolean }> = {
    upc:    { title: 'UPC / EAN',        hint: 'Штрихкод JAN справа на коробке',               example: '4549995649284', wide: true  },
    serial: { title: 'Серийный номер',   hint: 'Штрихкод под надписью (S) Serial No.',          example: 'JTCWH5YW30',   wide: false },
    imei:   { title: 'IMEI',             hint: 'Штрихкод под надписью IMEI/MEID',                example: '350949819943691', wide: true },
    any:    { title: 'Сканер',           hint: 'Наведи на штрихкод',                            example: '',             wide: true  },
  }

  const lbl = labels[mode]
  const frameW = lbl.wide ? 280 : 200
  const frameH = lbl.wide ? 100 : 200

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px', paddingTop: 'calc(16px + var(--sat))',
        background: 'rgba(0,0,0,0.85)',
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
            Сканер · <span style={{ color: '#F0B90B' }}>{lbl.title}</span>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>
            {hint ?? lbl.hint}
          </p>
        </div>
        <button onClick={toggleTorch} style={{
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

      {/* Камера */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted playsInline autoPlay />

        {status === 'scanning' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Затемнение */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              maskImage: `radial-gradient(ellipse ${frameW}px ${frameH}px at center, transparent 0%, black 100%)`,
              WebkitMaskImage: `radial-gradient(ellipse ${frameW}px ${frameH}px at center, transparent 0%, black 100%)`,
            }}/>

            {/* Рамка прицела */}
            <div style={{ position: 'relative', width: frameW, height: frameH }}>
              {[
                { top: 0,  left: 0,  borderTop: '3px solid #F0B90B',    borderLeft: '3px solid #F0B90B',   borderRadius: '4px 0 0 0' },
                { top: 0,  right: 0, borderTop: '3px solid #F0B90B',    borderRight: '3px solid #F0B90B',  borderRadius: '0 4px 0 0' },
                { bottom: 0, left: 0,  borderBottom: '3px solid #F0B90B', borderLeft: '3px solid #F0B90B',  borderRadius: '0 0 0 4px' },
                { bottom: 0, right: 0, borderBottom: '3px solid #F0B90B', borderRight: '3px solid #F0B90B', borderRadius: '0 0 4px 0' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }}/>
              ))}
              {/* Линия сканирования */}
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, #F0B90B, transparent)',
                animation: 'scan-line 2s ease-in-out infinite',
              }}/>
            </div>

            {/* Пример значения */}
            {lbl.example && (
              <div style={{
                position: 'absolute',
                top: `calc(50% + ${frameH / 2 + 16}px)`,
                left: 0, right: 0, textAlign: 'center',
              }}>
                <span style={{
                  background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.6)',
                  fontSize: 11, borderRadius: 20, padding: '4px 14px',
                  fontFamily: 'monospace', letterSpacing: '0.05em',
                }}>
                  пример: {lbl.example}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Загрузка */}
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTop: '3px solid #F0B90B', animation: 'spin 0.9s linear infinite' }}/>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Запуск камеры...</p>
          </div>
        )}

        {/* Ошибка */}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: '#FFEBEA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📷</div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, textAlign: 'center' }}>Нет доступа к камере</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>{errorMsg}</p>
          </div>
        )}

        {/* Дебаг — что считалось */}
        {debugText !== '' && (
          <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, textAlign: 'center' }}>
            <span style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.5)', fontSize: 10, borderRadius: 10, padding: '3px 10px', fontFamily: 'monospace' }}>
              {debugText}
            </span>
          </div>
        )}
      </div>

      {/* Ручной ввод */}
      <div style={{ background: 'rgba(0,0,0,0.9)', padding: '16px', paddingBottom: 'calc(16px + var(--sab))' }}>
        <ManualInput mode={mode} onScan={onScan} example={lbl.example} />
      </div>

      <style>{`
        @keyframes scan-line {
          0%   { top: 8px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 10px); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function ManualInput({ mode, onScan, example }: {
  mode: Mode
  onScan: (r: ScanResult) => void
  example: string
}) {
  const [value, setValue] = useState('')

  const placeholders: Record<Mode, string> = {
    upc:    `UPC (напр. ${example || '4549995649284'})`,
    serial: `S/N (напр. ${example || 'JTCWH5YW30'})`,
    imei:   `IMEI (напр. ${example || '350949819943691'})`,
    any:    'Введи значение вручную...',
  }

  function submit() {
    if (!value.trim()) return
    const clean = value.trim().toUpperCase()
    const type  = classify(clean)
    const finalType: ScanResult['type'] = (type && matchesMode(type, mode)) ? type
      : mode === 'any' ? (type ?? 'serial')
      : mode as ScanResult['type']
    onScan({ type: finalType, value: clean, format: 'manual' })
    setValue('')
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholders[mode]}
        inputMode={mode === 'upc' || mode === 'imei' ? 'numeric' : 'text'}
        autoCapitalize="characters"
        style={{
          flex: 1, background: 'rgba(255,255,255,0.1)',
          border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12,
          padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none',
          fontFamily: 'var(--font-mono)',
        }}
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
