import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { History, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { CatalogProduct, Currency, DiscountType, SaleDetail } from '@ecomaster/shared'
import { PageHeader } from '@/components/page-header'
import { PosCart, type PosLine } from '@/components/sales/pos-cart'
import { PosCatalog, type PosCategory } from '@/components/sales/pos-catalog'
import { PosCheckoutDialog, type PosPaymentDraft } from '@/components/sales/pos-checkout-dialog'
import { SaleDetailDialog } from '@/components/sales/sale-detail-dialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { apiFetch, errorMessage, jsonBody } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import { meQuery, productsQuery, salesPartnerOptionsQuery, salesRateQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { calculatePreview, hasActivePrice, normalizeSearch } from '@/lib/sale-preview'

export const Route = createFileRoute('/_app/ventas/')({
  component: PointOfSalePage,
})

const PARTNER_KEY = 'ecomaster:pos:partner'

function readStoredPartner() {
  try {
    return window.localStorage.getItem(PARTNER_KEY) ?? ''
  } catch {
    return ''
  }
}

function productMatches(product: CatalogProduct, term: string) {
  return (
    normalizeSearch(product.name).includes(term) ||
    normalizeSearch(product.sku).includes(term) ||
    normalizeSearch(product.barcode ?? '').includes(term)
  )
}

function PointOfSalePage() {
  const queryClient = useQueryClient()
  const me = useQuery(meQuery)
  const isAdmin = me.data?.user.role === 'admin'
  const isGlobal = isAdmin || me.data?.user.role === 'collaborator'

  const searchInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [selectedPartnerId, setSelectedPartnerId] = useState(readStoredPartner)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({})
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState('0')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [createdSaleId, setCreatedSaleId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const partners = useQuery(salesPartnerOptionsQuery)
  const partnerOptions = partners.data ?? []

  useEffect(() => {
    // En equipos con mouse o lector de código el foco inicial acelera el cobro;
    // en móviles dejaría el teclado abierto tapando la grilla.
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(pointer: fine)').matches) return
    searchInputRef.current?.focus()
  }, [])

  const partnerId = isGlobal
    ? selectedPartnerId || (partnerOptions[0]?.id ?? '')
    : (me.data?.partner?.id ?? partnerOptions[0]?.id ?? '')
  const partner =
    partnerOptions.find((option) => option.id === partnerId) ?? partnerOptions[0] ?? null

  const products = useQuery({
    ...productsQuery({
      channelId: partner?.channelId,
      status: 'active',
      pageSize: 500,
    }),
    enabled: Boolean(partner),
  })
  const rate = useQuery(salesRateQuery)

  const productRows = products.data?.data ?? []
  const productById = useMemo(
    () => new Map(productRows.map((product) => [product.id, product])),
    [productRows],
  )

  const categories = useMemo<PosCategory[]>(() => {
    const map = new Map<string, PosCategory>()
    for (const product of productRows) {
      for (const category of product.categories) {
        const current = map.get(category.id)
        if (current) current.count += 1
        else map.set(category.id, { id: category.id, name: category.name, count: 1 })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [productRows])

  const visibleProducts = useMemo(() => {
    const term = normalizeSearch(search)
    return productRows.filter((product) => {
      if (categoryId && !product.categories.some((category) => category.id === categoryId)) {
        return false
      }
      return term ? productMatches(product, term) : true
    })
  }, [productRows, categoryId, search])

  const lines = useMemo<PosLine[]>(() => {
    const result: PosLine[] = []
    for (const [productId, quantity] of Object.entries(quantities)) {
      const product = productById.get(productId)
      if (!product || quantity < 1) continue

      const manual = isAdmin && !hasActivePrice(product)
      let price = product.price ?? 0
      if (manual) {
        const parsed = Number((manualPrices[productId] ?? '').trim().replace(',', '.'))
        price = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
      }

      result.push({ product, quantity, price, manual })
    }
    return result
  }, [quantities, productById, manualPrices, isAdmin])

  const missingManual = lines.some(
    (line) => line.manual && (manualPrices[line.product.id] ?? '').trim() === '',
  )

  const currency: Currency = partner?.currency ?? 'USD'
  const usdRate = rate.data?.usdRate ?? null
  const eurRate = rate.data?.eurRate ?? null

  const preview = useMemo(() => {
    if (!partner || !rate.data) return null
    return calculatePreview({
      currency: partner.currency,
      usdRate: rate.data.usdRate,
      eurRate: rate.data.eurRate ?? 1,
      lines: lines.map((line) => ({
        price: line.price,
        quantity: line.quantity,
        ivaEnabled: line.product.ivaEnabled,
      })),
      discountType,
      discountValue: Number(discountValue.replace(',', '.')) || 0,
    })
  }, [partner, rate.data, lines, discountType, discountValue])

  const payableCurrencies = useMemo<Currency[]>(() => {
    if (!partner) return []
    const values: Currency[] = [partner.currency]
    if (partner.currency !== 'VES') values.push('VES')
    if (isAdmin) {
      for (const option of ['USD', 'EUR'] as Currency[]) {
        if (!values.includes(option)) values.push(option)
      }
    }
    return values
  }, [isAdmin, partner])

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = preview?.[currency]?.total ?? 0
  const totalVes = preview?.VES.total ?? 0
  const canCheckout =
    Boolean(partner) && lines.length > 0 && Boolean(rate.data) && !missingManual && total > 0

  function focusSearch() {
    searchInputRef.current?.focus()
  }

  function addProduct(productId: string, quantity = 1) {
    setQuantities((current) => ({
      ...current,
      [productId]: (current[productId] ?? 0) + quantity,
    }))
  }

  function changeQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      removeLine(productId)
      return
    }
    setQuantities((current) => ({ ...current, [productId]: Math.min(quantity, 999) }))
  }

  function removeLine(productId: string) {
    setQuantities((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
    setManualPrices((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
  }

  function resetSale() {
    setQuantities({})
    setManualPrices({})
    setDiscountType('none')
    setDiscountValue('0')
    setCheckoutError(null)
    setMobileCartOpen(false)
  }

  function changePartner(value: string) {
    setSelectedPartnerId(value)
    try {
      window.localStorage.setItem(PARTNER_KEY, value)
    } catch {
      // Sin persistencia: la selección sigue activa mientras dure la sesión.
    }
    resetSale()
    setSearch('')
    setCategoryId(null)
  }

  function pickProduct(product: CatalogProduct) {
    addProduct(product.id)
  }

  function scan(raw: string) {
    const term = normalizeSearch(raw)
    if (!term) return

    const exact = productRows.find(
      (product) =>
        normalizeSearch(product.barcode ?? '') === term || normalizeSearch(product.sku) === term,
    )
    const target = exact ?? (visibleProducts.length === 1 ? visibleProducts[0] : null)

    if (target) {
      addProduct(target.id)
      setSearch('')
      focusSearch()
      toast.success(`${target.name} agregado`, { id: 'pos-scan' })
      return
    }

    if (visibleProducts.length > 1) {
      toast.info(`Hay ${visibleProducts.length} productos que coinciden. Elige uno.`, {
        id: 'pos-scan',
      })
      return
    }

    toast.error(`No encontramos un producto con «${raw.trim()}».`, { id: 'pos-scan' })
  }

  function openCheckout() {
    if (!partner) {
      toast.error('Selecciona el aliado de la venta.')
      return
    }
    if (lines.length === 0) {
      toast.error('Agrega al menos un producto.')
      return
    }
    if (!rate.data) {
      toast.error('No hay tasa BCV disponible todavía.')
      return
    }
    if (missingManual) {
      toast.error('Indica el precio manual de los productos marcados.')
      return
    }
    setCheckoutError(null)
    setMobileCartOpen(false)
    setCheckoutOpen(true)
  }

  async function submitPayment(payment: PosPaymentDraft) {
    if (!partner) return
    setCheckoutError(null)
    setSubmitting(true)

    try {
      const response = await apiFetch<{ data: SaleDetail }>('/api/sales', {
        method: 'POST',
        body: jsonBody({
          partnerId: partner.id,
          items: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            ...(line.manual
              ? { unitPrice: (manualPrices[line.product.id] ?? '').trim().replace(',', '.') }
              : {}),
          })),
          discountType,
          discountValue: discountType === 'none' ? 0 : discountValue.replace(',', '.'),
          payment: {
            currency: payment.currency,
            method: payment.method,
            reference: payment.reference.trim() || undefined,
            notes: payment.notes.trim() || undefined,
          },
        }),
      })

      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      const created = response.data
      toast.success(
        `Venta registrada por ${formatAmount(
          created.amounts[created.currency]?.total ?? 0,
          created.currency,
        )}`,
      )
      setCheckoutOpen(false)
      setCreatedSaleId(created.id)
      setDetailOpen(true)
      resetSale()
      focusSearch()
    } catch (error) {
      setCheckoutError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const cartProps = {
    partner,
    partnerOptions,
    canSelectPartner: isGlobal,
    onPartnerChange: changePartner,
    lines,
    manualPrices,
    onQuantityChange: changeQuantity,
    onManualPriceChange: (productId: string, value: string) =>
      setManualPrices((current) => ({ ...current, [productId]: value })),
    onRemove: removeLine,
    discountType,
    onDiscountTypeChange: setDiscountType,
    discountValue,
    onDiscountValueChange: setDiscountValue,
    preview,
    currency,
    usdRate,
    eurRate,
    rateDate: rate.data?.date ?? null,
    onCheckout: openCheckout,
    onNewSale: () => {
      resetSale()
      focusSearch()
    },
    cobrarDisabled: !canCheckout,
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Operación"
        title="Punto de venta"
        description="Escanea o toca los productos para armar la cuenta. El servidor calcula los importes y congela la tasa BCV del día."
        className="hidden lg:flex"
        actions={
          <Button asChild variant="outline" className="rounded-xl border-black/15">
            <Link to="/ventas/historial">
              <History className="size-4" />
              Historial
            </Link>
          </Button>
        }
      />

      {rate.isError ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-5 text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          No hay tasa BCV disponible. Puedes armar la cuenta, pero no cobrar hasta que se registre
          la tasa del día.
        </div>
      ) : null}

      {partners.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
          No pudimos cargar los aliados disponibles. Recarga la página para intentar de nuevo.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_408px]">
        <section className="flex min-h-0 flex-col lg:h-[calc(100svh-13.5rem)] lg:min-h-[560px] lg:rounded-3xl lg:border lg:border-black/10 lg:bg-white lg:p-3.5">
          <PosCatalog
            products={visibleProducts}
            categories={categories}
            totalProducts={productRows.length}
            currency={currency}
            usdRate={usdRate}
            eurRate={eurRate}
            quantities={quantities}
            search={search}
            onSearchChange={setSearch}
            onScan={scan}
            searchInputRef={searchInputRef}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            onPick={pickProduct}
            canSetManualPrice={isAdmin}
            loading={products.isLoading || partners.isLoading || me.isLoading}
            error={products.isError}
            truncated={(products.data?.meta.total ?? 0) > productRows.length}
          />
        </section>

        <aside className="hidden lg:block lg:h-[calc(100svh-13.5rem)] lg:min-h-[560px]">
          <PosCart {...cartProps} className="h-full" onFocusSearch={focusSearch} />
        </aside>
      </div>

      <div className="h-24 lg:hidden" />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          disabled={itemCount === 0}
          className={cn(
            'flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-left transition-colors',
            itemCount > 0
              ? 'bg-[#BCD86C] text-[#0A0A0A]'
              : 'bg-black/[0.05] text-black/35',
          )}
        >
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
              itemCount > 0 ? 'bg-[#0A0A0A] text-white' : 'bg-white text-black/40',
            )}
          >
            {itemCount}
          </span>
          <span className="flex-1 text-[14px] font-semibold">Ver venta</span>
          <span className="min-w-0 text-right">
            <span className="block text-[14px] font-semibold tabular-nums">
              {formatAmount(total, currency)}
            </span>
            {currency !== 'VES' && total > 0 ? (
              <span className="block text-[10px] tabular-nums text-black/45">
                {formatAmount(totalVes, 'VES')}
              </span>
            ) : null}
          </span>
        </button>
      </div>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full max-w-md border-black/10 bg-white p-0 sm:max-w-md"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Cuenta de la venta</SheetTitle>
          </SheetHeader>
          <div className="h-full p-2">
            <PosCart
              {...cartProps}
              className="h-full rounded-2xl border-black/10"
              onFocusSearch={() => {
                setMobileCartOpen(false)
                focusSearch()
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <PosCheckoutDialog
        open={checkoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open)
          if (!open) setCheckoutError(null)
        }}
        preview={preview}
        partnerCurrency={currency}
        payableCurrencies={payableCurrencies}
        itemCount={itemCount}
        submitting={submitting}
        error={checkoutError}
        onSubmit={submitPayment}
      />

      <SaleDetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setCreatedSaleId(null)
        }}
        saleId={createdSaleId}
        showEur={isAdmin}
      />
    </div>
  )
}
