import { describe, expect, it } from 'vitest'
import { createVisiblePageQueue } from '../src/renderer/visible-page-queue'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('visible page OCR queue', () => {
  it('serializes work, replaces stale pages, and does not repeat completed pages', async () => {
    const calls: number[] = []
    let release: () => void = () => {}
    let active: () => boolean = () => false
    const queue = createVisiblePageQueue(async (page, isActive) => {
      calls.push(page)
      if (page === 0) { active = isActive; await new Promise<void>(resolve => { release = resolve }) }
      return isActive()
    })
    queue.update([0, 1, 2])
    expect(calls).toEqual([0])
    queue.update([500, 501, 500])
    expect(active()).toBe(false)
    expect(calls).toEqual([0])
    release(); await tick()
    expect(calls).toEqual([0, 500, 501])
    queue.update([500, 501]); await tick()
    expect(calls).toEqual([0, 500, 501])
    queue.dispose()
  })

  it('disposal cancels queued work and invalidates an in-flight result', async () => {
    let release: () => void = () => {}
    const calls: number[] = [], accepted: boolean[] = []
    const queue = createVisiblePageQueue(async (page, active) => {
      calls.push(page)
      await new Promise<void>(resolve => { release = resolve })
      accepted.push(active())
      return true
    })
    queue.update([0, 1]); queue.dispose(); release(); await tick()
    queue.update([2]); await tick()
    expect(calls).toEqual([0])
    expect(accepted).toEqual([false])
  })
})
