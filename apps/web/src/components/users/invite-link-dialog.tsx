import { useEffect, useState } from 'react'
import { Check, Copy, Link2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ROLE_LABELS, type InviteRow } from '@ecomaster/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/format'

export function InviteLinkDialog({
  open,
  onOpenChange,
  invite,
  url,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invite: InviteRow | null
  url: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open, url])

  if (!invite) return null

  const scope = invite.partnerName ?? 'Eco Master · acceso global'
  const message = `Hola, te comparto tu acceso al backoffice de Eco Master para ${scope}: ${url}. El enlace vence el ${formatDate(invite.expiresAt)}.`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Enlace copiado')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No pudimos copiar el enlace. Selecciónalo y cópialo manualmente.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-black/10 sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-[#BCD86C]">
            <Link2 className="size-4 text-[#0A0A0A]" />
          </div>
          <DialogTitle>Enlace de acceso listo</DialogTitle>
          <DialogDescription>
            Compártelo con {invite.email} por WhatsApp. Solo puede usarse una vez.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#0A0A0A]">{scope}</p>
              <p className="mt-0.5 text-xs text-black/45">
                {ROLE_LABELS[invite.role]} · Vence {formatDate(invite.expiresAt)}
              </p>
            </div>
            <span className="rounded-full bg-[#BCD86C] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/60">
              Pendiente
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={url}
            className="h-11 rounded-xl border-black/15 font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copy}
            className="size-11 shrink-0 rounded-xl border-black/10"
            aria-label="Copiar enlace"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        <div className="rounded-xl bg-black/[0.03] px-3.5 py-3 text-xs leading-5 text-black/45">
          Este enlace es personal. No lo reenvíes a otras personas y no lo publiques en grupos.
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-black/10"
          >
            Cerrar
          </Button>
          <Button asChild className="rounded-xl bg-[#0A0A0A] text-white hover:bg-black/85">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-4" />
              Compartir por WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
