# Ollama RAG Chatbot (Python + React)

โครงสร้างพร้อมรันในเครื่อง (Docker) + โค้ดตัวอย่างครบวงจร: Ingestion → Vector DB (Qdrant) → Retrieve → LLM (Ollama) → React UI

---

## 0) Features
- อัปโหลดเอกสาร: `.txt, .md, .pdf, .docx, .csv, .xlsx`
- เลือกใช้ LLM/Embedding จาก **Ollama** (เช่น `llama3.1`, `qwen2.5`, `mistral`, `mxbai-embed-large`, `nomic-embed-text`)
- Vector store: **Qdrant** (local container)
- API: **FastAPI (Python)**
- Frontend: **React (Vite)**
- Docker Compose: ยกทั้ง stack ได้ทันที

> หมายเหตุ: โค้ดชุดนี้ออกแบบมาให้เรียบง่าย เข้าใจง่าย และต่อยอดเป็น production ได้ไม่ยาก

---

## 1) โครงสร้างไฟล์
```
rag-ollama-react/
├─ docker-compose.yml
├─ .env
├─ backend/
│  ├─ requirements.txt
│  ├─ main.py
│  ├─ rag_core.py
│  ├─ parsers.py
│  └─ settings.py
└─ frontend/
   ├─ index.html
   ├─ package.json
   ├─ vite.config.js
   └─ src/
      ├─ main.jsx
      ├─ App.jsx
      ├─ components/
      │  ├─ ChatBox.jsx
      │  └─ FileDrop.jsx
      └─ lib/api.js
```

---

## 2) Docker Compose (root: `docker-compose.yml`)
```yaml
version: "3.9"

services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:11434/api/tags"]
      interval: 5s
      timeout: 3s
      retries: 50

  # ตัวช่วยดึงโมเดลเมื่อเริ่มระบบ
  ollama-init:
    image: ollama/ollama:latest
    depends_on:
      ollama:
        condition: service_healthy
    entrypoint: ["bash", "-lc"]
    command: >
      "ollama pull ${LLM_MODEL} && ollama pull ${EMBED_MODEL} && echo '✅ Models ready'"
    environment:
      - OLLAMA_HOST=ollama:11434
    volumes:
      - ollama_models:/root/.ollama
    restart: "no"

  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
    volumes:
      - qdrant_storage:/qdrant/storage

  api:
    build:
      context: ./backend
    container_name: rag-api
    env_file: .env
    depends_on:
      ollama:
        condition: service_healthy
      qdrant:
        condition: service_started
    ports:
      - "8000:8000"
    restart: unless-stopped

  web:
    build:
      context: ./frontend
    container_name: rag-web
    env_file: .env
    depends_on:
      api:
        condition: service_started
    ports:
      - "5173:5173"
    restart: unless-stopped

volumes:
  ollama_models:
  qdrant_storage:
```

### `.env` (ตัวอย่าง)
```env
# LLM & Embedding
LLM_MODEL=llama3.1
EMBED_MODEL=mxbai-embed-large

# API config
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=*

# Qdrant
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_COLLECTION=buddha-history

# Ollama host ในเครือข่าย docker
OLLAMA_BASE=http://ollama:11434
```

---

## 3) Backend (FastAPI)

### 3.1 `backend/requirements.txt`
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
python-multipart==0.0.9
qdrant-client==1.10.1
numpy==1.26.4
pandas==2.2.2
pypdf==4.3.1
python-docx==1.1.2
openpyxl==3.1.5
markdown==3.7
httpx==0.27.2
```

### 3.2 `backend/settings.py`
```python
from pydantic import BaseModel
import os

class Settings(BaseModel):
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama3.1")
    EMBED_MODEL: str = os.getenv("EMBED_MODEL", "mxbai-embed-large")
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "buddha-history")
    OLLAMA_BASE: str = os.getenv("OLLAMA_BASE", "http://localhost:11434")
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

settings = Settings()
```

### 3.3 `backend/parsers.py` (แปลงไฟล์ → ข้อความ)
```python
from typing import List
from io import BytesIO
import pandas as pd
from pypdf import PdfReader
from docx import Document
import markdown as md

ALLOWED = {"text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/markdown", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}


def _from_pdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    texts = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        texts.append(txt)
    return "\n\n".join(texts)


def _from_docx(data: bytes) -> str:
    f = BytesIO(data)
    doc = Document(f)
    return "\n".join([p.text for p in doc.paragraphs])


def _from_md(data: bytes) -> str:
    # เก็บเป็น text plain โดยตัด markup ให้อ่านง่าย
    html = md.markdown(data.decode("utf-8", errors="ignore"))
    # naive strip HTML tags
    import re
    return re.sub(r"<[^>]+>", " ", html)


def _from_csv(data: bytes) -> str:
    df = pd.read_csv(BytesIO(data))
    return df.to_csv(index=False)


def _from_xlsx(data: bytes) -> str:
    df = pd.read_excel(BytesIO(data))
    return df.to_csv(index=False)


def file_to_text(filename: str, content: bytes, content_type: str) -> str:
    ct = content_type or ""
    if ct not in ALLOWED:
        # fallback ด้วยนามสกุล
        if filename.lower().endswith(".pdf"):
            return _from_pdf(content)
        if filename.lower().endswith(".docx"):
            return _from_docx(content)
        if filename.lower().endswith(".md"):
            return _from_md(content)
        if filename.lower().endswith(".csv"):
            return _from_csv(content)
        if filename.lower().endswith(".xlsx"):
            return _from_xlsx(content)
        return content.decode("utf-8", errors="ignore")

    if ct == "application/pdf":
        return _from_pdf(content)
    if ct == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _from_docx(content)
    if ct == "text/markdown":
        return _from_md(content)
    if ct == "text/csv":
        return _from_csv(content)
    if ct == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return _from_xlsx(content)

    return content.decode("utf-8", errors="ignore")


def simple_split(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    out = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        out.append(text[start:end])
        start = end - overlap
        if start < 0:
            start = 0
    return [s.strip() for s in out if s.strip()]
```

### 3.4 `backend/rag_core.py` (Embed, Upsert, Search, Generate)
```python
from typing import List, Dict
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import httpx
import uuid

from settings import settings

client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)


async def ensure_collection(dim: int = 1024):
    if not client.collection_exists(settings.QDRANT_COLLECTION):
        client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )


async def ollama_embed(texts: List[str]) -> List[List[float]]:
    url = f"{settings.OLLAMA_BASE}/api/embeddings"
    async with httpx.AsyncClient(timeout=120) as http:
        resp = await http.post(url, json={"model": settings.EMBED_MODEL, "input": texts})
        resp.raise_for_status()
        data = resp.json()
        # รองรับทั้ง input เดี่ยว/หลายอัน
        if isinstance(data.get("embeddings"), list) and isinstance(data["embeddings"][0], float):
            return [data["embeddings"]]
        return data["embeddings"]


async def upsert_chunks(chunks: List[str], meta: Dict):
    vectors = await ollama_embed(chunks)
    await ensure_collection(dim=len(vectors[0]))
    points = []
    for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
        pid = str(uuid.uuid4())
        payload = {"text": chunk, **meta}
        points.append(PointStruct(id=pid, vector=vec, payload=payload))
    client.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)
    return len(points)


async def search_similar(query: str, top_k: int = 5) -> List[Dict]:
    vec = (await ollama_embed([query]))[0]
    res = client.search(
        collection_name=settings.QDRANT_COLLECTION,
        query_vector=vec,
        limit=top_k,
        with_payload=True,
    )
    out = []
    for r in res:
        out.append({
            "score": r.score,
            "text": r.payload.get("text", ""),
            "source": r.payload.get("source", ""),
            "filename": r.payload.get("filename", ""),
        })
    return out


SYSTEM_PROMPT = (
    "คุณเป็นผู้ช่วย RAG ภาษาไทย ช่วยตอบอย่างกระชับ ถูกต้อง และอ้างอิงจาก Context ที่ให้มา หากไม่พบข้อมูลใน Context ให้บอกตามตรงว่าไม่แน่ใจ"
)


async def ollama_chat(messages: List[Dict]) -> str:
    url = f"{settings.OLLAMA_BASE}/api/chat"
    async with httpx.AsyncClient(timeout=120) as http:
        resp = await http.post(url, json={
            "model": settings.LLM_MODEL,
            "messages": messages,
            "stream": False
        })
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "")


def format_context(docs: List[Dict]) -> str:
    parts = []
    for i, d in enumerate(docs, 1):
        src = d.get("filename") or d.get("source") or ""
        parts.append(f"[#{i} score={d['score']:.3f} {src}]\n{d['text']}")
    return "\n\n".join(parts)


async def ask_rag(query: str, top_k: int = 5) -> Dict:
    retrieved = await search_similar(query, top_k=top_k)
    context = format_context(retrieved)
    user_prompt = (
        f"คำถาม: {query}\n\n"
        f"ใช้ข้อมูลต่อไปนี้เป็น Context:\n{context}\n\n"
        f"ให้ตอบเป็นภาษาไทย และสรุปให้เข้าใจง่าย พร้อมอ้างอิงแหล่งที่มาด้วยรูปแบบ [#index]"
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    answer = await ollama_chat(messages)
    return {"answer": answer, "sources": retrieved}
```

### 3.5 `backend/main.py` (FastAPI endpoints)
```python
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from settings import settings
from parsers import file_to_text, simple_split
from rag_core import upsert_chunks, ask_rag

app = FastAPI(title="RAG API (Ollama + Qdrant)")

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ingest")
async def ingest(files: List[UploadFile] = File(...), chunk_size: int = Form(800), overlap: int = Form(100)):
    total_chunks = 0
    for f in files:
        raw = await f.read()
        text = file_to_text(f.filename, raw, f.content_type or "")
        chunks = simple_split(text, chunk_size=chunk_size, overlap=overlap)
        meta = {"source": "upload", "filename": f.filename}
        total_chunks += await upsert_chunks(chunks, meta)
    return {"ok": True, "chunks": total_chunks}


@app.post("/chat")
async def chat(query: str = Form(...), top_k: int = Form(5)):
    result = await ask_rag(query, top_k=top_k)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
```

### 3.6 Dockerfile (backend)
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 4) Frontend (React + Vite)

### 4.1 `frontend/package.json`
```json
{
  "name": "rag-web",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 5173"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.4.8",
    "@vitejs/plugin-react": "^4.3.1"
  }
}
```

### 4.2 `frontend/vite.config.js`
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

### 4.3 `frontend/index.html`
```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RAG Chat (Ollama)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 4.4 `frontend/src/main.jsx`
```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### 4.5 `frontend/src/styles.css`
```css
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0; }
.container { max-width: 960px; margin: 2rem auto; padding: 1rem; }
.card { border: 1px solid #ddd; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
.row { display: flex; gap: 1rem; align-items: center; }
.grid { display: grid; grid-template-columns: 1fr auto; gap: 1rem; }
button { padding: .6rem 1rem; border-radius: 8px; border: 1px solid #888; cursor: pointer; }
input[type="text"] { width: 100%; padding: .6rem; border-radius: 8px; border: 1px solid #aaa; }
.badge { background: #eef; color: #225; padding: .2rem .5rem; border-radius: 6px; font-size: .8rem; }
pre { white-space: pre-wrap; word-wrap: break-word; }
```

### 4.6 `frontend/src/lib/api.js`
```js
export async function ingestFiles(files, chunkSize=800, overlap=100) {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  form.append('chunk_size', String(chunkSize))
  form.append('overlap', String(overlap))

  const res = await fetch('/api/ingest', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Ingest failed')
  return res.json()
}

export async function chat(query, topK=5) {
  const form = new FormData()
  form.append('query', query)
  form.append('top_k', String(topK))
  const res = await fetch('/api/chat', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Chat failed')
  return res.json()
}
```

### 4.7 `frontend/src/components/FileDrop.jsx`
```jsx
import React, { useState } from 'react'
import { ingestFiles } from '../lib/api'

export default function FileDrop() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const onPick = async (ev) => {
    const files = ev.target.files
    if (!files?.length) return
    try {
      setBusy(true)
      const res = await ingestFiles(files)
      setMsg(`Indexed chunks: ${res.chunks}`)
    } catch (e) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>📄 อัปโหลดเอกสารเพื่อทำดัชนี</h3>
      <input type="file" multiple onChange={onPick} disabled={busy} />
      {msg && <p><span className="badge">{msg}</span></p>}
    </div>
  )
}
```

### 4.8 `frontend/src/components/ChatBox.jsx`
```jsx
import React, { useState } from 'react'
import { chat } from '../lib/api'

export default function ChatBox() {
  const [query, setQuery] = useState('พระพุทธเจ้าทรงบรรลุธรรมเมื่อพระชนมายุเท่าไร?')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [busy, setBusy] = useState(false)

  const ask = async () => {
    if (!query.trim()) return
    setBusy(true)
    setAnswer('')
    setSources([])
    try {
      const res = await chat(query)
      setAnswer(res.answer)
      setSources(res.sources || [])
    } catch (e) {
      setAnswer('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>💬 Chat</h3>
      <div className="grid">
        <input type="text" value={query} onChange={e=>setQuery(e.target.value)} placeholder="พิมพ์คำถาม..." />
        <button onClick={ask} disabled={busy}>{busy ? 'กำลังค้น...' : 'ถาม'}</button>
      </div>

      {answer && (
        <div>
          <h4>คำตอบ</h4>
          <pre>{answer}</pre>
        </div>
      )}

      {sources?.length > 0 && (
        <div>
          <h4>แหล่งอ้างอิง</h4>
          <ol>
            {sources.map((s, i)=> (
              <li key={i}><span className="badge">#{i+1} · {s.filename || s.source}</span> · score {s.score?.toFixed(3)}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
```

### 4.9 `frontend/src/App.jsx`
```jsx
import React from 'react'
import FileDrop from './components/FileDrop'
import ChatBox from './components/ChatBox'

export default function App() {
  return (
    <div className="container">
      <h2>🧠 RAG Chatbot (Ollama + Python + React)</h2>
      <p>อัปโหลดเอกสาร แล้วถามคำถามเพื่อดึงคำตอบจาก Context</p>
      <FileDrop />
      <ChatBox />
    </div>
  )
}
```

### 4.10 Dockerfile (frontend)
```dockerfile
# frontend/Dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json vite.config.js ./
COPY index.html ./
COPY src ./src
RUN npm install && npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

---

## 5) Run
```bash
# 1) สร้างโครงสร้างไฟล์ตามด้านบน แล้ววางโค้ด
# 2) เรียกใช้งาน
docker compose up -d --build

# 3) เปิดเว็บ
# Frontend: http://localhost:5173
# API:      http://localhost:8000/docs
# Ollama:   http://localhost:11434
# Qdrant:   http://localhost:6333/dashboard (กรณีเปิด UI เอง)
```

> เคล็ดลับ: เปลี่ยนโมเดลได้ผ่าน `.env` เช่น `LLM_MODEL=qwen2.5:latest` หรือ `EMBED_MODEL=nomic-embed-text`

---

## 6) การใช้งานกับข้อมูลตัวอย่าง (ประวัติพระพุทธเจ้า)
1) สร้างไฟล์ `buddha.txt` ใส่เนื้อหาที่ให้มา
2) อัปโหลดผ่านหน้าเว็บ (กล่องอัปโหลด) หรือใช้ curl:
```bash
curl -F "files=@buddha.txt" http://localhost:8000/ingest
```
3) ถามคำถามในหน้าเว็บ เช่น: _“พระพุทธเจ้าทรงออกผนวชเมื่อพระชนมายุเท่าไร?”_

---

## 7) Notes & ขยายผล
- **Embedding Dimension**: โค้ดจะอ่านขนาดเวกเตอร์จากผลลัพธ์จริง แล้วสร้างคอลเลกชัน Qdrant อัตโนมัติ ดังนั้นเปลี่ยน EMBED_MODEL ได้ยืดหยุ่น
- **Chunking**: ค่าเริ่มต้น 800 อักษร overlap 100 (เหมาะกับเอกสารไทยทั่วไป) ปรับได้ผ่าน form ingest
- **สตรีมคำตอบ**: หากต้องการสตรีม ให้แก้ API `/chat` ให้คืน Server-Sent Events และใช้ EventSource ฝั่ง React
- **สิทธิ์เอกสาร/ผู้ใช้หลายคน**: เติมฟิลด์ payload เช่น `tenant_id`, `tags` แล้วกรองตอนค้นหา
- **Re-ranking**: อาจเพิ่มชั้น Cross-Encoder re-rank (เช่น bge-reranker) ภายหลัง
- **Evaluation**: เพิ่ม `/debug/search?query=...` เพื่อดูผลคะแนน/เอกสารที่ดึงมา

---

## 8) Troubleshooting
- **โมเดลไม่ถูกดึง**: เช็คคอนเทนเนอร์ `ollama-init` logs หรือรัน `docker exec -it ollama ollama pull llama3.1`
- **Embeddings mismatch**: ลบคอลเลกชันเดิมหากสลับโมเดล embed คนละมิติ (ใช้ชื่อคอลเลกชันใหม่หรือ `qdrant` UI ลบ)
- **PDF Extract ว่าง**: บางไฟล์เป็นสแกนภาพ ต้อง OCR (เพิ่ม `pytesseract` + `tesseract-ocr` ใน backend)
- **CORS**: แก้ `CORS_ORIGINS` ใน `.env`

---

## 9) Security & Production Tips
- ใส่ **rate limit** และ **auth token** ที่ API
- แยก Network และใช้ `docker secrets` สำหรับ config ลับ
- เปิด **persistence/backup** ให้ Qdrant
- ใช้ **NGINX/Traefik** หน้าเว็บ และ TLS

---

> จบชุดเริ่มต้น: พร้อมให้คุณต่อยอด เช่น เพิ่ม UI citations, dark mode, ผู้ใช้หลาย tenant, และสตรีมมิงคำตอบ 🎯

---

## Constitution: Delivery Standards

### Code Quality
- Keep the codebase human-readable and self-documenting with clear naming, small modules, and purposeful comments.
- Maintain architectural boundaries and shared utilities to prevent duplication and configuration drift across services.
- Treat dependencies as liabilities: audit updates, remove dead code, and gate new packages behind clear owners.

### Testing Standards
- Guard critical flows with automated unit, integration, and end-to-end tests that run in CI before every merge.
- Require deterministic test data and isolate external services with mocks or sandboxes to keep the suite stable.
- Track coverage for backend APIs and React components, and block releases when agreed-on thresholds regress.

### User Experience Consistency
- Follow a single design system for typography, spacing, and interactive states across the React app.
- Build accessible features first: keyboard navigation, ARIA landmarks, and color-contrast checks are non-negotiable.
- Validate UX changes with product owners or user feedback loops before promotion to production.

### Performance Requirements
- Budget response times: backend endpoints must keep P95 latency under 500 ms, frontend interactions under 16 ms per frame.
- Load-test ingestion and chat flows before releases; capture regressions with continuous observability dashboards.
- Optimize data movement and caching strategies to minimize redundant calls and control infrastructure costs.
