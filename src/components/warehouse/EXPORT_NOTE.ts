// Добавь в src/components/warehouse/WarehouseList.tsx
// Найди блок с LockedFeature "Выгрузка Excel" и замени его на:

// import ExportButton from '@/components/listings/ExportButton'
//
// ...внутри JSX замени:
//
// <LockedFeature label="Выгрузка Excel" version="v1.0">
//   <button style={{...}}>📊 Выгрузить историю сделок .xlsx</button>
// </LockedFeature>
//
// на:
//
// <ExportButton />
//
// Вот полный блок для замены в конце компонента (перед закрывающим </div>):

// { /* Excel экспорт */ }
// <div style={{ padding: '4px 0 12px' }}>
//   <ExportButton />
// </div>

export const EXPORT_REPLACEMENT_NOTE = `
Открой src/components/warehouse/WarehouseList.tsx

1. Добавь импорт вверху файла:
   import ExportButton from '@/components/listings/ExportButton'

2. Найди блок:
   <LockedFeature label="Выгрузка Excel" ...>
     <button>📊 Выгрузить историю сделок .xlsx</button>
   </LockedFeature>

3. Замени на:
   <ExportButton />

Готово — кнопка будет скачивать реальный CSV.
`
