/** One OCR job at a time; scroll updates replace pending work instead of growing it. */
export function createVisiblePageQueue(processPage: (page: number, active: () => boolean) => Promise<boolean>) {
  let disposed = false, running = false
  let wanted: number[] = []
  let requested = new Set<number>()
  const completed = new Set<number>()
  async function drain() {
    if (running || disposed) return
    running = true
    try {
      while (!disposed) {
        const page = wanted.find(value => !completed.has(value))
        if (page === undefined) break
        wanted = wanted.filter(value => value !== page)
        try {
          if (await processPage(page, () => !disposed && requested.has(page))) completed.add(page)
        } catch { completed.add(page) }
      }
    } finally { running = false }
  }
  return {
    update(pages: number[]) {
      wanted = [...new Set(pages)].filter(page => !completed.has(page))
      requested = new Set(pages)
      void drain()
    },
    dispose() { disposed = true; wanted = []; requested.clear() },
  }
}
