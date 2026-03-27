with open('/home/claude/dexa-deal/src/components/chat/ChatWindowClient.tsx', 'r') as f:
    c = f.read()

# 1. Добавляем новые state переменные
old_state = """  const [timerMins, setTimerMins] = useState(30)
  const [orderLoading, setOrderLoading] = useState(false)
  const [myListings, setMyListings]     = useState<Listing[]>([])
  const [loadingListings, setLoadingListings] = useState(false)"""

new_state = """  const [timerMins, setTimerMins]       = useState(30)
  const [orderLoading, setOrderLoading] = useState(false)
  const [myListings, setMyListings]     = useState<Listing[]>([])
  const [loadingListings, setLoadingListings] = useState(false)
  // Расширенная форма сделки
  const [dealPrice, setDealPrice]       = useState('')
  const [dealQty, setDealQty]           = useState('1')
  const [dealPayment, setDealPayment]   = useState<'cash'|'transfer'|'crypto'|'other'>('cash')
  const [dealCourier, setDealCourier]   = useState('')
  const [dealNewCourier, setNewCourier] = useState('')
  const [showAddCourier, setShowAddCourier] = useState(false)
  const [couriers, setCouriers]         = useState<{id:string;name:string;phone:string|null}[]>([])
  const [loadingCouriers, setLoadingCouriers] = useState(false)
  const [dealComment, setDealComment]   = useState('')"""

c = c.replace(old_state, new_state)
print("State:", "dealPrice" in c)

# 2. Загружаем курьеров когда открывается панель order
old_panel_effect = """  useEffect(() => {
    if (panel !== 'share' || myListings.length > 0) return"""

new_panel_effect = """  // Загружаем курьеров при открытии панели сделки
  useEffect(() => {
    if (panel !== 'order') return
    setLoadingCouriers(true)
    const supabase = createClient()
    supabase.from('counterparties')
      .select('id, name, phone')
      .eq('type', 'courier')
      .then(({ data }) => {
        setCouriers(data ?? [])
        setLoadingCouriers(false)
      })
    // Предзаполняем цену из листинга
    if (chat.listing && !(chat.listing as Listing).price) return
    setDealPrice(String((chat.listing as Listing).price ?? ''))
  }, [panel])

  useEffect(() => {
    if (panel !== 'share' || myListings.length > 0) return"""

c = c.replace(old_panel_effect, new_panel_effect)
print("Courier load effect:", "setLoadingCouriers" in c)

# 3. Обновляем функцию createOrder
old_create = """  async function createOrder() {
    if (!chat.listing || orderLoading || !isBuyer) return
    setOrderLoading(true)
    const supabase = createClient()
    const { data: orderData, error } = await supabase.from('orders').insert({
      listing_id: chat.listing.id, chat_id: chat.id,
      buyer_id: currentUserId, seller_id: chat.seller_id,
      quantity: 1, total_price: chat.listing.price, timer_minutes: timerMins
    }).select('id,total_price').single()
    if (!error && orderData) {
      const price = orderData.total_price.toLocaleString('ru-RU')
      await send({
        text: `SYSTEM:ORDER_CREATED:${orderData.id}:${price}:${chat.listing.title}`,
        skip_display: true
      })
      setPanel('none')
      router.push('/orders')
    }
    setOrderLoading(false)
  }"""

new_create = """  async function createOrder() {
    if (!chat.listing || orderLoading || !isBuyer) return
    setOrderLoading(true)
    const supabase = createClient()

    // Если добавляем нового курьера — сначала создаём контрагента
    let finalCourierId = dealCourier
    let finalCourierName = ''
    if (showAddCourier && dealNewCourier.trim()) {
      const { data: newCp } = await supabase.from('counterparties').insert({
        name: dealNewCourier.trim(), type: 'courier',
        owner_id: currentUserId,
      }).select('id,name').single()
      if (newCp) {
        finalCourierId = newCp.id
        finalCourierName = newCp.name
        setCouriers(p => [...p, { id: newCp.id, name: newCp.name, phone: null }])
      }
    } else if (dealCourier) {
      finalCourierName = couriers.find(c => c.id === dealCourier)?.name ?? ''
    }

    const price = dealPrice ? Number(dealPrice) : (chat.listing as Listing).price
    const { data: orderData, error } = await supabase.from('orders').insert({
      listing_id:    chat.listing.id,
      chat_id:       chat.id,
      buyer_id:      currentUserId,
      seller_id:     chat.seller_id,
      quantity:      Number(dealQty) || 1,
      total_price:   price,
      timer_minutes: timerMins,
      courier_note:  finalCourierName || dealComment || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(finalCourierId ? { courier_id: finalCourierId } as any : {}),
    }).select('id,total_price').single()

    if (!error && orderData) {
      const priceStr = orderData.total_price.toLocaleString('ru-RU')
      const courierStr = finalCourierName ? ` · курьер: ${finalCourierName}` : ''
      await send({
        text: `SYSTEM:ORDER_CREATED:${orderData.id}:${priceStr}:${chat.listing.title}${courierStr}`,
        skip_display: true
      })
      setPanel('none')
      // Сбрасываем форму
      setDealPrice(''); setDealQty('1'); setDealCourier('')
      setNewCourier(''); setShowAddCourier(false); setDealComment('')
      router.push(`/orders/${orderData.id}`)
    }
    setOrderLoading(false)
  }"""

