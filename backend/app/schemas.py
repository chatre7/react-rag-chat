from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, constr


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


TenantID = constr(strip_whitespace=True, to_lower=True, min_length=1, max_length=64)
TenantName = constr(strip_whitespace=True, min_length=1, max_length=128)


class TenantBase(BaseModel):
    tenant_id: TenantID
    name: TenantName
    status: str = Field('active', regex='^(active|paused)$')
    tags: List[str] = Field(default_factory=list)


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[TenantName] = None
    status: Optional[str] = Field(None, regex='^(active|paused)$')
    tags: Optional[List[str]] = None


class TenantRead(TenantBase):
    created_at: datetime
    updated_at: datetime


class TenantListResponse(BaseModel):
    tenants: List[TenantRead]


class TenantSegmentsResponse(BaseModel):
    tenant_id: TenantID
    segments_indexed: int
