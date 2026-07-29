import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'

export type ButtonVariant = 'primary' | 'neutral' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong',
  neutral: 'border border-line bg-surface-raised text-ink hover:border-line-strong hover:bg-overlay',
  danger: 'border border-line bg-surface-raised text-danger hover:border-line-strong hover:bg-overlay',
  ghost: 'text-ink-muted hover:bg-surface-raised hover:text-ink',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-7 text-lg',
}

export function buttonClasses(variant: ButtonVariant = 'neutral', size: ButtonSize = 'md'): string {
  return `inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`
}

interface StyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'neutral',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: StyleProps & ComponentProps<'button'>) {
  return <button type={type} className={`${buttonClasses(variant, size)} ${className}`} {...props} />
}

export function ButtonLink({
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}: StyleProps & ComponentProps<typeof Link>) {
  return <Link className={`${buttonClasses(variant, size)} ${className}`} {...props} />
}
