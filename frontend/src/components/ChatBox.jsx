import React, { useCallback, useMemo, useState } from 'react'
import { chatWithRag } from '../lib/api'

const DEFAULT_TOP_K = 4

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
    <form className="card chat-grid" onSubmit={submit} aria-live="polite">
      <div className="chat-input-row">
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
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Thinking...' : 'Ask JamAI'}
        </button>
      </div>

      <div className="chat-input-row">
        <div>
          <label htmlFor="chat-tenant">Tenant ID (optional)</label>
          <input
            id="chat-tenant"
            type="text"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="acme-co"
          />
        </div>
        <div>
          <label htmlFor="chat-tags">Tags (comma separated)</label>
          <input
            id="chat-tags"
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="sales, playbooks"
          />
        </div>
        <div>
          <label htmlFor="chat-top-k">Results (top K)</label>
          <input
            id="chat-top-k"
            type="number"
            min="1"
            max="20"
            value={topK}
            onChange={(event) => setTopK(Number(event.target.value))}
          />
        </div>
        <button type="button" onClick={resetConversation} disabled={busy}>
          Reset chat
        </button>
      </div>

      {error && (
        <div role="alert" className="card">
          <p>{error}</p>
        </div>
      )}

      {answer && (
        <section aria-labelledby="answer-title" className="card">
          <div className="section-heading">
            <h3 id="answer-title" className="section-title">
              Assistant
            </h3>
          </div>
          <pre>{answer}</pre>
        </section>
      )}

      {sources && sources.length > 0 && (
        <section aria-labelledby="sources-title" className="card">
          <div className="section-heading">
            <h3 id="sources-title" className="section-title">
              Sources
            </h3>
          </div>
          <ol className="source-list">
            {sources.map((source, index) => (
              <li key={source.chunk_id ?? index} className="source-item">
                <div className="source-title">
                  <span className="badge">#{index + 1}</span>
                  <span>{source.source ?? 'Unknown source'}</span>
                  <span>score {source.score?.toFixed(3)}</span>
                </div>
                <p>{source.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </form>
  )
}


