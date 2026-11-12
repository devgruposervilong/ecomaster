import type { RefObject } from 'react'
import { useState } from 'react'
import { Loader2, ScanBarcode, Search, X } from 'lucide-react'
import type { CatalogProduct, Currency } from '@ecomaster/shared'
import { Input } from '@/components/ui/input'
import { formatAmount, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { hasActivePrice } from '@/lib/sale-preview'

export type PosCategory = {
  id: string
  name: string
  count: number
}

const CATEGORY_COLORS = [
  'bg-[#4F46E5]',
  'bg-[#2563EB]',
  'bg-[#F59E0B]',
  'bg-[#DC2626]',
  'bg-[#16A34A]',
  'bg-[#9333EA]',
  'bg-[#0EA5E9]',
  'bg-[#F97316]',
]

const CARD_TINTS = [
  { background: 'bg-[#FEF2F2]', text: 'text-[#DC2626]' },
  { background: 'bg-[#EFF6FF]', text: 'text-[#2563EB]' },
  { background: 'bg-[#FFFBEB]', text: 'text-[#D97706]' },
  { background: 'bg-[#F0FDF4]', text: 'text-[#16A34A]' },
  { background: 'bg-[#FAF5FF]', text: 'text-[#9333EA]' },
  { background: 'bg-[#F0F9FF]', text: 'text-[#0284C7]' },
]

function cardTint(product: CatalogProduct) {
  const key = product.categories[0]?.id ?? product.id
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  }
  return CARD_TINTS[hash % CARD_TINTS.length]!
}

function vesPrice(
  price: number,
  currency: Currency,
  usdRate: number | null,
  eurRate: number | null,
) {
  if (currency === 'VES') return null
  const rate = currency === 'USD' ? usdRate : eurRate
  if (!rate) return null
  return price * rate
}

