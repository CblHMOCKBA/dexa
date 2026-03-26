'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DONE   = { bg: 'rgba(0,177,115,0.2)',    color: '#00B173',              label: '✓' }
const NOW    = { bg: 'rgba(240,185,11,0.2)',    color: '#F0B90B',              label: '→' }
const NEXT   = { bg: 'rgba(30,111,235,0.15)',   color: '#1E6FEB',              label: '◎' }
const FUTURE = { bg: 'rgba(255,255,255,0.06)',  color: 'rgba(255,255,255,0.3)', label: '○' }

type Item = { title: string; desc: string; s: typeof DONE }
type Block = {
  icon: string; iconBg: string; title: string; subtitle: string
  items: Item[]
  monetization?: { label: string; value: string }[]
}
type Phase = { label: string; dot: string; blocks: Block[] }

const PHASES: Phase[] = [
  {
    label: 'Блок 1', dot: '#E8251F',
    blocks: [{
      icon: '🏪', iconBg: 'rgba(232,37,31,0.15)', title: 'P2P Биржа', subtitle: 'Торговая лента + ордера',
      items: [
        { title: 'Торговая лента + фильтры', desc: 'Realtime карточки, поиск, избранное', s: DONE },
        { title: 'P2P ордера (Bybit-модель)', desc: 'Статусы, таймер, апрув обеих сторон', s: DONE },
        { title: 'Торг (counter-offer)', desc: 'До 3 раундов переговоров по цене', s: DONE },
        { title: 'Быстрая сделка из склада', desc: 'Выбрать S/N → контрагент → провести', s: DONE },
        { title: 'Запросы покупателей', desc: '"Ищу iPhone 15 Pro" — продавцы откликаются', s: NOW },
        { title: 'Прайс-индекс', desc: 'Рыночная цена из реальных сделок платформы', s: NEXT },
        { title: 'Оптовые запросы', desc: 'Запрос на партию + отклики из складов', s: NEXT },
        { title: 'Гарант-сервис (эскроу)', desc: 'Третья сторона держит средства до подтверждения', s: FUTURE },
        { title: 'Крипто-трансфер', desc: 'Оплата внутри платформы', s: FUTURE },
      ],
      monetization: [
        { label: 'Комиссия с закрытой сделки', value: '0.5–1%' },
        { label: 'Гарант-сервис', value: '1.5%' },
      ],
    }],
  },
  {
    label: 'Блок 2', dot: '#2AABEE',
    blocks: [{
      icon: '💬', iconBg: 'rgba(42,171,238,0.15)', title: 'Мессенджер', subtitle: 'Независимый от Telegram',
      items: [
        { title: 'P2P чаты + контекст товара', desc: 'Диалог привязан к карточке, Realtime', s: DONE },
        { title: 'Групповые чаты + комнаты', desc: '"Apple сегодня", "Samsung оптом"', s: DONE },
        { title: 'Статус онлайн + непрочитанные', desc: 'Счётчики на вкладке, последний раз в сети', s: DONE },
        { title: 'Быстрый шер карточки товара', desc: 'Отправить карточку в любой чат', s: NOW },
        { title: 'Реакции на сообщения', desc: 'Быстрый отклик без текста — как в Telegram', s: NEXT },
        { title: 'Папки чатов', desc: 'Покупатели / Поставщики / Курьеры', s: NEXT },
        { title: 'Голосовые сообщения', desc: 'Дилеры чаще говорят чем пишут', s: NEXT },
        { title: 'E2E шифрование', desc: 'Конфиденциальность переговоров о ценах', s: FUTURE },
        { title: 'Бот-ассистент в чате', desc: 'Подсказывает рыночную цену прямо в диалоге', s: FUTURE },
      ],
    }],
  },
  {
    label: 'Блок 3', dot: '#00B173',
    blocks: [{
      icon: '📦', iconBg: 'rgba(0,177,115,0.15)', title: 'Складской учёт', subtitle: 'Замена тетрадки и Excel',
      items: [
        { title: 'CRUD товаров + серийный учёт', desc: 'S/N, IMEI, история каждого устройства', s: DONE },
        { title: 'Авто-списание при сделке', desc: 'Закрыл ордер → склад обновился автоматически', s: DONE },
        { title: 'Сканер штрихкода + UPC каталог', desc: 'Навёл камеру — поля заполнились', s: DONE },
        { title: 'Себестоимость + маржа + мин. остаток', desc: 'Видишь прибыль по каждому товару', s: DONE },
        { title: 'Алерты низкого остатка', desc: 'Пуш когда товар заканчивается', s: NOW },
        { title: 'Закупки от поставщиков', desc: 'Создать заказ → принять партию → S/N в системе', s: NEXT },
        { title: 'Аналитика склада', desc: 'Оборачиваемость, топ товары, маржа за период', s: NEXT },
        { title: 'Мультисклад', desc: 'Несколько точек / павильонов у одного дилера', s: FUTURE },
      ],
      monetization: [
        { label: 'Подписка (базовый склад)', value: '2 000₽/мес' },
        { label: 'Про (аналитика + мультисклад)', value: '5 000₽/мес' },
      ],
    }],
  },
  {
    label: 'Блок 4', dot: '#F0B90B',
    blocks: [{
      icon: '📋', iconBg: 'rgba(240,185,11,0.15)', title: 'Убийца 1С', subtitle: 'Финансы + документооборот',
      items: [
        { title: 'Накладные PDF + онлайн-подписание', desc: 'Генерация за 1 клик, покупатель подписывает по ссылке', s: DONE },
        { title: 'Контрагенты + история платежей', desc: 'Баланс, долги, кредитные лимиты', s: DONE },
        { title: 'Акты сверки с контрагентами', desc: 'PDF из истории платежей. Кто кому сколько должен', s: NOW },
        { title: 'Налоговый калькулятор УСН 6%', desc: 'Выручка × 6% = к уплате. Напоминание до дедлайна', s: NEXT },
        { title: 'КУДиР (Книга учёта доходов)', desc: 'Обязательный документ ИП — генерируется автоматически', s: NEXT },
        { title: 'Декларация УСН', desc: 'PDF по форме КНД 1152017. Скачал — отнёс в налоговую', s: NEXT },
        { title: 'Интеграция с банками', desc: 'Автосверка выписки. Тинькофф / Сбер API', s: FUTURE },
        { title: 'Отправка в ФНС через API', desc: 'Прямая подача декларации без визита', s: FUTURE },
      ],
      monetization: [
        { label: 'Бухгалтер сейчас берёт', value: '5–15к₽/кв.' },
        { label: 'Наша подписка Про', value: '5 000₽/мес' },
        { label: 'Экономия дилера', value: '~60%' },
      ],
    }],
  },
]

