import type { ReactNode } from 'react'

export interface IconProps {
  className?: string
}

function Icon({ className = 'size-6', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 11.5 12 4.5l8.5 7" />
      <path d="M6 10v9.5h12V10" />
    </Icon>
  )
}

export function IconPot(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 10.5h14V15a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
      <path d="M3.5 10.5h17" />
      <path d="M9.5 7.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5" />
    </Icon>
  )
}

export function IconSun(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5m14 0h2.5M5.3 5.3 7 7m10 10 1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" />
    </Icon>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 13.6A8 8 0 0 1 10.4 4a7.5 7.5 0 1 0 9.6 9.6z" />
    </Icon>
  )
}

export function IconBulb(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3a6 6 0 0 0-3.4 10.9c.8.6 1.4 1.3 1.4 2.1h4c0-.8.6-1.5 1.4-2.1A6 6 0 0 0 12 3z" />
      <path d="M10 19h4M10.8 21.5h2.4" />
    </Icon>
  )
}

export function IconSensor(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M8.5 14a5 5 0 0 1 7 0" />
      <path d="M5.5 10.7a9.3 9.3 0 0 1 13 0" />
    </Icon>
  )
}

export function IconSwitch(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="7" width="18" height="10" rx="5" />
      <circle cx="15.5" cy="12" r="2.8" />
    </Icon>
  )
}

export function IconPlug(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 3v4.5M15 3v4.5" />
      <path d="M6.5 7.5h11V11a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 16.5V21" />
    </Icon>
  )
}

export function IconCube(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m12 12 8-4.5M12 12 4 7.5M12 12v9" />
    </Icon>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </Icon>
  )
}
