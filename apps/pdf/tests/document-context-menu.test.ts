import { expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { DocumentContextMenu } from '../src/renderer/DocumentContextMenu'

it('沿用原菜单类，键盘跳过只读命令、显示原因、退出恢复焦点', () => {
  const trigger = document.createElement('button'), container = document.createElement('div')
  document.body.append(trigger, container); trigger.focus()
  const root = createRoot(container), copy = vi.fn(), modify = vi.fn(), close = vi.fn()
  act(() => root.render(createElement(DocumentContextMenu, { x: innerWidth - 1, y: innerHeight - 1, onClose: close, items: [
    { id: 'copy', label: '复制', run: copy },
    { id: 'rotate', label: '旋转', disabled: true, reason: '只读文档', run: modify },
    { id: 'search', label: '搜索', run: vi.fn() },
  ] })))
  const menu = container.querySelector<HTMLElement>('[role=menu]')!
  expect(menu.classList.contains('thumb-menu')).toBe(true)
  const buttons = menu.querySelectorAll('button')
  expect(document.activeElement).toBe(buttons[0])
  expect(buttons[1]!.title).toBe('只读文档')
  act(() => menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
  expect(document.activeElement).toBe(buttons[2])
  act(() => menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
  expect(document.activeElement).toBe(buttons[0])
  act(() => buttons[1]!.click())
  expect(modify).not.toHaveBeenCalled()
  act(() => buttons[0]!.click())
  expect(copy).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce()
  act(() => root.unmount())
  expect(document.activeElement).toBe(trigger)
  trigger.remove(); container.remove()
})
