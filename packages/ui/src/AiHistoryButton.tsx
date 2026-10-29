import { useEffect, useRef, useState, type ReactElement } from 'react'
import './ai-history-button.css'

export interface AiHistoryEntry {
  role: string
  text?: string
  content?: string
  tools?: readonly { name?: string; summary?: string; isError?: boolean }[]
}

export interface AiHistorySession {
  chatId: string
  updatedAt: string
  title?: string
  pinned?: boolean
  archived?: boolean
  deletedAt?: string
}

export interface AiHistoryPatch {
  title?: string | null
  pinned?: boolean
  archived?: boolean
  deleted?: boolean
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
  fr: {
    history: 'Historique',
    empty: 'Aucun historique de conversation',
    you: 'Vous',
    assistant: 'Assistant',
  },
  de: { history: 'Verlauf', empty: 'Kein Gesprächsverlauf', you: 'Du', assistant: 'Assistent' },
  es: {
    history: 'Historial',
    empty: 'No hay historial de conversación',
    you: 'Tú',
    assistant: 'Asistente',
  },
  th: { history: 'ประวัติ', empty: 'ไม่มีประวัติการสนทนา', you: 'คุณ', assistant: 'ผู้ช่วย' },
  id: {
    history: 'Riwayat',
    empty: 'Belum ada riwayat percakapan',
    you: 'Anda',
    assistant: 'Asisten',
  },
  ru: {
    history: 'История',
    empty: 'История диалога отсутствует',
    you: 'Вы',
    assistant: 'Ассистент',
  },
  ar: { history: 'السجل', empty: 'لا يوجد سجل للمحادثة', you: 'أنت', assistant: 'المساعد' },
  pt: {
    history: 'Histórico',
    empty: 'Sem histórico de conversa',
    you: 'Você',
    assistant: 'Assistente',
  },
  it: {
    history: 'Cronologia',
    empty: 'Nessuna cronologia della conversazione',
    you: 'Tu',
    assistant: 'Assistente',
  },
  pl: { history: 'Historia', empty: 'Brak historii rozmów', you: 'Ty', assistant: 'Asystent' },
  cs: {
    history: 'Historie',
    empty: 'Historie konverzace není k dispozici',
    you: 'Vy',
    assistant: 'Asistent',
  },
  nl: {
    history: 'Geschiedenis',
    empty: 'Geen gespreksgeschiedenis',
    you: 'Jij',
    assistant: 'Assistent',
  },
  ms: { history: 'Sejarah', empty: 'Tiada sejarah perbualan', you: 'Anda', assistant: 'Pembantu' },
  he: { history: 'היסטוריה', empty: 'אין היסטוריית שיחה', you: 'אתה', assistant: 'עוזר' },
  hi: { history: 'इतिहास', empty: 'कोई बातचीत इतिहास नहीं', you: 'आप', assistant: 'सहायक' },
}

function labelsFor(locale: string): Labels {
  const normalized = locale.replace('_', '-')
  const baseLocale = normalized.split('-')[0]
  return LABELS[normalized] ?? (baseLocale ? LABELS[baseLocale] : undefined) ?? LABELS.en!
}

const ACTION_LABELS = {
  zh: {
    newChat: '新对话',
    search: '搜索对话',
    recent: '最近',
    archived: '已归档',
    trash: '回收站',
    rename: '重命名',
    pin: '置顶',
    unpin: '取消置顶',
    archive: '归档',
    unarchive: '取消归档',
    delete: '删除',
    restore: '恢复',
    save: '保存',
    cancel: '取消',
    actions: '会话操作',
    failed: '操作失败，请重试',
  },
  'zh-TW': {
    newChat: '新對話',
    search: '搜尋對話',
    recent: '最近',
    archived: '已封存',
    trash: '回收桶',
    rename: '重新命名',
    pin: '釘選',
    unpin: '取消釘選',
    archive: '封存',
    unarchive: '取消封存',
    delete: '刪除',
    restore: '還原',
    save: '儲存',
    cancel: '取消',
    actions: '對話操作',
    failed: '操作失敗，請重試',
  },
  en: {
    newChat: 'New chat',
    search: 'Search conversations',
    recent: 'Recent',
    archived: 'Archived',
    trash: 'Trash',
    rename: 'Rename',
    pin: 'Pin',
    unpin: 'Unpin',
    archive: 'Archive',
    unarchive: 'Unarchive',
    delete: 'Delete',
    restore: 'Restore',
    save: 'Save',
    cancel: 'Cancel',
    actions: 'Conversation actions',
    failed: 'Action failed. Try again.',
  },
}

