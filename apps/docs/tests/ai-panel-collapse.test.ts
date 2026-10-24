// The AI panel stays mounted while collapsed (reopened from the ribbon),
// so the conversation, draft, and in-flight runs survive collapse/expand.
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Editor } from '@tiptap/core'
import { editorExtensions } from '../src/renderer/editor/extensions'
import { AiPanel, initialAiPanelWidth } from '../src/renderer/ai/AiPanel'
import { AI_PROVIDERS, type AiSettings } from '../src/shared/ipc'

const settings: AiSettings = {
  provider: 'anthropic',
  providers: Object.fromEntries(
    AI_PROVIDERS.map((p) => [p.id, { apiKey: '', model: p.defaultModel }]),
  ) as AiSettings['providers'],
}

function createEditor(): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: editorExtensions,
    content: {
      type: 'doc',
      content: [
        {
          type: 'docParagraph',
          attrs: { docxIndex: 0 },
          content: [{ type: 'text', text: 'EVs market research' }],
        },
      ],
    },
  })
}

function mount(element: React.ReactElement, className = ''): {
  container: HTMLElement
  root: Root
  cleanup: () => void
} {
  const container = document.createElement('div')
  container.className = className
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  return {
    container,
    root,
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function panelProps(editor: Editor, overrides: Record<string, unknown> = {}) {
  return {
    editor,
    blocks: [],
    settings,
    open: true,
    onExpand: () => {},
    onCollapse: () => {},
    ...overrides,
  }
}

/** Simulate typing into React's controlled textarea */
function typeInto(textarea: HTMLTextAreaElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  act(() => {
    setter.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeAll(() => {
  // jsdom has no scrollTo; the panel auto-scrolls its chat log
  Element.prototype.scrollTo ??= () => {}
})

describe('AiPanel collapse', () => {
  it('首次排版预留宽度与持久侧栏宽度及窗口限制一致', () => {
    const previous = localStorage.getItem('docs-ai-panel-width')
    const width = Object.getOwnPropertyDescriptor(window, 'innerWidth')!
    localStorage.setItem('docs-ai-panel-width', '600')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
    const editor = createEditor()
    const { container, cleanup } = mount(createElement(AiPanel, panelProps(editor)), 'ai-dock')
    try {
      expect(initialAiPanelWidth()).toBe(600)
      expect(container.style.getPropertyValue('--ai-panel-width')).toBe('600px')
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 700 })
      act(() => window.dispatchEvent(new Event('resize')))
      expect(initialAiPanelWidth()).toBe(420)
      expect(container.style.getPropertyValue('--ai-panel-width')).toBe('420px')
      expect(localStorage.getItem('docs-ai-panel-width')).toBe('600')
    } finally {
      cleanup(); editor.destroy()
      Object.defineProperty(window, 'innerWidth', width)
      if (previous === null) localStorage.removeItem('docs-ai-panel-width')
      else localStorage.setItem('docs-ai-panel-width', previous)
    }
  })

  it('keeps the draft input across a collapse/expand cycle', () => {
    const editor = createEditor()
    const { container, root, cleanup } = mount(createElement(AiPanel, panelProps(editor)))

    const textarea = container.querySelector<HTMLTextAreaElement>('.ai-input-box textarea')
    expect(textarea).not.toBeNull()
    typeInto(textarea!, 'unsent draft')
    expect(textarea!.value).toBe('unsent draft')

    // 收起不画内容，实例和未发送草稿仍保留。
    act(() => root.render(createElement(AiPanel, panelProps(editor, { open: false }))))
    expect(container.querySelector('.ai-input-box textarea')).toBeNull()
    expect(container.querySelector('.ai-panel')).toBeNull()

    // expand: the draft is still there
    act(() => root.render(createElement(AiPanel, panelProps(editor, { open: true }))))
    const restored = container.querySelector<HTMLTextAreaElement>('.ai-input-box textarea')
    expect(restored).not.toBeNull()
    expect(restored!.value).toBe('unsent draft')

    cleanup()
    editor.destroy()
  })

  it('does not measure the empty welcome panel for auto scrolling', () => {
    const editor = createEditor()
    const scroll = vi.spyOn(Element.prototype, 'scrollTo')
    const { container, cleanup } = mount(createElement(AiPanel, panelProps(editor)))
    try {
      expect(container.querySelector('.ai-chat-empty')).not.toBeNull()
      expect(scroll).not.toHaveBeenCalled()
    } finally { cleanup(); editor.destroy(); scroll.mockRestore() }
  })
})
