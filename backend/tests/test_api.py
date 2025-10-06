import contextlib
from typing import List, Optional

import pytest
from fastapi.testclient import TestClient

from app.main import app as fastapi_app
from app.main import get_pipeline as get_pipeline_dependency
from app import main as main_module
from app.rag_core import RetrievedChunk


class StubPipeline:
    def __init__(self) -> None:
        self.upsert_payload = None
        self.retrieve_args = None
        self.ensure_called = False

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
        return ('Stub answer for ' + query, [{'source': 'doc.txt', 'score': 0.88, 'text': 'Context snippet', 'chunk_id': 'chunk-1'}])


@pytest.fixture()
def client():
    stub = StubPipeline()
    original_pipeline = getattr(main_module, '_pipeline', None)
    main_module._pipeline = stub
    fastapi_app.dependency_overrides[get_pipeline_dependency] = lambda: stub
    with TestClient(fastapi_app) as test_client:
        yield test_client, stub
    fastapi_app.dependency_overrides.clear()
    if original_pipeline is not None:
        main_module._pipeline = original_pipeline
    else:
        with contextlib.suppress(AttributeError):
            delattr(main_module, '_pipeline')


def test_health_endpoint(client):
    http, _ = client
    response = http.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_ingest_uploads_file(client):
    http, stub = client
    files = {'files': ('guides.txt', b'AI testing guide', 'text/plain')}
    response = http.post('/ingest', files=files, data={'tenant_id': 'acme', 'tags': 'docs,testing'})
    assert response.status_code == 200
    body = response.json()
    assert body['files_processed'] == 1
    assert body['chunks_indexed'] == 1
    assert stub.upsert_payload is not None
    chunk_metadata = stub.upsert_payload[0].metadata
    assert chunk_metadata['tenant_id'] == 'acme'
    assert 'testing' in chunk_metadata['tags']


def test_chat_returns_answer_and_sources(client):
    http, stub = client
    payload = {
        'query': 'What is AI?',
        'top_k': 3,
        'tenant_id': 'acme',
        'tags': ['docs'],
        'conversation': [{'role': 'user', 'content': 'Hi'}],
    }
    response = http.post('/chat', json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body['answer'].startswith('Stub answer')
    assert len(body['sources']) == 1
    assert body['sources'][0]['source'] == 'doc.txt'
    assert stub.retrieve_args == ('What is AI?', 3, 'acme', ['docs'])



def test_swagger_ui_served(client):
    http, _ = client
    response = http.get('/swagger')
    assert response.status_code == 200
    assert 'Swagger UI' in response.text
