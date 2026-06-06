export type ActionKind = 'danger' | 'primary' | 'secondary' | 'success'

export interface ActionBarAction {
  ariaBusy?: boolean
  ariaLabel?: string
  disabled?: boolean
  id: string
  kind?: ActionKind
  label: string
  loading?: boolean
  loadingLabel?: string
}

export interface StatusCell {
  label: string
  value: string
}

export interface StatusPill {
  kind: string
  label: string
}

export type AriaLiveMode = 'assertive' | 'off' | 'polite'
