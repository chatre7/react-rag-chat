import React from 'react'
import FileDrop from './components/FileDrop'
import ChatBox from './components/ChatBox'

export default function App() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 py-12 md:px-10">
        <header className="flex flex-col gap-4 text-slate-100">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">AI workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Knowledge console for grounded AI conversations
          </h1>
          <p className="max-w-2xl text-base text-slate-300 md:text-lg">
            Upload reference material, curate tenants and tags, then interrogate the corpus with answers that stay aligned to your context.
          </p>
        </header>

        <main className="flex flex-col gap-10">
          <section aria-labelledby="ingestion-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="ingestion-title" className="text-2xl font-semibold text-slate-100">
                Knowledge ingestion
              </h2>
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-300">
                txt • md • pdf • docx • csv • xlsx
              </span>
            </div>
            <p className="text-sm text-slate-300">
              Drag files in or browse from disk. Tag uploads to scope retrieval, and optionally provide tenant identifiers for multi-tenant corpora.
            </p>
            <FileDrop />
          </section>

          <section aria-labelledby="chat-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="chat-title" className="text-2xl font-semibold text-slate-100">
                Contextual chat
              </h2>
            </div>
            <p className="text-sm text-slate-300">
              Ask AI questions grounded by your uploaded documents. Responses include supporting citations and relevance scores.
            </p>
            <ChatBox />
          </section>
        </main>
      </div>
    </div>
  )
}
