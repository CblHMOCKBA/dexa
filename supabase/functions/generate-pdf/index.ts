// supabase/functions/generate-pdf/index.ts
// Dexa · Edge Function · Генерация PDF накладной
// Deploy: supabase functions deploy generate-pdf

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { document_id } = await req.json()
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id required' }), { status: 400, headers: corsHeaders })
    }

    // Auth
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    // Загружаем документ
    const { data: doc } = await supabase
      .from('documents')
      .select(`
        *,
        owner:profiles!documents_owner_id_fkey(*),
        counterparty:counterparties(*),
        order:orders(*),
        items:document_items(*, serial_item:serial_items(*))
      `)
      .eq('id', document_id)
      .eq('owner_id', user.id)
      .single()

    if (!doc) return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: corsHeaders })

    // Генерируем HTML → конвертируем в PDF через встроенный Deno API
    // Используем jsPDF-совместимый подход через HTML
    const html = buildPDFHtml(doc)

    // Сохраняем HTML как "PDF" в storage (браузер откроет и напечатает)
    // В продакшене здесь будет puppeteer или wkhtmltopdf через внешний сервис
    // Для MVP — возвращаем HTML который браузер может распечатать как PDF
    const fileName = `${user.id}/${doc.number.replace(/-/g, '_')}.html`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, html, {
        contentType: 'text/html; charset=utf-8',
        upsert: true,
      })

    if (uploadError) throw uploadError

    // Получаем signed URL (действует 1 час)
    const { data: urlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(fileName, 3600)

    // Обновляем документ
    await supabase
      .from('documents')
      .update({ pdf_url: urlData?.signedUrl, status: 'sent' })
      .eq('id', document_id)

    return new Response(
      JSON.stringify({ url: urlData?.signedUrl, number: doc.number }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})

type DocData = {
  number: string
  type: string
  created_at: string
  sign_code: string
  owner: {
    name: string
    shop_name?: string
    location?: string
    company_name?: string
    inn?: string
    legal_address?: string
  }
  counterparty?: {
    name: string
    company?: string
    phone?: string
    inn?: string
  }
  order?: {
    total_price: number
    counter_price?: number
    counter_status?: string
    delivery_address?: string
  }
  items: Array<{
    title: string
    quantity: number
    price: number
    condition_note?: string
    serial_item?: { serial_number?: string; imei?: string }
  }>
}

function buildPDFHtml(doc: DocData): string {
  const date = new Date(doc.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const totalPrice = doc.order?.counter_status === 'accepted' && doc.order?.counter_price
    ? doc.order.counter_price
    : (doc.order?.total_price ?? doc.items.reduce((s, i) => s + i.price * i.quantity, 0))

  const typeLabel = doc.type === 'invoice' ? 'Товарная накладная'
    : doc.type === 'transfer_act' ? 'Акт приёма-передачи'
    : 'Акт о ремонте'

  const rows = doc.items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <strong>${item.title}</strong>
        ${item.serial_item?.serial_number ? `<br><small>S/N: ${item.serial_item.serial_number}</small>` : ''}
        ${item.serial_item?.imei ? `<br><small>IMEI: ${item.serial_item.imei}</small>` : ''}
        ${item.condition_note ? `<br><small>${item.condition_note}</small>` : ''}
      </td>
      <td>${item.quantity}</td>
      <td>${item.price.toLocaleString('ru-RU')} ₽</td>
      <td>${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</td>
    </tr>
  `).join('')

  const signUrl = `${Deno.env.get('APP_URL') ?? 'https://dexa.app'}/sign/${doc.sign_code}`

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel} ${doc.number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      color: #1A1C21;
      padding: 32px;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #1E6FEB; padding-bottom: 16px; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; }
    .logo span { color: #F0B90B; }
    .doc-meta { text-align: right; }
    .doc-number { font-size: 18px; font-weight: 700; color: #1A1C21; }
    .doc-date { font-size: 12px; color: #9498AB; margin-top: 4px; }
    .doc-type { font-size: 13px; color: #5A5E72; margin-top: 2px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .party { background: #F8F9FF; border-radius: 12px; padding: 16px; }
    .party-label { font-size: 10px; font-weight: 700; color: #9498AB; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .party-name { font-size: 16px; font-weight: 700; color: #1A1C21; margin-bottom: 4px; }
    .party-detail { font-size: 12px; color: #5A5E72; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #1E6FEB; color: white; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; }
    th:first-child { border-radius: 8px 0 0 8px; width: 32px; }
    th:last-child { border-radius: 0 8px 8px 0; }
    td { padding: 10px 12px; border-bottom: 1px solid #F0F1F4; font-size: 12px; vertical-align: top; }
    td small { color: #9498AB; font-size: 11px; font-family: monospace; }
    tr:last-child td { border-bottom: none; }
    .total-row { background: #F8F9FF; }
    .total-row td { font-weight: 700; font-size: 14px; padding: 14px 12px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
    .sig-block { }
    .sig-label { font-size: 11px; color: #9498AB; margin-bottom: 8px; }
    .sig-line { border-bottom: 1px solid #1A1C21; height: 32px; margin-bottom: 4px; }
    .sig-name { font-size: 11px; color: #9498AB; }
    .sign-link { margin-top: 32px; padding: 16px; background: #EBF2FF; border-radius: 12px; text-align: center; }
    .sign-link p { font-size: 12px; color: #5A5E72; margin-bottom: 8px; }
    .sign-link a { color: #1E6FEB; font-weight: 700; word-break: break-all; font-size: 12px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #F0F1F4; display: flex; justify-content: space-between; font-size: 11px; color: #9498AB; }
    @media print {
      body { padding: 16px; }
      .sign-link { display: none; }
      @page { margin: 16mm; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="logo"><span>D</span>EXA</div>
      <div style="font-size:11px;color:#9498AB;margin-top:4px;">Платформа B2B торговли электроникой</div>
    </div>
    <div class="doc-meta">
      <div class="doc-number">${doc.number}</div>
      <div class="doc-date">${date}</div>
      <div class="doc-type">${typeLabel}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Продавец</div>
      <div class="party-name">${doc.owner.company_name ?? doc.owner.name}</div>
      ${doc.owner.shop_name ? `<div class="party-detail">📍 ${doc.owner.shop_name}${doc.owner.location ? `, ${doc.owner.location}` : ''}</div>` : ''}
      ${doc.owner.inn ? `<div class="party-detail">ИНН: ${doc.owner.inn}</div>` : ''}
      ${doc.owner.legal_address ? `<div class="party-detail">${doc.owner.legal_address}</div>` : ''}
    </div>
    <div class="party">
      <div class="party-label">Покупатель</div>
      ${doc.counterparty ? `
        <div class="party-name">${doc.counterparty.company ?? doc.counterparty.name}</div>
        ${doc.counterparty.phone ? `<div class="party-detail">📞 ${doc.counterparty.phone}</div>` : ''}
        ${doc.counterparty.inn ? `<div class="party-detail">ИНН: ${doc.counterparty.inn}</div>` : ''}
      ` : '<div class="party-name" style="color:#9498AB">—</div>'}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Наименование товара</th>
        <th>Кол-во</th>
        <th>Цена</th>
        <th>Сумма</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="4" style="text-align:right">Итого:</td>
        <td>${totalPrice.toLocaleString('ru-RU')} ₽</td>
      </tr>
    </tbody>
  </table>

  ${doc.order?.delivery_address ? `
    <div style="margin-bottom:24px;padding:12px 16px;background:#F2F3F5;border-radius:10px;font-size:12px;color:#5A5E72;">
      <strong>Адрес доставки:</strong> ${doc.order.delivery_address}
    </div>
  ` : ''}

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-label">Передал (продавец)</div>
      <div class="sig-line"></div>
      <div class="sig-name">${doc.owner.name}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Принял (покупатель)</div>
      <div class="sig-line"></div>
      <div class="sig-name">${doc.counterparty?.name ?? '_______________'}</div>
    </div>
  </div>

  <div class="sign-link">
    <p>Покупатель может подписать документ онлайн по ссылке:</p>
    <a href="${signUrl}">${signUrl}</a>
  </div>

  <div class="footer">
    <span>Документ сформирован автоматически платформой DEXA</span>
    <span>${doc.number} · ${date}</span>
  </div>

</body>
</html>`
}
