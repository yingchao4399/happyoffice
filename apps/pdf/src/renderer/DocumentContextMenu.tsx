import { useLayoutEffect, useRef, useState } from 'react'
import { useDismissablePopover } from '@genoffice/ui'

export interface PdfContextAction {
  id: string
  label: string
  disabled?: boolean
  reason?: string
  run: () => void
}

// 沿用 PDF 缩略图的原版菜单、主题与浮层关闭规则。
export function DocumentContextMenu({ x, y, items, onClose }: {
  x: number; y: number; items: PdfContextAction[]; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })
  const returnFocus = useRef(document.activeElement as HTMLElement | null)
  useDismissablePopover(true, onClose, { inside: () => [ref.current] })
  useLayoutEffect(() => {
    const el = ref.current!
    const rect = el.getBoundingClientRect()
    setPosition({ left: Math.max(8, Math.min(x, innerWidth - rect.width - 8)), top: Math.max(8, Math.min(y, innerHeight - rect.height - 8)) })
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    return () => { if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }) }
  }, [x, y])
  return <div ref={ref} className="thumb-menu file-menu pdf-document-menu" role="menu" style={position}
    onMouseDown={event => event.preventDefault()}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
      if (event.key === 'Tab') { onClose(); return }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault(); event.stopPropagation()
      const buttons = [...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[index]?.focus()
    }}>
    {items.map(item => <button key={item.id} type="button" role="menuitem" data-pdf-context-action={item.id}
      disabled={item.disabled} title={item.reason} onClick={() => { onClose(); item.run() }}>{item.label}</button>)}
  </div>
}
