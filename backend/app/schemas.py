from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., regex='^(user|assistant)$')
    content: str


class ChatRequest(BaseModel):
    query: str
    top_k: Optional[int] = Field(None, ge=1, le=20)
    tenant_id: Optional[str] = None
    tags: Optional[List[str]] = None
    conversation: Optional[List[ChatMessage]] = None


class SourceChunk(BaseModel):
    source: str
    score: float
    text: str
    chunk_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceChunk]


class IngestResponse(BaseModel):
    files_processed: int
    chunks_indexed: int
    skipped: Dict[str, str]


class DebugSearchResponse(BaseModel):
    query: str
    results: List[Dict[str, Any]]
