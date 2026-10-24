/**
 * Context menu — fixed positioning, kept within the viewport; scrolls inside long menus.
 * Items that are null render as separators.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { platformShortcuts } from '@genoffice/i18n'

export interface CtxItem {
  label: string
  /** Shortcut hint on the right */
  hint?: string
  disabled?: boolean
  danger?: boolean
  onClick?: () => void
  /** Row of color swatches rendered under the label instead of a clickable item ('none' = the clear square) */
  swatches?: string[]
  onSwatch?: (color: string) => void
}

interface Props {
  x: number
  y: number
  items: Array<CtxItem | null>
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const menu = ref.current
    return () => {
      // 用户已经把焦点移到其他控件时不抢回焦点。
      if (menu?.contains(document.activeElement) || document.activeElement === document.body) {
        const previous = previousFocus.current
        if (previous?.isConnected) previous.focus()
      }
    }
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { innerWidth, innerHeight } = window
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.max(4, Math.min(x, innerWidth - r.width - 4)),
      y: Math.max(4, Math.min(y, innerHeight - r.height - 4)),
    })
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onWheel = (e: WheelEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('wheel', onWheel)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const onMenuKey = (e: React.KeyboardEvent) => {
    // 菜单打开时，方向键/删除等不能继续触发底层画布快捷键。
    e.stopPropagation()
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      onClose()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1
      : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
    buttons[next]?.scrollIntoView?.({ block: 'nearest' })
  }

  const swatchRow = (swatches: string[], onSwatch?: (color: string) => void) => (
    <div className="ctx-swatches-row">
      {swatches.map((c) => (
        <button
          key={c}
          className={`ctx-swatch ${c === 'none' ? 'ctx-swatch-none' : ''}`}
          style={c === 'none' ? undefined : { background: c }}
          data-tip={c}
          aria-label={c}
          role="menuitem"
          onClick={() => {
            onClose()
            onSwatch?.(c)
          }}
        >
          {c === 'none' ? '✕' : ''}
        </button>
      ))}
    </div>
  )

  return (
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onMenuKey}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="ctx-sep" role="separator" />
        ) : item.swatches ? (
          <div key={i} className="ctx-swatches">
            <span className="ctx-swatches-label">{item.label}</span>
            {swatchRow(item.swatches, item.onSwatch)}
          </div>
        ) : (
          <button
            key={i}
            className={`ctx-item ${item.danger ? 'danger' : ''}`}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onClick?.()
            }}
          >
            <span>{item.label}</span>
            {item.hint && <span className="ctx-hint">{platformShortcuts(item.hint)}</span>}
          </button>
        ),
      )}
    </div>
  )
}
