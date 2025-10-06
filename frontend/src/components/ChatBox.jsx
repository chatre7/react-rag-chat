import React, { useCallback, useMemo, useState } from 'react'
import { chatWithRag } from '../lib/api'

const DEFAULT_TOP_K = 4
const inputClasses = 'w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40'
const primaryButtonClasses = 'inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:shadow-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0'
const secondaryButtonClasses = 'inline-flex items-center justify-center rounded-full border border-slate-600/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-400/80 disabled:cursor-not-allowed disabled:opacity-60'

export default function ChatBox() {
  const [query, setQuery] = useState('What are the core setup steps?')
  const [tenantId, setTenantId] = useState('')
  const [tags, setTags] = useState('')
  const [conversation, setConversation] = useState([])
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [topK, setTopK] = useState(DEFAULT_TOP_K)

  const payload = useMemo(() => {
    const trimmedQuery = query.trim()
    const tagList = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    return {
      query: trimmedQuery,
      top_k: topK,
      tenant_id: tenantId.trim() || undefined,
      tags: tagList.length ? tagList : undefined,
      conversation: conversation.map(({ role, content }) => ({ role, content })),
    }
  }, [conversation, query, tags, tenantId, topK])

  const submit = useCallback(
    async (event) => {
      event.preventDefault()
      if (!payload.query) {
        setError('Ask a question to begin.')
        return
      }
      setError(null)
      setBusy(true)
      try {
        const result = await chatWithRag(payload)
        const nextConversation = [
          ...conversation,
          { role: 'user', content: payload.query },
          { role: 'assistant', content: result.answer },
        ]
        setConversation(nextConversation)
        setAnswer(result.answer)
        setSources(result.sources ?? [])
      } catch (err) {
        setError(err.message)
        setAnswer('')
        setSources([])
      } finally {
        setBusy(false)
      }
    },
    [conversation, payload],
  )

  const resetConversation = () => {
    setConversation([])
    setAnswer('')
    setSources([])
    setError(null)
  }

  return (
    <form
      className="space-y-6 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
      onSubmit={submit}
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <label htmlFor="chat-query" className="sr-only">
          Ask a question
        </label>
        <input
          id="chat-query"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask something grounded in the uploaded files..."
          autoComplete="off"
          aria-required="true"
          className={`md:flex-1 ${inputClasses}`}
        />
        <button type="submit" className={`${primaryButtonClasses} md:self-start`} disabled={busy}>
          {busy ? 'Thinking...' : 'Ask AI'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="chat-tenant" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Tenant ID (optional)
          </label>
          <input
            id="chat-tenant"
            type="text"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="acme-co"
            className={inputClasses}
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="chat-tags" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Tags (comma separated)
          </label>
          <input
            id="chat-tags"
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="sales, playbooks"
            className={inputClasses}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="chat-top-k" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Results (top K)
          </label>
          <input
            id="chat-top-k"
            type="number"
            min="1"
            max="20"
            value={topK}
            onChange={(event) => {
              const nextValue = Number(event.target.value) || DEFAULT_TOP_K
              setTopK(Math.min(20, Math.max(1, nextValue)))
            }}
            className={inputClasses}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={resetConversation}
            className={`${secondaryButtonClasses} w-full`}
            disabled={busy || conversation.length === 0}
          >
            Reset chat
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p>{error}</p>
        </div>
      )}

      {answer && (
        <section aria-labelledby="answer-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="answer-title" className="text-lg font-semibold text-slate-100">
              Assistant response
            </h3>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-200">
              Grounded
            </span>
          </div>
          <div className="rounded-2xl border border-slate-700/40 bg-slate-900/50 p-5 text-sm text-slate-100">
            <p className="whitespace-pre-wrap leading-relaxed">{answer}</p>
          </div>
        </section>
      )}

      {sources && sources.length > 0 && (
        <section aria-labelledby="sources-title" className="space-y-3">
          <h3 id="sources-title" className="text-lg font-semibold text-slate-100">
            Sources
          </h3>
          <ol className="space-y-3">
            {sources.map((source, index) => (
              <li key={source.chunk_id ?? index} className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">#{index + 1}</span>
                  <span className="font-semibold text-slate-100">{source.source ?? 'Unknown source'}</span>
                  <span className="text-xs text-slate-400">score {source.score?.toFixed(3)}</span>
                </div>
                <p className="mt-3 text-sm text-slate-200">{source.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </form>
  )
}
