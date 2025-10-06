# AI RAG Chatbot

A retrieval-augmented generation (RAG) stack powered by FastAPI, Qdrant, Ollama, and a React front-end. Upload knowledge files, index them into a vector store, and chat with grounded answers plus citations.

## Stack

- **Backend**: FastAPI, Qdrant client, Ollama embeddings & chat API
- **Frontend**: React (Vite) single-page app
- **Vector store**: Qdrant
- **Container orchestration**: Docker Compose

## Getting Started

1. Duplicate the environment template:
   ```bash
   cp .env.example .env
   ```
   Adjust hostnames or model names as needed.

2. Ensure Docker Engine is running, then launch the stack:
   ```bash
   docker compose up -d --build
   ```

3. Access the services:
   - Web UI: http://localhost:5173
   - API docs: http://localhost:8000/docs
   - Qdrant dashboard: http://localhost:6333
   - Ollama API: http://localhost:11434

## Usage

1. Upload supported documents (`.txt`, `.md`, `.pdf`, `.docx`, `.csv`, `.xlsx`) through the Knowledge Ingestion panel. Optional tenant IDs and tags scope the ingestion footprint.
2. Ask questions in the contextual chat module. AI replies with answers grounded in the indexed corpus and lists source excerpts with relevance scores.
3. Debug retrieval quality using the `/debug/search` endpoint when tuning chunking or metadata strategies.

## Testing & Development

- Run backend locally:
  ```bash
  cd backend
  uvicorn app.main:app --reload
  ```
- Frontend dev server:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

Remember to follow the delivery standards outlined in `doc/requirement.md` for code quality, tests, UX, and performance.