export function PosCatalog({
  products,
  categories,
  totalProducts,
  currency,
  usdRate,
  eurRate,
  quantities,
  search,
  onSearchChange,
  onScan,
  searchInputRef,
  categoryId,
  onCategoryChange,
  onPick,
  canSetManualPrice,
  loading,
  error,
  truncated,
}: {
  products: CatalogProduct[]
  categories: PosCategory[]
  totalProducts: number
  currency: Currency
  usdRate: number | null
  eurRate: number | null
  quantities: Record<string, number>
  search: string
  onSearchChange: (value: string) => void
  onScan: (value: string) => void
  searchInputRef: RefObject<HTMLInputElement | null>
  categoryId: string | null
  onCategoryChange: (id: string | null) => void
  onPick: (product: CatalogProduct) => void
  canSetManualPrice: boolean
  loading: boolean
  error: boolean
  truncated: boolean
}) {
  const [scannerFocused, setScannerFocused] = useState(false)

  return (
    <div className="flex min-h-0 flex-col gap-3.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/35" />
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={() => setScannerFocused(true)}
          onBlur={() => setScannerFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            onScan(event.currentTarget.value)
          }}
          placeholder="Buscar o escanear"
          autoComplete="off"
          spellCheck={false}
          aria-label="Buscar o escanear producto"
          className={cn(
            'h-11 rounded-2xl border-black/12 bg-white pl-11 text-[13px] shadow-none focus-visible:border-black/30 focus-visible:ring-0 sm:h-12',
            search ? 'pr-36' : 'pr-28',
          )}
        />
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors',
              scannerFocused ? 'bg-[#ECF7D8] text-[#3F6212]' : 'bg-black/[0.04] text-black/45',
            )}
          >
            <ScanBarcode className="size-3.5" />
            {scannerFocused ? 'Escáner listo' : 'Escáner'}
          </span>
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="pointer-events-auto flex size-6 items-center justify-center rounded-full text-black/35 transition-colors hover:bg-black/[0.06] hover:text-black/70"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CategoryChip
          active={categoryId === null}
          label="Todos"
          count={totalProducts}
          onClick={() => onCategoryChange(null)}
        />
        {categories.map((category, index) => (
          <CategoryChip
            key={category.id}
            active={categoryId === category.id}
            label={category.name}
            count={category.count}
            dotClassName={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
            onClick={() => onCategoryChange(categoryId === category.id ? null : category.id)}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[3/4] animate-pulse rounded-2xl border border-black/[0.06] bg-black/[0.03]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-black/10 px-4 py-12 text-center text-sm text-black/55">
            No pudimos cargar los productos del canal. Recarga la página e intenta de nuevo.
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/12 px-4 py-14 text-center">
            <p className="text-sm font-medium text-[#0A0A0A]">Sin resultados</p>
            <p className="mt-1 text-[12.5px] text-black/50">
              {search
                ? `No encontramos productos para «${search.trim()}».`
                : 'Este canal todavía no tiene productos disponibles.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const selected = quantities[product.id] ?? 0
              const priced = hasActivePrice(product)
              const ves = priced ? vesPrice(product.price ?? 0, currency, usdRate, eurRate) : null
              const tint = cardTint(product)

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onPick(product)}
                  aria-label={`Agregar ${product.name} al carrito`}
                  title={product.name}
                  className={cn(
                    'group relative flex h-full flex-col gap-1.5 rounded-2xl border bg-white p-2.5 text-left transition-all',
                    'hover:-translate-y-0.5 hover:border-black/25 hover:shadow-[0_12px_28px_-22px_rgba(10,10,10,0.45)]',
                    selected > 0
                      ? 'border-[#BCD86C] bg-[#FAFDEF] ring-1 ring-[#BCD86C]/60'
                      : 'border-black/10',
                  )}
                >
                  {selected > 0 ? (
                    <span className="absolute right-2 top-2 z-10 inline-flex size-5 items-center justify-center rounded-full bg-[#0A0A0A] text-[10px] font-semibold text-white">
                      {selected}
                    </span>
                  ) : null}

                  <div
                    className={cn(
                      'flex aspect-[5/3] items-center justify-center rounded-xl',
                      tint.background,
                    )}
                  >
                    <span
                      className={cn(
                        'text-[24px] font-bold leading-none tracking-[-0.02em]',
                        tint.text,
                      )}
                    >
                      {initials(product.name)}
                    </span>
                  </div>

                  <div className="min-h-[45px]">
                    <p className="line-clamp-3 text-[11px] font-medium uppercase leading-[1.35] tracking-[0.01em] text-[#0A0A0A]">
                      {product.name}
                    </p>
                  </div>

                  <p className="text-[9px] text-black/35">SKU {product.sku}</p>

                  {priced ? (
                    <div className="mt-auto">
                      <p className="text-[13.5px] font-semibold tabular-nums text-[#0A0A0A]">
                        {formatAmount(product.price ?? 0, currency)}
                      </p>
                      {ves !== null ? (
                        <p className="text-[9.5px] tabular-nums text-black/40">
                          {formatAmount(ves, 'VES')}
                        </p>
                      ) : null}
                    </div>
                  ) : canSetManualPrice ? (
                    <div className="mt-auto rounded-lg bg-amber-50 px-1.5 py-1 text-[9.5px] font-medium text-amber-800">
                      Sin precio · manual
                    </div>
                  ) : (
                    <div className="mt-auto rounded-lg bg-black/[0.04] px-1.5 py-1 text-[9.5px] font-medium text-black/45">
                      Sin precio
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-[11px] text-black/40">
          <Loader2 className="size-3 animate-spin" /> Cargando catálogo del canal…
        </p>
      ) : truncated ? (
        <p className="text-[11px] text-black/40">
          Mostrando los primeros {totalProducts} productos del canal. Usa el buscador o el escáner
          para llegar al resto.
        </p>
      ) : null}
    </div>
  )
}

function CategoryChip({
  active,
  label,
  count,
  dotClassName,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  dotClassName?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium transition-colors',
        active
          ? 'bg-[#0A0A0A] text-white'
          : 'border border-black/10 bg-white text-black/60 hover:border-black/20 hover:text-[#0A0A0A]',
      )}
    >
      {dotClassName ? (
        <span className={cn('size-1.5 rounded-full', active ? 'bg-[#BCD86C]' : dotClassName)} />
      ) : null}
      <span className="max-w-[150px] truncate uppercase tracking-[0.02em]">{label}</span>
      <span
        className={cn(
          'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold',
          active ? 'bg-white/20 text-white' : 'bg-black/[0.06] text-black/50',
        )}
      >
        {count}
      </span>
    </button>
  )
}
