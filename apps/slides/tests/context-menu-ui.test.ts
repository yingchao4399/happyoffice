import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ContextMenu, type CtxItem } from '../src/renderer/components/ContextMenu'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); dispose = undefined; document.body.innerHTML = '' })

function render(items: Array<CtxItem | null>) {
  const previous = document.createElement('button')
  document.body.appendChild(previous); previous.focus()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onClose = vi.fn()
  act(() => root.render(createElement(ContextMenu, { x: 20, y: 20, items, onClose })))
  dispose = () => act(() => root.unmount())
  return { container, onClose, previous }
}

function key(key: string) {
  act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
}

describe('original Slides context menu', () => {
  it('focuses enabled commands, navigates past disabled items and color swatches, and restores focus', () => {
    const view = render([
      { label: 'unavailable', disabled: true },
      { label: 'copy' }, null,
      { label: 'colors', swatches: ['#112233', 'none'] },
      { label: 'find' },
    ])
    const buttons = [...view.container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    expect(document.activeElement).toBe(buttons[0])
    key('ArrowDown'); expect(document.activeElement).toBe(buttons[1])
    key('End'); expect(document.activeElement).toBe(buttons.at(-1))
    key('ArrowDown'); expect(document.activeElement).toBe(buttons[0])
    key('ArrowUp'); expect(document.activeElement).toBe(buttons.at(-1))
    key('Home'); expect(document.activeElement).toBe(buttons[0])
    key('Escape'); expect(view.onClose).toHaveBeenCalledOnce()
    dispose!(); dispose = undefined
    expect(document.activeElement).toBe(view.previous)
  })

  it('consumes menu keys so the deck cannot delete or nudge selected objects', () => {
    const view = render([{ label: 'copy' }])
    const deckKey = vi.fn()
    window.addEventListener('keydown', deckKey)
    try {
      for (const name of ['Delete', 'ArrowRight', 'z', 'ArrowDown']) key(name)
      expect(deckKey).not.toHaveBeenCalled()
      key('Tab'); expect(view.onClose).toHaveBeenCalledOnce()
    } finally { window.removeEventListener('keydown', deckKey) }
  })

  it('keeps the menu open for internal wheel scrolling and closes for an outside wheel', () => {
    const view = render(Array.from({ length: 50 }, (_, index) => ({ label: String(index) })))
    act(() => view.container.querySelector('[role=menu]')!.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 })))
    expect(view.onClose).not.toHaveBeenCalled()
    act(() => document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 })))
    expect(view.onClose).toHaveBeenCalledOnce()
  })

  it('never executes a disabled command and retains original command dispatch', () => {
    const unavailable = vi.fn(), copy = vi.fn(), swatch = vi.fn()
    const view = render([
      { label: 'unavailable', disabled: true, onClick: unavailable },
      { label: 'copy', onClick: copy },
      { label: 'colors', swatches: ['#112233'], onSwatch: swatch },
    ])
    const buttons = view.container.querySelectorAll<HTMLButtonElement>('button')
    act(() => buttons[0]!.click()); expect(unavailable).not.toHaveBeenCalled()
    act(() => buttons[1]!.click()); expect(copy).toHaveBeenCalledOnce()
    act(() => buttons[2]!.click()); expect(swatch).toHaveBeenCalledWith('#112233')
  })
})
