import logging
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .parsers import UnsupportedFileTypeError, extract_text
from .rag_core import DocumentChunk, RAGPipeline
from .schemas import (
    ChatRequest,
    ChatResponse,
    DebugSearchResponse,
    IngestResponse,
    SourceChunk,
    TenantCreate,
    TenantListResponse,
    TenantRead,
    TenantSegmentsResponse,
    TenantUpdate,
)
from .settings import Settings, get_settings
from .tenant_store import TenantStore

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

settings = get_settings()

app = FastAPI(title='JamAI RAG API', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origins] if settings.cors_origins != '*' else ['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

_pipeline = RAGPipeline(settings)
_tenant_store = TenantStore(settings.data_dir / 'tenants.json')


def get_pipeline(_: Settings = Depends(get_settings)) -> RAGPipeline:
    return _pipeline


def get_tenant_store(_: Settings = Depends(get_settings)) -> TenantStore:
    return _tenant_store


tenant_router = APIRouter(prefix='/tenants', tags=['tenants'])


@tenant_router.get('', response_model=TenantListResponse)
async def list_tenants(store: TenantStore = Depends(get_tenant_store)) -> TenantListResponse:
    records = await store.list()
    tenants = [TenantRead(**record) for record in records]
    return TenantListResponse(tenants=tenants)


@tenant_router.post('', response_model=TenantRead, status_code=201)
async def create_tenant(payload: TenantCreate, store: TenantStore = Depends(get_tenant_store)) -> TenantRead:
    now = datetime.utcnow()
    record = {
        **payload.dict(),
        'created_at': now.isoformat() + 'Z',
        'updated_at': now.isoformat() + 'Z',
    }
    try:
        tenant = await store.create(record)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return tenant


@tenant_router.get('/{tenant_id}', response_model=TenantRead)
async def get_tenant(tenant_id: str, store: TenantStore = Depends(get_tenant_store)) -> TenantRead:
    record = await store.get(tenant_id)
    if not record:
        raise HTTPException(status_code=404, detail='Tenant not found')
    return TenantRead(**record)


@tenant_router.put('/{tenant_id}', response_model=TenantRead)
async def update_tenant(
    tenant_id: str,
    payload: TenantUpdate,
    store: TenantStore = Depends(get_tenant_store),
) -> TenantRead:
    existing = await store.get(tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail='Tenant not found')
    updates = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    updates['updated_at'] = datetime.utcnow().isoformat() + 'Z'
    tenant = await store.update(tenant_id, updates)
    if not tenant:
        raise HTTPException(status_code=404, detail='Tenant not found')
    return tenant


@tenant_router.delete('/{tenant_id}', status_code=204)
async def delete_tenant(tenant_id: str, store: TenantStore = Depends(get_tenant_store)) -> None:
    removed = await store.delete(tenant_id)
    if not removed:
        raise HTTPException(status_code=404, detail='Tenant not found')


@tenant_router.get('/{tenant_id}/segments', response_model=TenantSegmentsResponse)
async def count_segments(
    tenant_id: str,
    store: TenantStore = Depends(get_tenant_store),
    pipeline: RAGPipeline = Depends(get_pipeline),
) -> TenantSegmentsResponse:
    if not await store.get(tenant_id):
        raise HTTPException(status_code=404, detail='Tenant not found')
    segments = await pipeline.count_segments(tenant_id)
    return TenantSegmentsResponse(tenant_id=tenant_id, segments_indexed=segments)


app.include_router(tenant_router)


@app.on_event('startup')
async def _startup() -> None:
    await _tenant_store.initialise()
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
    store: TenantStore = Depends(get_tenant_store),
) -> IngestResponse:
    if not files:
        raise HTTPException(status_code=400, detail='No files uploaded')

    if tenant_id and not await store.get(tenant_id):
        raise HTTPException(status_code=400, detail='Tenant is not registered')

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
    store: TenantStore = Depends(get_tenant_store),
) -> ChatResponse:
    if request.tenant_id and not await store.get(request.tenant_id):
        raise HTTPException(status_code=400, detail='Tenant is not registered')
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
