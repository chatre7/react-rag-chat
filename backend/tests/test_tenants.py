import asyncio
import contextlib
from pathlib import Path
from typing import List, Optional

import pytest
from fastapi.testclient import TestClient

from app.main import app as fastapi_app
from app.main import get_pipeline as get_pipeline_dependency
from app.main import get_tenant_store as get_tenant_store_dependency
from app import main as main_module
from app.rag_core import RetrievedChunk
from app.tenant_store import TenantStore


class StubPipeline:
    def __init__(self) -> None:
        self.upsert_payload = None
        self.retrieve_args = None
        self.ensure_called = False
        self.segment_counts = {}

    async def ensure_collection(self) -> None:
        self.ensure_called = True

    def split_text(self, text: str) -> List[str]:
        return [text]

    async def upsert_chunks(self, chunks):
        self.upsert_payload = chunks
        return len(chunks)

    async def retrieve(
        self,
        query: str,
        top_k: int,
        tenant_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> List[RetrievedChunk]:
        self.retrieve_args = (query, top_k, tenant_id, tags)
        return [
            RetrievedChunk(
                text='Context snippet',
                score=0.88,
                metadata={'source': 'doc.txt', 'chunk_id': 'chunk-1'},
            )
        ]

    async def generate_answer(self, query, retrieved, conversation=None):
        return (
            'Stub answer for ' + query,
            [{'source': 'doc.txt', 'score': 0.88, 'text': 'Context snippet', 'chunk_id': 'chunk-1'}],
        )

    async def count_segments(self, tenant_id: str) -> int:
        return self.segment_counts.get(tenant_id, 0)


@pytest.fixture()
def tenant_store(tmp_path: Path) -> TenantStore:
    store = TenantStore(tmp_path / 'tenants.json')
    return store


@pytest.fixture()
def client(tenant_store: TenantStore):
    stub = StubPipeline()
    original_pipeline = getattr(main_module, '_pipeline', None)
    original_store = getattr(main_module, '_tenant_store', None)
    main_module._pipeline = stub
    main_module._tenant_store = tenant_store
    fastapi_app.dependency_overrides[get_pipeline_dependency] = lambda: stub
    fastapi_app.dependency_overrides[get_tenant_store_dependency] = lambda: tenant_store
    with TestClient(fastapi_app) as test_client:
        yield test_client, stub, tenant_store
    fastapi_app.dependency_overrides.clear()
    if original_pipeline is not None:
        main_module._pipeline = original_pipeline
    else:
        with contextlib.suppress(AttributeError):
            delattr(main_module, '_pipeline')
    if original_store is not None:
        main_module._tenant_store = original_store
    else:
        with contextlib.suppress(AttributeError):
            delattr(main_module, '_tenant_store')


def test_create_list_get_tenant(client):
    http, _, _ = client
    payload = {
        'tenant_id': 'acme',
        'name': 'Acme Corp',
        'status': 'active',
        'tags': ['enterprise'],
    }
    response = http.post('/tenants', json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body['tenant_id'] == 'acme'
    assert body['name'] == 'Acme Corp'
    assert body['tags'] == ['enterprise']
    assert 'created_at' in body and 'updated_at' in body

    list_response = http.get('/tenants')
    assert list_response.status_code == 200
    tenants = list_response.json()['tenants']
    assert len(tenants) == 1
    assert tenants[0]['tenant_id'] == 'acme'

    get_response = http.get('/tenants/acme')
    assert get_response.status_code == 200
    assert get_response.json()['tenant_id'] == 'acme'


def test_update_and_delete_tenant(client):
    http, _, _ = client
    create_payload = {
        'tenant_id': 'globex',
        'name': 'Globex',
        'status': 'active',
        'tags': [],
    }
    http.post('/tenants', json=create_payload)

    update_response = http.put('/tenants/globex', json={'status': 'paused', 'tags': ['demo']})
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated['status'] == 'paused'
    assert updated['tags'] == ['demo']

    delete_response = http.delete('/tenants/globex')
    assert delete_response.status_code == 204
    assert http.get('/tenants/globex').status_code == 404


def test_segments_endpoint(client):
    http, stub, _ = client
    http.post(
        '/tenants',
        json={'tenant_id': 'initech', 'name': 'Initech', 'status': 'active', 'tags': []},
    )
    stub.segment_counts['initech'] = 42

    response = http.get('/tenants/initech/segments')
    assert response.status_code == 200
    assert response.json()['segments_indexed'] == 42


def test_ingest_requires_registered_tenant(client):
    http, _, _ = client
    files = {'files': ('doc.txt', b'content', 'text/plain')}
    response = http.post('/ingest', files=files, data={'tenant_id': 'unknown'})
    assert response.status_code == 400
    assert response.json()['detail'] == 'Tenant is not registered'


def test_chat_requires_registered_tenant(client):
    http, _, _ = client
    payload = {'query': 'What is JamAI?', 'tenant_id': 'missing'}
    response = http.post('/chat', json=payload)
    assert response.status_code == 400
    assert response.json()['detail'] == 'Tenant is not registered'
