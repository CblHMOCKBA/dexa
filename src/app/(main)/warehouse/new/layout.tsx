// FIX: этот layout убирает BottomNav для экрана создания товара
// и добавляет padding снизу чтобы кнопка "Добавить" не перекрывалась
export default function NewListingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg)' }}>
      {children}
    </div>
  )
}
