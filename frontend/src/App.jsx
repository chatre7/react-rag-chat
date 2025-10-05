import React from 'react'
import FileDrop from './components/FileDrop'
import ChatBox from './components/ChatBox'

export default function App() {
  return (
    <div className="container">
      <header>
        <div>
          <h1>JamAI Knowledge Console</h1>
          <p className="subtitle">Upload knowledge, ask grounded questions, and surface precise answers with citations.</p>
        </div>
      </header>

      <main>
        <section aria-labelledby="ingestion-title">
          <div className="section-heading">
            <h2 id="ingestion-title" className="section-title">Knowledge Ingestion</h2>
            <span className="badge" aria-hidden="true">Supported: txt · md · pdf · docx · csv · xlsx</span>
          </div>
          <p className="section-description">Drop files or browse to index new content into the retrieval store. Tag uploads to scope future searches.</p>
          <FileDrop />
        </section>

        <section aria-labelledby="chat-title">
          <div className="section-heading">
            <h2 id="chat-title" className="section-title">Contextual Chat</h2>
          </div>
          <p className="section-description">Ask questions and the assistant will answer using the indexed corpus. Relevant sources appear alongside each reply.</p>
          <ChatBox />
        </section>
      </main>
    </div>
  )
}
