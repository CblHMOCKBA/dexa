// src/lib/api/upc.ts
// Поиск товара по UPC/EAN штрихкоду
// Приоритет: внутренний каталог Dexa → upcitemdb → пустая форма

export type ProductData = {
  upc: string
  title: string
  brand: string | null
  model: string | null
  category: string | null
  description: string | null
  image_url: string | null
  source: 'internal' | 'upcitemdb' | 'manual'
}

// 1. Поиск в нашем каталоге (Supabase)
export async function lookupInternalCatalog(
  upc: string,
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>
): Promise<ProductData | null> {
  const { data } = await supabase
    .from('product_catalog')
    .select('*')
    .eq('upc', upc)
    .single()

  if (!data) return null

  return {
    upc: data.upc,
    title: data.title,
    brand: data.brand,
    model: data.model,
    category: data.category,
    description: data.description,
    image_url: data.image_url,
    source: 'internal',
  }
}

// 2. Запрос к upcitemdb (бесплатный план: 100 запросов/день)
export async function lookupUPCItemDB(upc: string): Promise<ProductData | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!res.ok) return null
    const data = await res.json()

    if (!data.items || data.items.length === 0) return null

    const item = data.items[0]
    return {
      upc,
      title: item.title ?? '',
      brand: item.brand ?? null,
      model: item.model ?? null,
      category: item.category ?? null,
      description: item.description ?? null,
      image_url: item.images?.[0] ?? null,
      source: 'upcitemdb',
    }
  } catch {
    return null
  }
}

// 3. Fallback: Open Product Data (если upcitemdb исчерпан)
export async function lookupOpenProductData(upc: string): Promise<ProductData | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${upc}.json`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1) return null

    const p = data.product
    return {
      upc,
      title: p.product_name ?? p.product_name_en ?? '',
      brand: p.brands ?? null,
      model: null,
      category: p.categories ?? null,
      description: null,
      image_url: p.image_url ?? null,
      source: 'upcitemdb',
    }
  } catch {
    return null
  }
}

// Главная функция — пробуем по очереди
export async function lookupProduct(
  upc: string,
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>
): Promise<ProductData | null> {
  // 1. Внутренний каталог Dexa (приоритет)
  const internal = await lookupInternalCatalog(upc, supabase)
  if (internal) return internal

  // 2. upcitemdb
  const external = await lookupUPCItemDB(upc)
  if (external) {
    // Сохраняем в наш каталог чтобы следующий раз брать из него
    await supabase.from('product_catalog').upsert({
      upc: external.upc,
      title: external.title,
      brand: external.brand,
      model: external.model,
      category: external.category,
      description: external.description,
      image_url: external.image_url,
      source: 'upcitemdb',
    }, { onConflict: 'upc' })
    return external
  }

  // 3. Open Product Data fallback
  const fallback = await lookupOpenProductData(upc)
  return fallback
}

// Валидация IMEI по алгоритму Луна
export function validateIMEI(imei: string): boolean {
  const digits = imei.replace(/\D/g, '')
  if (digits.length !== 15) return false

  let sum = 0
  for (let i = 0; i < 15; i++) {
    let d = parseInt(digits[i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}
