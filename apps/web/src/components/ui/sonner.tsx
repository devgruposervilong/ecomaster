import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      closeButton
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          '--success-bg': '#BCD86C',
          '--success-border': '#A9C65A',
          '--success-text': '#0A0A0A',
          '--error-bg': '#DC2626',
          '--error-border': '#B91C1C',
          '--error-text': '#FFFFFF',
          '--warning-bg': '#FBBF24',
          '--warning-border': '#F59E0B',
          '--warning-text': '#0A0A0A',
          '--info-bg': '#0A0A0A',
          '--info-border': '#0A0A0A',
          '--info-text': '#FFFFFF',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
