import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Загружаем все завершённые сделки пользователя
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      listing:listings(title, brand, model, condition),
      buyer:profiles!orders_buyer_id_fkey(name, location),
      seller:profiles!orders_seller_id_fkey(name, location)
    `)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (!orders || orders.length === 0) {
    return new NextResponse('Нет данных для экспорта', { status: 200 })
  }

  // Строим CSV
  const headers = [
    'Дата',
    'Тип',
    'Товар',
    'Бренд',
    'Модель',
    'Состояние',
    'Количество',
    'Сумма (руб)',
    'Контрагент',
    'Локация контрагента',
    'Статус',
    'ID сделки',
  ]

  const rows = orders.map(o => {
    const isBuyer  = o.buyer_id === user.id
    const partner  = isBuyer ? o.seller : o.buyer
    const date     = new Date(o.created_at).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
    const price = o.counter_status === 'accepted' && o.counter_price
      ? o.counter_price : o.total_price

    return [
      date,
      isBuyer ? 'Покупка' : 'Продажа',
      o.listing?.title ?? '',
      o.listing?.brand ?? '',
      o.listing?.model ?? '',
      o.listing?.condition === 'new' ? 'Новый' : 'Б/У',
      o.quantity,
      price,
      partner?.name ?? '',
      partner?.location ?? '',
      statusLabel(o.status),
      o.id.slice(0, 8).toUpperCase(),
    ]
  })

  // Экранируем значения для CSV
  function escapeCSV(val: unknown) {
    const str = String(val ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const csv = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n')

  // BOM для корректного открытия в Excel с кириллицей
  const bom = '\uFEFF'
  const filename = `dexa-export-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: 'Ожидает', confirmed: 'Подтверждён',
    in_delivery: 'В доставке', completed: 'Завершён', cancelled: 'Отменён',
  }
  return map[s] ?? s
}
