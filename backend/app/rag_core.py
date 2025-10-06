import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx
from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchAny,
    MatchValue,
    PointStruct,
    VectorParams,
)

from .settings import Settings

logger = logging.getLogger(__name__)


@dataclass
class DocumentChunk:
    chunk_id: str
    text: str
    metadata: Dict[str, Any]


@dataclass
class RetrievedChunk:
    text: str
    score: float
    metadata: Dict[str, Any]


class RAGPipeline:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        api_key = settings.qdrant_api_key or None
        self.client = QdrantClient(url=settings.qdrant_url, api_key=api_key)
        self._collection_ready = False
        self._collection_lock = asyncio.Lock()

    async def ensure_collection(self) -> None:
        if self._collection_ready:
            return
        async with self._collection_lock:
            if self._collection_ready:
                return
            try:
                self.client.get_collection(self.settings.collection_name)
                self._collection_ready = True
                return
            except UnexpectedResponse:
                logger.info('Collection %s not found; creating', self.settings.collection_name)
            vector_size = await self._embedding_dimension()
            await asyncio.to_thread(
                self.client.recreate_collection,
                collection_name=self.settings.collection_name,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )
            self._collection_ready = True
            logger.info('Collection %s created (dimension=%s)', self.settings.collection_name, vector_size)

    async def _embedding_dimension(self) -> int:
        vector = await self.embed_text('dimension probe')
        return len(vector)

    async def embed_text(self, text: str) -> List[float]:
        payload = {'model': self.settings.embed_model, 'prompt': text, 'input': text}
        url = f"{self.settings.ollama_host}/api/embeddings"
        max_attempts = 5
        backoff = 1.0

        for attempt in range(1, max_attempts + 1):
            async with httpx.AsyncClient(timeout=self.settings.ollama_timeout) as client:
                try:
                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                except httpx.HTTPStatusError as exc:
                    content_type = exc.response.headers.get('content-type', '')
                    detail = exc.response.json() if content_type.startswith('application/json') else exc.response.text
                    logger.error('Embedding request failed: %s', detail)
                    raise ValueError(f'Embedding request failed: {detail}') from exc
                data = response.json()

            embedding = data.get('embedding') if isinstance(data, dict) else None
            if embedding and len(embedding) > 0:
                return embedding

            if isinstance(data, dict):
                if 'data' in data and data['data']:
                    candidate = data['data'][0].get('embedding')
                    if candidate and len(candidate) > 0:
                        return candidate
                if 'error' in data:
                    logger.error('Embedding error from Ollama: %s', data['error'])
                    raise ValueError(f'Embedding error from Ollama: {data["error"]}')

            logger.warning('Empty embedding response (attempt %s/%s): %s', attempt, max_attempts, data)
            if attempt < max_attempts:
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 8.0)

        logger.error('Embedding service returned empty vectors after %s attempts', max_attempts)
        raise ValueError('Embedding response missing "embedding" field')

    async def upsert_chunks(self, chunks: List[DocumentChunk]) -> int:
        await self.ensure_collection()
        valid_chunks: List[DocumentChunk] = [chunk for chunk in chunks if chunk.text.strip()]
        if not valid_chunks:
            return 0
        vectors: List[List[float]] = []
        for chunk in valid_chunks:
            vectors.append(await self.embed_text(chunk.text))
        points = [
            PointStruct(
                id=chunk.chunk_id,
                vector=vector,
                payload={**chunk.metadata, 'text': chunk.text},
            )
            for chunk, vector in zip(valid_chunks, vectors)
        ]
        await asyncio.to_thread(
            self.client.upsert,
            collection_name=self.settings.collection_name,
            wait=True,
            points=points,
        )
        return len(points)

    async def retrieve(
        self,
        query: str,
        top_k: int,
        tenant_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> List[RetrievedChunk]:
        await self.ensure_collection()
        if not query.strip():
            return []
        query_vector = await self.embed_text(query)
        query_filter = self._build_filter(tenant_id, tags)
        try:
            results = await asyncio.to_thread(
                self.client.search,
                collection_name=self.settings.collection_name,
                query_vector=query_vector,
                limit=top_k,
                query_filter=query_filter,
            )
        except UnexpectedResponse:
            logger.warning('Collection %s missing during search; recreating', self.settings.collection_name)
            self._collection_ready = False
            return []
        retrieved: List[RetrievedChunk] = []
        for point in results:
            payload = point.payload or {}
            text = payload.get('text', '')
            retrieved.append(
                RetrievedChunk(
                    text=text,
                    score=point.score,
                    metadata=payload,
                )
            )
        return retrieved

    async def count_segments(self, tenant_id: str) -> int:
        await self.ensure_collection()
        query_filter = self._build_filter(tenant_id, None)
        try:
            response = await asyncio.to_thread(
                self.client.count,
                collection_name=self.settings.collection_name,
                count_filter=query_filter,
                exact=True,
            )
        except UnexpectedResponse:
            logger.warning('Collection %s missing during count; recreating', self.settings.collection_name)
            self._collection_ready = False
            return 0
        if isinstance(response, dict):
            return int(response.get('count', 0))
        return int(getattr(response, 'count', 0))

    def split_text(self, text: str) -> List[str]:
        normalized = text.replace('\r\n', '\n').strip()
        if not normalized:
            return []
        chunk_size = self.settings.chunk_size
        overlap = min(self.settings.chunk_overlap, chunk_size - 1 if chunk_size > 1 else 0)
        chunks: List[str] = []
        start = 0
        while start < len(normalized):
            end = start + chunk_size
            chunk = normalized[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            if end >= len(normalized):
                break
            start = max(0, end - overlap)
        return chunks

    def _build_filter(
        self,
        tenant_id: Optional[str],
        tags: Optional[List[str]],
    ) -> Optional[Filter]:
        conditions: List[FieldCondition] = []
        if tenant_id:
            conditions.append(FieldCondition(key='tenant_id', match=MatchValue(value=tenant_id)))
        if tags:
            conditions.append(FieldCondition(key='tags', match=MatchAny(any=tags)))
        if conditions:
            return Filter(must=conditions)
        return None

    async def generate_answer(
        self,
        query: str,
        retrieved: List[RetrievedChunk],
        conversation: Optional[List[Dict[str, str]]] = None,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        context_text, sources = self._format_context(retrieved)
        user_prompt = (
            'Answer the question using the provided context. '
            'If the answer is not in the context, say you do not know.\n\n'
            f'Context:\n{context_text}\n\nQuestion: {query}\nAnswer:'
        )
        messages: List[Dict[str, str]] = [
            {'role': 'system', 'content': self.settings.system_prompt},
        ]
        if conversation:
            for item in conversation:
                role = item.get('role')
                content = item.get('content')
                if role in {'user', 'assistant'} and content:
                    messages.append({'role': role, 'content': content})
        messages.append({'role': 'user', 'content': user_prompt})

        payload = {
            'model': self.settings.llm_model,
            'messages': messages,
            'stream': False,
            'options': {'temperature': self.settings.temperature},
        }
        url = f"{self.settings.ollama_host}/api/chat"
        async with httpx.AsyncClient(timeout=self.settings.ollama_timeout) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        message = data.get('message', {})
        answer = message.get('content', '').strip()
        return answer, sources

    def _format_context(self, retrieved: List[RetrievedChunk]) -> Tuple[str, List[Dict[str, Any]]]:
        if not retrieved:
            return 'No supporting documents available.', []
        max_chars = self.settings.max_context_chars
        used = 0
        context_lines: List[str] = []
        sources: List[Dict[str, Any]] = []
        for index, chunk in enumerate(retrieved, start=1):
            text = chunk.text.strip()
            if not text:
                continue
            remaining = max_chars - used
            if remaining <= 0:
                break
            snippet = text[:remaining]
            source_name = chunk.metadata.get('source', 'unknown')
            context_lines.append(f'[Source {index}] {source_name}\n{snippet}\n')
            used += len(snippet)
            sources.append(
                {
                    'source': source_name,
                    'score': chunk.score,
                    'text': snippet,
                    'chunk_id': chunk.metadata.get('chunk_id'),
                }
            )
        if not context_lines:
            return 'No supporting documents available.', sources
        return '\n'.join(context_lines), sources
