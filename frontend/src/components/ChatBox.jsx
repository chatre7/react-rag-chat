import React, { useCallback, useMemo, useState } from 'react'
import { chatWithRag } from '../lib/api'

const DEFAULT_TOP_K = 4
const inputClasses = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200'
const primaryButtonClasses = 'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300'
const secondaryButtonClasses = 'inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400'

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
      className='space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm'
      onSubmit={submit}
      aria-live='polite'
    >
      <div className='flex flex-col gap-4 md:flex-row md:items-center'>
        <label htmlFor='chat-query' className='text-sm font-medium text-slate-700 md:w-28'>Question</label>
        <div className='flex flex-1 flex-col gap-3 md:flex-row'>
          <input
            id='chat-query'
            type='text'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Ask something grounded in the uploaded files...'
            autoComplete='off'
            aria-required='true'
            className={`${inputClasses} md:flex-1`}
          />
          <button type='submit' className={primaryButtonClasses} disabled={busy}>
            {busy ? 'Generating...' : 'Ask JamAI'}
          </button>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-5'>
        <div className='space-y-2 md:col-span-2'>
          <label htmlFor='chat-tenant' className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Tenant ID (optional)</label>
          <input
            id='chat-tenant'
            type='text'
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder='acme-co'
            className={inputClasses}
          />
        </div>
        <div className='space-y-2 md:col-span-2'>
          <label htmlFor='chat-tags' className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Tags (comma separated)</label>
          <input
            id='chat-tags'
            type='text'
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder='sales, playbooks'
            className={inputClasses}
          />
        </div>
        <div className='space-y-2'>
          <label htmlFor='chat-top-k' className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Results (top K)</label>
          <input
            id='chat-top-k'
            type='number'
            min='1'
            max='20'
            value={topK}
            onChange={(event) => {
              const nextValue = Number(event.target.value) || DEFAULT_TOP_K
              setTopK(Math.min(20, Math.max(1, nextValue)))
            }}
            className={inputClasses}
          />
        </div>
        <div className='flex items-end md:col-span-5 md:justify-end'>
          <button
            type='button'
            onClick={resetConversation}
            className={secondaryButtonClasses}
            disabled={busy || conversation.length === 0}
          >
            Reset conversation
          </button>
        </div>
      </div>

      {error && (
        <div role='alert' className='rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
          <p>{error}</p>
        </div>
      )}

      {answer && (
        <section aria-labelledby='answer-title' className='space-y-4 rounded-2xl border border-slate-200 bg-white p-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h3 id='answer-title' className='text-lg font-semibold text-slate-900'>Assistant response</h3>
            <span className='inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600'>Grounded</span>
          </div>
          <div className='text-sm leading-relaxed text-slate-700'>
            <p className='whitespace-pre-wrap'>{answer}</p>
          </div>
        </section>
      )}

      {sources && sources.length > 0 && (
        <section aria-labelledby='sources-title' className='space-y-3'>
          <h3 id='sources-title' className='text-lg font-semibold text-slate-900'>Sources</h3>
          <ol className='grid gap-3 md:grid-cols-2'>
            {sources.map((source, index) => (
              <li key={source.chunk_id ?? index} className='rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm'>
                <div className='flex items-center justify-between gap-2 text-xs font-medium text-slate-500'>
                  <span className='inline-flex min-w-[2rem] items-center justify-center rounded-full bg-indigo-50 px-2 py-1 text-indigo-600'>#{index + 1}</span>
                  <span className='truncate text-slate-700'>{source.source ?? 'Unknown source'}</span>
                  <span className='text-slate-400'>score {source.score?.toFixed(3)}</span>
                </div>
                <p className='mt-3 text-sm text-slate-600'>{source.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </form>
  )
}
