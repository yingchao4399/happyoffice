import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSystemPrintWindow } from '../src/system-print-window'
import type { BrowserWindow } from 'electron'

const mocked = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('electron', () => ({ BrowserWindow: class { constructor(options: unknown) { return mocked.create(options) } } }))

function fakeWindow(enabled = true) {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    destroyed: false,
    enabled,
    isDestroyed() { return this.destroyed },
    isEnabled() { return this.enabled },
    setEnabled(value: boolean) { this.enabled = value },
    focus: vi.fn(),
    destroy() { this.destroyed = true; emitter.emit('closed') },
  })
}
const asWindow = (window: ReturnType<typeof fakeWindow>) => window as unknown as BrowserWindow
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32' })
  mocked.create.mockReset().mockImplementation(() => fakeWindow())
})
afterEach(() => { Object.defineProperty(process, 'platform', originalPlatform) })

describe('system print window lifetime', () => {
  it('releases the document only after all concurrent print windows close', () => {
    const owner = fakeWindow()
    const first = createSystemPrintWindow(asWindow(owner), { title: 'Print' })
    const second = createSystemPrintWindow(asWindow(owner), {})
    first.emit('show'); second.emit('show')
    expect(owner.enabled).toBe(false)
    first.destroy()
    expect(owner.enabled).toBe(false)
    second.destroy()
    expect(owner.enabled).toBe(true)
    expect(owner.focus).toHaveBeenCalledOnce()
    expect(owner.listenerCount('closed')).toBe(0)
  })
  it('does not enable a document that was already disabled', () => {
    const owner = fakeWindow(false)
    const print = createSystemPrintWindow(asWindow(owner), {})
    print.emit('show'); print.destroy()
    expect(owner.enabled).toBe(false)
    expect(owner.focus).not.toHaveBeenCalled()
  })
  it('cleans up an unshown print window without changing document input', () => {
    const owner = fakeWindow()
    const print = createSystemPrintWindow(asWindow(owner), {})
    print.destroy()
    expect(owner.enabled).toBe(true)
    expect(owner.listenerCount('closed')).toBe(0)
    expect(owner.focus).not.toHaveBeenCalled()
  })
  it('closes print helpers when their document is destroyed', () => {
    const owner = fakeWindow()
    const print = createSystemPrintWindow(asWindow(owner), {})
    print.emit('show'); owner.destroy()
    expect(print.isDestroyed()).toBe(true)
    expect(owner.focus).not.toHaveBeenCalled()
  })
})
