from functools import lru_cache
from pathlib import Path

from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    api_host: str = Field('0.0.0.0', env='API_HOST')
    api_port: int = Field(8000, env='API_PORT')
    cors_origins: str = Field('*', env='CORS_ORIGINS')

    ollama_host: str = Field('http://ollama:11434', env='OLLAMA_HOST')
    llm_model: str = Field('llama3.1', env='LLM_MODEL')
    embed_model: str = Field('mxbai-embed-large', env='EMBED_MODEL')
    ollama_timeout: int = Field(120, env='OLLAMA_TIMEOUT')

    qdrant_url: str = Field('http://qdrant:6333', env='QDRANT_URL')
    qdrant_api_key: str = Field('', env='QDRANT_API_KEY')
    collection_name: str = Field('rag_documents', env='QDRANT_COLLECTION')

    data_dir: Path = Field(Path('data'), env='DATA_DIR')

    chunk_size: int = Field(800, env='CHUNK_SIZE')
    chunk_overlap: int = Field(100, env='CHUNK_OVERLAP')
    default_top_k: int = Field(4, env='TOP_K')
    max_context_chars: int = Field(4000, env='MAX_CONTEXT_CHARS')

    system_prompt: str = Field(
        'You are JamAI, a calm assistant who answers using the provided context. '
        'Decline when the answer is not in the context. Cite sources when possible.',
        env='SYSTEM_PROMPT',
    )
    temperature: float = Field(0.2, env='LLM_TEMPERATURE')

    class Config:
        env_file = '.env'
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings
