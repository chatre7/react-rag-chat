import logging
import uuid
from typing import List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .parsers import UnsupportedFileTypeError, extract_text
from .rag_core import DocumentChunk, RAGPipeline
from .schemas import ChatRequest, ChatResponse, DebugSearchResponse, IngestResponse, SourceChunk
from .settings import Settings, get_settings

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(title='AI RAG API', version='1.0.0')


def _cors_list(origins: str) -> List[str]:
    if origins == '*':
        return ['*']
    return [origin.strip() for origin in origins.split(',') if origin.strip()]


settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
_pipeline = RAGPipeline(settings)


def get_pipeline(_: Settings = Depends(get_settings)) -> RAGPipeline:
    return _pipeline


@app.on_event('startup')
async def _startup() -> None:
    await _pipeline.ensure_collection()


@app.get('/health')
async def health_check() -> dict:
    return {'status': 'ok'}


@app.post('/ingest', response_model=IngestResponse)
async def ingest_documents(
    files: List[UploadFile] = File(...),
    tenant_id: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    pipeline: RAGPipeline = Depends(get_pipeline),
) -> IngestResponse:
    if not files:
        raise HTTPException(status_code=400, detail='No files uploaded')

    tag_list = [tag.strip() for tag in tags.split(',')] if tags else []
    tag_list = [tag for tag in tag_list if tag]

    processed = 0
    skipped = {}
    chunks: List[DocumentChunk] = []

    for upload in files:
        data = await upload.read()
        try:
            text = extract_text(upload.filename or 'document', data)
        except UnsupportedFileTypeError as exc:
            skipped[upload.filename or 'unknown'] = str(exc)
            continue
        if not text.strip():
            skipped[upload.filename or 'unknown'] = 'File contained no readable text'
            continue
        processed += 1
        for index, chunk_text in enumerate(pipeline.split_text(text)):
            chunk_id = str(uuid.uuid4())
            metadata = {
                'source': upload.filename or 'document',
                'chunk_index': index,
                'chunk_id': chunk_id,
            }
            if tenant_id:
                metadata['tenant_id'] = tenant_id
            if tag_list:
                metadata['tags'] = tag_list
            chunks.append(DocumentChunk(chunk_id=chunk_id, text=chunk_text, metadata=metadata))

    if not chunks:
        return IngestResponse(files_processed=processed, chunks_indexed=0, skipped=skipped)

    try:
        count = await pipeline.upsert_chunks(chunks)
    except Exception as exc:  # pragma: no cover
        logger.exception('Failed to index documents: %s', exc)
        raise HTTPException(status_code=500, detail='Failed to index documents')

    return IngestResponse(files_processed=processed, chunks_indexed=count, skipped=skipped)


@app.post('/chat', response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    pipeline: RAGPipeline = Depends(get_pipeline),
) -> ChatResponse:
    top_k = request.top_k or settings.default_top_k
    retrieved = await pipeline.retrieve(
        query=request.query,
        top_k=top_k,
        tenant_id=request.tenant_id,
        tags=request.tags,
    )
    conversation = [msg.dict() for msg in request.conversation] if request.conversation else None
    answer, sources = await pipeline.generate_answer(request.query, retrieved, conversation)
    source_models = [SourceChunk(**source) for source in sources]
    return ChatResponse(answer=answer or 'I do not have enough information to answer that yet.', sources=source_models)


@app.get('/debug/search', response_model=DebugSearchResponse)
async def debug_search(
    query: str,
    top_k: int = 4,
    tenant_id: Optional[str] = None,
    tags: Optional[str] = None,
    pipeline: RAGPipeline = Depends(get_pipeline),
) -> DebugSearchResponse:
    tag_list = [tag.strip() for tag in tags.split(',')] if tags else []
    tag_list = [tag for tag in tag_list if tag]
    retrieved = await pipeline.retrieve(query, top_k, tenant_id, tag_list)
    results = [
        {
            'source': item.metadata.get('source'),
            'score': item.score,
            'text': item.text,
            'metadata': item.metadata,
        }
        for item in retrieved
    ]
    return DebugSearchResponse(query=query, results=results)


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(
        'app.main:app',
        host=settings.api_host,
        port=settings.api_port,
        reload=False,
    )
