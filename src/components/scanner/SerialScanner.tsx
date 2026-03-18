'use client'

import { useRef, useState } from 'react'

type Props = {
  onScan: (value: string) => void
  onClose: () => void
}

// Паттерны серийников разных брендов
// Apple: JTCWH5YW30 — 10 символов, заглавные буквы + цифры
// Samsung: R58T123ABCD — похожий формат
// Xiaomi/другие: тоже буквы+цифры
function findSerial(texts: string[]): string | null {
  for (const text of texts) {
    const clean = text.trim().toUpperCase()

    // Убираем префикс Apple (S) или S/N:
    const stripped = clean
      .replace(/^\(S\)\s*/i, '')
      .replace(/^S\/N[:\s]*/i, '')
      .replace(/^SERIAL[:\s]*/i, '')
      .trim()

    // Серийник: 8-15 символов, содержит и буквы и цифры
    if (
      stripped.length >= 8 &&
      stripped.length <= 15 &&
      /[A-Z]/.test(stripped) &&
      /[0-9]/.test(stripped) &&
      /^[A-Z0-9]+$/.test(stripped)
    ) {
      return stripped
    }
  }
  return null
}

export default function SerialScanner({ onScan, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const [status, setStatus]       = useState<'loading' | 'ready' | 'capturing' | 'error'>('loading')
  const [preview, setPreview]     = useState<string | null>(null)
  const [found, setFound]         = useState<string | null>(null)
  const [notFound, setNotFound]   = useState(false)
  const [torchOn, setTorchOn]     = useState(false)

  // Запуск камеры
  useState(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    }
    start()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  })

  async function capture() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    setStatus('capturing')
    setNotFound(false)
    setFound(null)

    // Снимаем кадр в canvas
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setPreview(dataUrl)

    // Пробуем OCR через разные методы
    const serial = await tryOCR(dataUrl)

    if (serial) {
      setFound(serial)
      if ('vibrate' in navigator) navigator.vibrate(120)
    } else {
      setNotFound(true)
      setStatus('ready')
    }
  }

  async function tryOCR(dataUrl: string): Promise<string | null> {
    // Метод 1: Tesseract.js (если доступен)
    try {
      // Динамически пробуем загрузить tesseract
      const Tesseract = await import('tesseract.js').catch(() => null)
      if (Tesseract) {
        const { data } = await Tesseract.recognize(dataUrl, 'eng', {
          // Оптимизируем под серийники — только заглавные буквы и цифры
        })
        const lines = data.text.split('\n').filter(l => l.trim().length > 0)
        const serial = findSerial(lines)
        if (serial) return serial
      }
    } catch {}

    // Метод 2: Нативный Shape Detection API (только Chrome)
    // Пока не поддерживается для текста в Safari
    
    setStatus('ready')
    return null
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn(p => !p)
    } catch {}
  }

  function confirmSerial() {
    if (found) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      onScan(found)
    }
  }

  function retake() {
    setPreview(null)
    setFound(null)
    setNotFound(false)
    setStatus('ready')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px', paddingTop: 'calc(16px + var(--sat))',
        background: 'rgba(0,0,0,0.85)',
      }}>
        <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose() }}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            Сканер · <span style={{ color: '#F0B90B' }}>Серийный номер</span>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>
            Направь на строку "(S) Serial No." и нажми кнопку
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

      {/* Камера или превью */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!preview ? (
          <>
            <video ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted playsInline autoPlay />

            {/* Прицел — узкая горизонтальная полоса для одной строки текста */}
            {status === 'ready' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                  maskImage: 'radial-gradient(ellipse 320px 60px at center, transparent 0%, black 100%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 320px 60px at center, transparent 0%, black 100%)',
                }}/>
                <div style={{ position: 'relative', width: 320, height: 60 }}>
                  {[
                    { top: 0,    left: 0,   borderTop: '2px solid #F0B90B', borderLeft: '2px solid #F0B90B',   borderRadius: '3px 0 0 0' },
                    { top: 0,    right: 0,  borderTop: '2px solid #F0B90B', borderRight: '2px solid #F0B90B',  borderRadius: '0 3px 0 0' },
                    { bottom: 0, left: 0,   borderBottom: '2px solid #F0B90B', borderLeft: '2px solid #F0B90B',  borderRadius: '0 0 0 3px' },
                    { bottom: 0, right: 0,  borderBottom: '2px solid #F0B90B', borderRight: '2px solid #F0B90B', borderRadius: '0 0 3px 0' },
                  ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...s }}/>)}
                </div>

                {/* Подсказка */}
                <div style={{ position: 'absolute', top: 'calc(50% + 46px)', left: 0, right: 0, textAlign: 'center' }}>
                  <span style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.5)', fontSize: 11, borderRadius: 20, padding: '4px 14px', fontFamily: 'monospace' }}>
                    (S) JTCWH5YW30
                  </span>
                </div>
              </div>
            )}

            {status === 'loading' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTop: '3px solid #F0B90B', animation: 'spin 0.9s linear infinite' }}/>
              </div>
            )}

            {status === 'error' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>Нет доступа к камере</p>
              </div>
            )}
          </>
        ) : (
          // Превью снятого фото
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
            <img src={preview} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />

            {/* Оверлей результата */}
            {found && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ background: '#fff', borderRadius: 20, padding: '24px', margin: '0 24px', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E6F9F3', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>✅</div>
                  <p style={{ fontSize: 13, color: '#9498AB', marginBottom: 6 }}>Серийный номер</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#1A1C21', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', marginBottom: 20 }}>
                    {found}
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={retake} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #E0E1E6', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#5A5E72' }}>
                      Переснять
                    </button>
                    <button onClick={confirmSerial} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#1E6FEB', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
                      Использовать
                    </button>
                  </div>
                </div>
              </div>
            )}

            {notFound && (
              <div style={{
                position: 'absolute', bottom: 100, left: 24, right: 24,
                background: '#1A1C21', borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 20 }}>🔍</span>
                <div>
                  <p style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Серийник не найден</p>
                  <p style={{ color: '#9498AB', fontSize: 12, marginTop: 2 }}>Попробуй ещё раз или введи вручную</p>
                </div>
              </div>
            )}

            {status === 'capturing' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTop: '3px solid #F0B90B', animation: 'spin 0.9s linear infinite' }}/>
                <p style={{ color: '#fff', fontSize: 14 }}>Распознаём текст...</p>
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Нижняя панель */}
      <div style={{ background: 'rgba(0,0,0,0.9)', padding: '16px', paddingBottom: 'calc(16px + var(--sab))', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {!preview ? (
          <>
            {/* Кнопка съёмки */}
            <button onClick={capture} disabled={status !== 'ready'}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: status === 'ready' ? '#F0B90B' : 'rgba(255,255,255,0.1)',
                color: status === 'ready' ? '#000' : 'rgba(255,255,255,0.4)',
                fontSize: 16, fontWeight: 800, cursor: status === 'ready' ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 0.15s',
              }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M20 12a8 8 0 11-16 0 8 8 0 0116 0z"/>
              </svg>
              Сфотографировать серийник
            </button>

            {/* Ручной ввод */}
            <ManualSerialInput onScan={(v) => { streamRef.current?.getTracks().forEach(t => t.stop()); onScan(v) }} />
          </>
        ) : (
          !found && !status.includes('capturing') && (
            <button onClick={retake} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              ← Попробовать ещё раз
            </button>
          )
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ManualSerialInput({ onScan }: { onScan: (v: string) => void }) {
  const [value, setValue] = useState('')

  function submit() {
    const clean = value.trim().toUpperCase()
      .replace(/^\(S\)\s*/i, '')
      .replace(/^S\/N[:\s]*/i, '')
    if (clean.length >= 6) onScan(clean)
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Введи S/N вручную (JTCWH5YW30)"
        autoCapitalize="characters"
        style={{
          flex: 1, background: 'rgba(255,255,255,0.08)',
          border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 12,
          padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      />
      <button onClick={submit} disabled={value.trim().length < 6} style={{
        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
        background: value.trim().length >= 6 ? '#1E6FEB' : 'rgba(255,255,255,0.08)',
        border: 'none', cursor: value.trim().length >= 6 ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  )
}