const TIMELINE = [
  { period: 'Сейчас', label: 'MVP\nГорбушка', active: true },
  { period: 'Q2 2026', label: '100\nдилеров', active: false },
  { period: 'Q3 2026', label: 'Подписка\nплатная', active: false },
  { period: 'Q4 2026', label: 'Эскроу\n+ Биржа', active: false },
  { period: '2027', label: 'Все рынки\nРФ + СНГ', active: false },
]

export default function RoadmapClient() {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const router = useRouter()

  function toggle(key: string) {
    setOpen(p => ({ ...p, [key]: !p[key] }))
  }

  const S = {
    body: { padding: '16px', paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' },
    timeline: { display: 'flex', gap: 8, overflowX: 'auto' as const, marginBottom: 20, paddingBottom: 4 },
    tItem: (active: boolean): React.CSSProperties => ({
      flexShrink: 0, borderRadius: 12, padding: '10px 14px', minWidth: 100, textAlign: 'center',
      background: active ? 'rgba(30,111,235,0.12)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? 'rgba(30,111,235,0.35)' : 'rgba(255,255,255,0.08)'}`,
    }),
    tPeriod: (active: boolean): React.CSSProperties => ({
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      color: active ? '#1E6FEB' : 'rgba(255,255,255,0.3)', marginBottom: 5,
    }),
    tLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.35 },
    legend: { display: 'flex', gap: 14, flexWrap: 'wrap' as const, marginBottom: 20 },
    phaseLabel: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 24 },
    block: (isOpen: boolean): React.CSSProperties => ({
      background: 'rgba(255,255,255,0.04)', borderRadius: 16, marginBottom: 10,
      border: `1px solid ${isOpen ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
      overflow: 'hidden',
    }),
    blockHeader: {
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer',
    },
    itemRow: {
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0A0F' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0A0A0F',
      }}>
        <button onClick={() => router.back()} style={{
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: 'rgba(255,255,255,0.08)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Roadmap</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Product · Март 2026</p>
        </div>
      </div>

      <div style={S.body}>

      {/* Timeline */}
      <div style={S.timeline}>
        {TIMELINE.map(t => (
          <div key={t.period} style={S.tItem(t.active)}>
            <div style={S.tPeriod(t.active)}>{t.period}</div>
            <div style={S.tLabel}>{t.label.split('\n').map((l, i) => <span key={i}>{l}{i === 0 && <br/>}</span>)}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={S.legend}>
        {[
          { dot: '#00B173', label: 'Готово' },
          { dot: '#F0B90B', label: 'В работе' },
          { dot: '#1E6FEB', label: 'Следующий' },
          { dot: 'rgba(255,255,255,0.2)', label: 'Планируем' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 3, background: l.dot }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Phases */}
      {PHASES.map(phase => (
        <div key={phase.label}>
          <div style={S.phaseLabel}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: phase.dot }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
              {phase.label}
            </span>
          </div>

          {phase.blocks.map(block => {
            const key = block.title
            const isOpen = !!open[key]
            return (
              <div key={key} style={S.block(isOpen)}>
                <div style={S.blockHeader} onClick={() => toggle(key)}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: block.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                    {block.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{block.title}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{block.subtitle}</p>
                  </div>
                  <span style={{
                    color: 'rgba(255,255,255,0.3)', fontSize: 18,
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    display: 'inline-block',
                  }}>▾</span>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ paddingTop: 12 }}>
                      {block.items.map((item, i) => (
                        <div key={i} style={{ ...S.itemRow, ...(i === block.items.length - 1 ? { borderBottom: 'none' } : {}) }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                            background: item.s.bg, color: item.s.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, marginTop: 1,
                          }}>
                            {item.s.label}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
                              {item.title}
                            </p>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, lineHeight: 1.4 }}>
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {block.monetization && (
                      <div style={{
                        marginTop: 12, background: 'rgba(240,185,11,0.07)',
                        border: '1px solid rgba(240,185,11,0.2)', borderRadius: 12, padding: '12px 14px',
                      }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#F0B90B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                          💰 Монетизация блока
                        </p>
                        {block.monetization.map((m, i) => (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '4px 0', fontSize: 12, color: 'rgba(255,255,255,0.6)',
                            borderBottom: i < block.monetization!.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          }}>
                            <span>{m.label}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F0B90B', fontSize: 12 }}>
                              {m.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
    </div>
  )
}
