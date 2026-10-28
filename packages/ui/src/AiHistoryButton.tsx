import { useState, type ReactElement } from 'react'
import './ai-history-button.css'

export interface AiHistoryEntry {
  role: string
  text?: string
  content?: string
  tools?: readonly { name?: string; summary?: string; isError?: boolean }[]
}

interface Labels {
  history: string
  empty: string
  you: string
  assistant: string
}

const LABELS: Record<string, Labels> = {
  zh: { history: '历史', empty: '暂无对话历史', you: '你', assistant: '助手' },
  'zh-TW': { history: '歷史', empty: '沒有對話歷史', you: '你', assistant: '助理' },
  en: { history: 'History', empty: 'No conversation history', you: 'You', assistant: 'Assistant' },
  ja: { history: '履歴', empty: '会話履歴はありません', you: 'あなた', assistant: 'アシスタント' },
  ko: { history: '기록', empty: '대화 기록이 없습니다', you: '나', assistant: '어시스턴트' },
  fr: { history: 'Historique', empty: 'Aucun historique de conversation', you: 'Vous', assistant: 'Assistant' },
  de: { history: 'Verlauf', empty: 'Kein Gesprächsverlauf', you: 'Du', assistant: 'Assistent' },
  es: { history: 'Historial', empty: 'No hay historial de conversación', you: 'Tú', assistant: 'Asistente' },
  th: { history: 'ประวัติ', empty: 'ไม่มีประวัติการสนทนา', you: 'คุณ', assistant: 'ผู้ช่วย' },
  id: { history: 'Riwayat', empty: 'Belum ada riwayat percakapan', you: 'Anda', assistant: 'Asisten' },
  ru: { history: 'История', empty: 'История диалога отсутствует', you: 'Вы', assistant: 'Ассистент' },
  ar: { history: 'السجل', empty: 'لا يوجد سجل للمحادثة', you: 'أنت', assistant: 'المساعد' },
  pt: { history: 'Histórico', empty: 'Sem histórico de conversa', you: 'Você', assistant: 'Assistente' },
  it: { history: 'Cronologia', empty: 'Nessuna cronologia della conversazione', you: 'Tu', assistant: 'Assistente' },
  pl: { history: 'Historia', empty: 'Brak historii rozmów', you: 'Ty', assistant: 'Asystent' },
  cs: { history: 'Historie', empty: 'Historie konverzace není k dispozici', you: 'Vy', assistant: 'Asistent' },
  nl: { history: 'Geschiedenis', empty: 'Geen gespreksgeschiedenis', you: 'Jij', assistant: 'Assistent' },
  ms: { history: 'Sejarah', empty: 'Tiada sejarah perbualan', you: 'Anda', assistant: 'Pembantu' },
  he: { history: 'היסטוריה', empty: 'אין היסטוריית שיחה', you: 'אתה', assistant: 'עוזר' },
  hi: { history: 'इतिहास', empty: 'कोई बातचीत इतिहास नहीं', you: 'आप', assistant: 'सहायक' },
}

function labelsFor(locale: string): Labels {
  const normalized = locale.replace('_', '-')
  const baseLocale = normalized.split('-')[0]
  return LABELS[normalized] ?? (baseLocale ? LABELS[baseLocale] : undefined) ?? LABELS.en!
}

export function AiHistoryButton({
  entries,
  locale = 'en',
  loadEntries,
}: {
  entries: readonly AiHistoryEntry[]
  locale?: string
  loadEntries?: () => Promise<readonly AiHistoryEntry[]>
}): ReactElement {
  const labels = labelsFor(locale)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadedEntries, setLoadedEntries] = useState<readonly AiHistoryEntry[] | null>(null)
  const visibleEntries = loadedEntries ?? entries

  const toggle = (): void => {
    const next = !open
    setOpen(next)
    if (!next || !loadEntries) return
    setLoading(true)
    void loadEntries()
      .then((result) => setLoadedEntries(result))
      .catch(() => setLoadedEntries(null))
      .finally(() => setLoading(false))
  }

  return (
    <span className="ai-history-control">
      <button
        type="button"
        className={`ai-header-btn ai-history-button${open ? ' active' : ''}`}
        onClick={toggle}
        data-tip={labels.history}
        aria-label={labels.history}
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>
      {open && (
        <section className="ai-history-popover" role="dialog" aria-label={labels.history}>
          <header className="ai-history-popover-header">
            <strong>{labels.history}</strong>
            <button type="button" className="ai-history-close" onClick={() => setOpen(false)} aria-label={labels.history}>×</button>
          </header>
          {loading ? (
            <div className="ai-history-empty" aria-live="polite">…</div>
          ) : visibleEntries.length === 0 ? (
            <div className="ai-history-empty">{labels.empty}</div>
          ) : (
            <div className="ai-history-list">
              {visibleEntries.slice(-200).map((entry, index) => (
                <article className={`ai-history-entry ${entry.role === 'user' ? 'user' : 'assistant'}`} key={`${index}-${entry.role}`}>
                  <span className="ai-history-role">{entry.role === 'user' ? labels.you : labels.assistant}</span>
                  {(entry.text || entry.content) && <div className="ai-history-text">{entry.text ?? entry.content}</div>}
                  {!!entry.tools?.length && (
                    <div className="ai-history-tools">
                      {entry.tools.map((tool, toolIndex) => (
                        <span key={`${tool.name ?? 'tool'}-${toolIndex}`} className={tool.isError ? 'is-error' : ''}>
                          {tool.summary || tool.name || 'AI action'}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </span>
  )
}
