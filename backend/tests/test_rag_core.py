from app import rag_core
from app.settings import Settings


class DummyQdrantClient:
    def __init__(self, *_, **__):
        pass


def make_pipeline(monkeypatch, **settings_overrides):
    monkeypatch.setattr(rag_core, 'QdrantClient', lambda *args, **kwargs: DummyQdrantClient())
    settings = Settings(**settings_overrides)
    return rag_core.RAGPipeline(settings)


def test_split_text_respects_overlap(monkeypatch):
    pipeline = make_pipeline(monkeypatch, chunk_size=10, chunk_overlap=3)
    text = 'abcdefghij' * 3  # 30 chars
    chunks = pipeline.split_text(text)
    assert len(chunks) == 4
    assert all(len(chunk) <= 10 for chunk in chunks)
    for first, second in zip(chunks, chunks[1:]):
        assert first[-3:] == second[:3]


def test_build_filter_handles_tenant_and_tags(monkeypatch):
    pipeline = make_pipeline(monkeypatch)
    filter_obj = pipeline._build_filter('tenant-1', ['sales', 'playbooks'])
    assert filter_obj is not None
    keys = [condition.key for condition in filter_obj.must]
    assert 'tenant_id' in keys
    assert 'tags' in keys


def test_build_filter_none_when_no_inputs(monkeypatch):
    pipeline = make_pipeline(monkeypatch)
    assert pipeline._build_filter(None, None) is None