c = c.replace(old_create, new_create)
print("createOrder:", "finalCourierId" in c)

# 4. Заменяем панель order в JSX на расширенную
old_panel_jsx = """      {panel === 'order' && chat.listing && (
        <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED', padding: '14px 16px', animation: 'slide-up 0.2s var(--spring-smooth) both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>🔒 Забронировать</p>
            <button onClick={() => setPanel('none')} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F2F3F5', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21' }}>{chat.listing.title}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#1E6FEB', marginTop: 3 }}>{(chat.listing as Listing).price?.toLocaleString('ru-RU')} ₽</p>
          </div>
          <TimerSelect value={timerMins} onChange={setTimerMins} />
          <button onClick={createOrder} disabled={orderLoading} style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 12, background: '#1E6FEB', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: orderLoading ? 0.7 : 1 }}>
            {orderLoading ? 'Создаём...' : `Забронировать · ${timerMins} мин`}
          </button>
        </div>
      )}"""

new_panel_jsx = """      {panel === 'order' && chat.listing && (
        <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #E8E9ED', padding: '14px 16px', animation: 'slide-up 0.2s var(--spring-smooth) both', maxHeight: '70dvh', overflowY: 'auto' }}>

          {/* Заголовок */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1C21' }}>🤝 Провести сделку</p>
            <button onClick={() => setPanel('none')} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F2F3F5', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          {/* Товар */}
          <div style={{ background: '#F2F3F5', borderRadius: 10, padding: '10px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1C21', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.listing.title}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#00B173', flexShrink: 0, marginLeft: 8 }}>{(chat.listing as Listing).price?.toLocaleString('ru-RU')} ₽</p>
          </div>

          {/* Цена + Кол-во */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Цена ₽</p>
              <input
                type="number" value={dealPrice}
                onChange={e => setDealPrice(e.target.value)}
                placeholder={String((chat.listing as Listing).price ?? '')}
                className="input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}
              />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Кол-во</p>
              <input
                type="number" value={dealQty} min={1}
                onChange={e => setDealQty(e.target.value)}
                className="input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Метод оплаты */}
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Оплата</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['cash','💵 Нал'],['transfer','🏦 Перевод'],['crypto','₿ Крипто'],['other','📋 Другое']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setDealPayment(val)} style={{
                  padding: '6px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: dealPayment === val ? '#1E6FEB' : '#F2F3F5',
                  color: dealPayment === val ? '#fff' : '#5A5E72',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Курьер */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Курьер</p>
              <button type="button" onClick={() => setShowAddCourier(p => !p)} style={{
                fontSize: 11, fontWeight: 600, color: '#1E6FEB',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                {showAddCourier ? '← Выбрать' : '+ Новый'}
              </button>
            </div>

            {showAddCourier ? (
              <input
                value={dealNewCourier}
                onChange={e => setNewCourier(e.target.value)}
                placeholder="Имя нового курьера..."
                className="input"
              />
            ) : (
              <select
                value={dealCourier}
                onChange={e => setDealCourier(e.target.value)}
                className="input"
                style={{ color: dealCourier ? '#1A1C21' : '#9498AB' }}
              >
                <option value="">— Без курьера / самовывоз —</option>
                {loadingCouriers ? (
                  <option disabled>Загрузка...</option>
                ) : (
                  couriers.map(courier => (
                    <option key={courier.id} value={courier.id}>
                      {courier.name}{courier.phone ? ` · ${courier.phone}` : ''}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Комментарий */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9498AB', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Комментарий</p>
            <input
              value={dealComment}
              onChange={e => setDealComment(e.target.value)}
              placeholder="Адрес доставки, заметка..."
              className="input"
            />
          </div>

          <TimerSelect value={timerMins} onChange={setTimerMins} />

          {/* Итого */}
          {dealPrice && (
            <div style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 12px', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 12, color: '#9498AB' }}>Итого · {dealQty} шт</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 800, color: '#1A1C21' }}>
                {(Number(dealPrice) * (Number(dealQty) || 1)).toLocaleString('ru-RU')} ₽
              </p>
            </div>
          )}

          <button onClick={createOrder} disabled={orderLoading} style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 12, background: '#1E6FEB', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: orderLoading ? 0.7 : 1 }}>
            {orderLoading ? 'Создаём сделку...' : `🤝 Провести сделку · ${timerMins} мин`}
          </button>
        </div>
      )}"""

c = c.replace(old_panel_jsx, new_panel_jsx)
print("Panel JSX:", "Провести сделку" in c)

with open('/home/claude/dexa-deal/src/components/chat/ChatWindowClient.tsx', 'w') as f:
    f.write(c)
print("Done")