function actionLabelsFor(locale: string): typeof ACTION_LABELS.en {
  const normalized = locale.replace('_', '-')
  if (normalized === 'zh-TW') return ACTION_LABELS['zh-TW']
  return normalized.startsWith('zh') ? ACTION_LABELS.zh : ACTION_LABELS.en
}

export function AiHistoryButton({
  entries,
  locale = 'en',
  loadEntries,
  loadSessions,
  activeChatId,
  onSelectSession,
  onNewChat,
  onUpdateSession,
  disabled = false,
}: {
  entries: readonly AiHistoryEntry[]
  locale?: string
  loadEntries?: () => Promise<readonly AiHistoryEntry[]>
  loadSessions?: () => Promise<readonly AiHistorySession[]>
  activeChatId?: string | null
  onSelectSession?: (chatId: string) => Promise<void> | void
  onNewChat?: () => Promise<void> | void
  onUpdateSession?: (chatId: string, patch: AiHistoryPatch) => Promise<void> | void
  disabled?: boolean
}): ReactElement {
  const labels = labelsFor(locale)
  const actions = actionLabelsFor(locale)
  const rootRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [loadedEntries, setLoadedEntries] = useState<readonly AiHistoryEntry[] | null>(null)
  const [sessions, setSessions] = useState<readonly AiHistorySession[]>([])
  const [search, setSearch] = useState('')
  const [section, setSection] = useState<'recent' | 'archived' | 'trash'>('recent')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const visibleEntries = loadedEntries ?? entries

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [open])

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      if (loadSessions) setSessions(await loadSessions())
      else if (loadEntries) setLoadedEntries(await loadEntries())
    } catch {
      setError(actions.failed)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (): void => {
    const next = !open
    setOpen(next)
    setMenuId(null)
    if (next) void refresh()
  }

  const runAction = async (
    action: () => Promise<void> | void,
    closeAfter = false,
  ): Promise<void> => {
    setWorking(true)
    setError('')
    try {
      await action()
      if (closeAfter) setOpen(false)
      else await refresh()
    } catch {
      setError(actions.failed)
    } finally {
      setWorking(false)
    }
  }

  const visibleSessions = sessions.filter((session) => {
    if (
      section === 'trash'
        ? !session.deletedAt
        : section === 'archived'
          ? !session.archived || !!session.deletedAt
          : !!session.archived || !!session.deletedAt
    )
      return false
    return (
      !search ||
      (session.title || actions.newChat).toLocaleLowerCase().includes(search.toLocaleLowerCase())
    )
  })

  return (
    <span className="ai-history-control" ref={rootRef}>
      <button
        type="button"
        className={`ai-header-btn ai-history-button${open ? ' active' : ''}`}
        onClick={toggle}
        disabled={disabled}
        data-tip={labels.history}
        aria-label={labels.history}
        aria-expanded={open}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>
      {open && (
        <section className="ai-history-popover" role="dialog" aria-label={labels.history}>
          <header className="ai-history-popover-header">
            <strong>{labels.history}</strong>
            <div className="ai-history-header-actions">
              {onNewChat && (
                <button
                  type="button"
                  className="ai-history-new"
                  onClick={() => void runAction(onNewChat, true)}
                  disabled={working}
                  title={actions.newChat}
                  aria-label={actions.newChat}
                >
                  ＋
                </button>
              )}
              <button
                type="button"
                className="ai-history-close"
                onClick={() => setOpen(false)}
                aria-label={actions.cancel}
              >
                ×
              </button>
            </div>
          </header>
          {loadSessions ? (
            <>
              <div className="ai-history-search-wrap">
                <input
                  type="search"
                  className="ai-history-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={actions.search}
                  aria-label={actions.search}
                />
              </div>
              <div className="ai-history-sections" role="tablist" aria-label={labels.history}>
                {(['recent', 'archived', 'trash'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={section === item}
                    className={section === item ? 'active' : ''}
                    onClick={() => {
                      setSection(item)
                      setMenuId(null)
                    }}
                  >
                    {actions[item]}
                  </button>
                ))}
              </div>
              {error && (
                <div className="ai-history-error" role="alert">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="ai-history-empty" aria-live="polite">
                  …
                </div>
              ) : visibleSessions.length === 0 ? (
                <div className="ai-history-empty">{labels.empty}</div>
              ) : (
                <div className="ai-history-session-list" role="tabpanel">
                  {visibleSessions.map((session) => (
                    <div
                      className={`ai-history-session${session.chatId === activeChatId ? ' active' : ''}`}
                      key={session.chatId}
                    >
                      {editingId === session.chatId ? (
                        <form
                          className="ai-history-rename"
                          onSubmit={(event) => {
                            event.preventDefault()
                            void runAction(async () => {
                              await onUpdateSession?.(session.chatId, { title: editTitle })
                              setEditingId(null)
                            })
                          }}
                        >
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                            aria-label={actions.rename}
                            maxLength={80}
                          />
                          <button type="submit" disabled={working} title={actions.save}>
                            {actions.save}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            title={actions.cancel}
                          >
                            {actions.cancel}
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="ai-history-session-main"
                            onClick={() =>
                              onSelectSession &&
                              void runAction(() => onSelectSession(session.chatId), true)
                            }
                            disabled={!onSelectSession || working || !!session.deletedAt}
                            aria-current={session.chatId === activeChatId ? 'true' : undefined}
                          >
                            <span className="ai-history-session-title">
                              {session.pinned && !session.deletedAt ? '◆ ' : ''}
                              {session.title || actions.newChat}
                            </span>
                            <time>{new Date(session.updatedAt).toLocaleDateString(locale)}</time>
                          </button>
                          {onUpdateSession && (
                            <div className="ai-history-session-actions">
                              <button
                                type="button"
                                className="ai-history-more"
                                onClick={() =>
                                  setMenuId(menuId === session.chatId ? null : session.chatId)
                                }
                                aria-label={actions.actions}
                                title={actions.actions}
                                disabled={working}
                              >
                                ⋯
                              </button>
                            </div>
                          )}
                          {onUpdateSession && menuId === session.chatId && (
                            <div className="ai-history-menu">
                              {!session.deletedAt && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingId(session.chatId)
                                      setEditTitle(session.title || '')
                                      setMenuId(null)
                                    }}
                                  >
                                    {actions.rename}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuId(null)
                                      void runAction(() =>
                                        onUpdateSession(session.chatId, {
                                          pinned: !session.pinned,
                                        }),
                                      )
                                    }}
                                  >
                                    {session.pinned ? actions.unpin : actions.pin}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuId(null)
                                      void runAction(() =>
                                        onUpdateSession(session.chatId, {
                                          archived: !session.archived,
                                        }),
                                      )
                                    }}
                                  >
                                    {session.archived ? actions.unarchive : actions.archive}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuId(null)
                                      void runAction(() =>
                                        onUpdateSession(session.chatId, { deleted: true }),
                                      )
                                    }}
                                  >
                                    {actions.delete}
                                  </button>
                                </>
                              )}
                              {!!session.deletedAt && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuId(null)
                                    void runAction(() =>
                                      onUpdateSession(session.chatId, { deleted: false }),
                                    )
                                  }}
                                >
                                  {actions.restore}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : loading ? (
            <div className="ai-history-empty" aria-live="polite">
              …
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="ai-history-empty">{labels.empty}</div>
          ) : (
            <div className="ai-history-list">
              {visibleEntries.slice(-200).map((entry, index) => (
                <article
                  className={`ai-history-entry ${entry.role === 'user' ? 'user' : 'assistant'}`}
                  key={`${index}-${entry.role}`}
                >
                  <span className="ai-history-role">
                    {entry.role === 'user' ? labels.you : labels.assistant}
                  </span>
                  {(entry.text || entry.content) && (
                    <div className="ai-history-text">{entry.text ?? entry.content}</div>
                  )}
                  {!!entry.tools?.length && (
                    <div className="ai-history-tools">
                      {entry.tools.map((tool, toolIndex) => (
                        <span
                          key={`${tool.name ?? 'tool'}-${toolIndex}`}
                          className={tool.isError ? 'is-error' : ''}
                        >
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
