'use client'

import { useRef, useState, useEffect } from 'react'

type Props = {
  onScan: (value: string) => void
  onClose: () => void
}

function cleanSerial(raw: string): string | null {
  const text = raw.trim().toUpperCase()
    .replace(/^\(S\)\s*/i, '')
    .replace(/^S\/N[:\s]*/i, '')
    .replace(/^SERIAL[:\s#.]*/i, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim()

  // Серийник Apple: 10-12 символов, буквы + цифры
  if (
    text.length >= 8 && text.length <= 15 &&
    /[A-Z]/.test(text) && /[0-9]/.test(text)
  ) {
    return text
  }
  return null
}

export default function SerialScanner({ onScan, onClose }: Props) {
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const liveTextRef   = useRef<HTMLInputElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const [mode, setMode]         = useState<'choose' | 'livetext' | 'photo' | 'processing' | 'result' | 'notfound'>('choose')
  const [result, setResult]     = useState('')
  const [preview, setPreview]   = useState<string | null>(null)
  const [manualValue, setManualValue] = useState('')

  // Live Text — фокус на инпут, iOS сам предлагает сканировать текст камерой
  function openLiveText() {
    setMode('livetext')
    setTimeout(() => liveTextRef.current?.focus(), 100)
  }

  function handleLiveTextInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    const serial = cleanSerial(val)
    if (serial) {
      setResult(serial)
      setMode('result')
    } else {
      setManualValue(val.toUpperCase())
    }
  }

  // Фото — снимаем через input[type=file capture] и читаем через canvas
  function openPhoto() {
    fileInputRef.current?.click()
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setMode('processing')

    // Показываем превью
    const url = URL.createObjectURL(file)
    setPreview(url)

    // Пробуем BarcodeDetector на фото (читает Code-128 с фото лучше чем с видео)
    if ('BarcodeDetector' in window) {
      try {
        type BDType = {
          detect: (img: HTMLImageElement) => Promise<Array<{ rawValue: string; format: string }>>
        }
        const detector = new (window as unknown as { BarcodeDetector: new (o: object) => BDType }).BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'data_matrix'],
        })

        const img = new Image()
        img.src = url
        await new Promise(r => { img.onload = r })

        const codes = await detector.detect(img)
        for (const code of codes) {
          const serial = cleanSerial(code.rawValue)
          if (serial) {
            setResult(serial)
            setMode('result')
            URL.revokeObjectURL(url)
            return
          }
        }
      } catch {}
    }

    // Если BarcodeDetector не помог — показываем фото с ручным вводом
    setMode('notfound')
  }

  function confirmResult(val?: string) {
    const final = val ?? result
    if (final) {
      onScan(final.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    }
  }

  function submitManual() {
    const serial = cleanSerial(manualValue)
    if (serial) confirmResult(serial)
    else if (manualValue.length >= 6) confirmResult(manualValue.toUpperCase())
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#0A0A0F', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px', paddingTop: 'calc(16px + var(--sat))',
        background: 'rgba(0,0,0,0.8)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button onClick={onClose} style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,0.1)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            Серийный номер
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 }}>
            напр. JTCWH5YW30
          </p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Выбор метода ── */}
        {mode === 'choose' && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
              Выбери способ ввода серийного номера
            </p>

            {/* Live Text — самый надёжный на iPhone */}
            <button onClick={openLiveText} style={{
              width: '100%', padding: '18px 16px', borderRadius: 16,
              background: 'rgba(240,185,11,0.12)', border: '1.5px solid rgba(240,185,11,0.3)',
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 32, lineHeight: 1 }}>📷</span>
              <div>
                <p style={{ color: '#F0B90B', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                  Live Text — навести камеру
                </p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.4 }}>
                  iOS распознаёт текст прямо с коробки. Нажми иконку камеры в поле ввода.
                </p>
              </div>
            </button>

            {/* Фото */}
            <button onClick={openPhoto} style={{
              width: '100%', padding: '18px 16px', borderRadius: 16,
              background: 'rgba(30,111,235,0.1)', border: '1.5px solid rgba(30,111,235,0.25)',
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 32, lineHeight: 1 }}>🔍</span>
              <div>
                <p style={{ color: '#1E6FEB', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                  Сфотографировать штрихкод
                </p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.4 }}>
                  Сделай чёткое фото строки с серийником
                </p>
              </div>
            </button>

            {/* Ручной ввод */}
            <div style={{ marginTop: 4 }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                или введи вручную
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={manualValue}
                  onChange={e => setManualValue(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && submitManual()}
                  placeholder="JTCWH5YW30"
                  autoCapitalize="characters"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.08)',
                    border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12,
                    padding: '13px 16px', color: '#fff', fontSize: 16,
                    outline: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#F0B90B' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)' }}
                />
                <button onClick={submitManual} disabled={manualValue.length < 6} style={{
                  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                  background: manualValue.length >= 6 ? '#1E6FEB' : 'rgba(255,255,255,0.08)',
                  border: 'none', cursor: manualValue.length >= 6 ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Live Text режим ── */}
        {mode === 'livetext' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'rgba(240,185,11,0.08)', border: '1px solid rgba(240,185,11,0.2)', borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ color: '#F0B90B', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                Как использовать Live Text:
              </p>
              <ol style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                <li>Нажми на поле ввода ниже</li>
                <li>Нажми иконку 📷 в правом углу клавиатуры</li>
                <li>Наведи камеру на строку Serial No.</li>
                <li>Нажми "Вставить"</li>
              </ol>
            </div>

            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Серийный номер
              </p>
              <input
                ref={liveTextRef}
                value={manualValue}
                onChange={handleLiveTextInput}
                onKeyDown={e => e.key === 'Enter' && submitManual()}
                placeholder="Вставь или введи S/N"
                autoCapitalize="characters"
                autoComplete="off"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.08)',
                  border: '2px solid #F0B90B', borderRadius: 14,
                  padding: '16px', color: '#fff', fontSize: 20,
                  outline: 'none', fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em', textAlign: 'center',
                }}
              />
              {manualValue && (
                <p style={{ color: cleanSerial(manualValue) ? '#00B173' : '#F5A623', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                  {cleanSerial(manualValue) ? `✓ Серийник: ${cleanSerial(manualValue)}` : 'Проверяем формат...'}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setMode('choose')} style={{
                flex: 1, padding: '13px', borderRadius: 12,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer',
              }}>
                ← Назад
              </button>
              <button onClick={submitManual} disabled={manualValue.length < 6} style={{
                flex: 2, padding: '13px', borderRadius: 12, border: 'none',
                background: manualValue.length >= 6 ? '#1E6FEB' : 'rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: manualValue.length >= 6 ? 'pointer' : 'default',
              }}>
                Использовать
              </button>
            </div>
          </div>
        )}

        {/* ── Обработка фото ── */}
        {mode === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
            {preview && <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 12 }} />}
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #F0B90B', animation: 'spin 0.9s linear infinite' }}/>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Ищем серийник...</p>
          </div>
        )}

        {/* ── Результат ── */}
        {mode === 'result' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: '#E6F9F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              ✅
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 8 }}>Серийный номер</p>
              <p style={{ color: '#fff', fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                {result}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button onClick={() => { setResult(''); setPreview(null); setMode('choose') }} style={{
                flex: 1, padding: '13px', borderRadius: 12,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer',
              }}>
                Переснять
              </button>
              <button onClick={() => confirmResult()} style={{
                flex: 2, padding: '13px', borderRadius: 12, border: 'none',
                background: '#1E6FEB', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                ✓ Использовать
              </button>
            </div>
          </div>
        )}

        {/* ── Не найдено ── */}
        {mode === 'notfound' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {preview && <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 12 }} />}
            <div style={{ background: 'rgba(232,37,31,0.1)', border: '1px solid rgba(232,37,31,0.2)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ color: '#FF6B6B', fontWeight: 600, fontSize: 14 }}>Штрихкод не распознан</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                Попробуй Live Text или введи вручную
              </p>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8 }}>Серийный номер с коробки:</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={manualValue}
                  onChange={e => setManualValue(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && submitManual()}
                  placeholder="JTCWH5YW30"
                  autoCapitalize="characters"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.08)',
                    border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12,
                    padding: '13px 16px', color: '#fff', fontSize: 16,
                    outline: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#F0B90B' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)' }}
                />
                <button onClick={submitManual} disabled={manualValue.length < 6} style={{
                  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                  background: manualValue.length >= 6 ? '#1E6FEB' : 'rgba(255,255,255,0.08)',
                  border: 'none', cursor: manualValue.length >= 6 ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setMode('choose'); setPreview(null) }} style={{
                flex: 1, padding: '12px', borderRadius: 12,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer',
              }}>
                ← Назад
              </button>
              <button onClick={openLiveText} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                background: 'rgba(240,185,11,0.15)', color: '#F0B90B',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                📷 Live Text
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Скрытые инпуты */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhoto}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
