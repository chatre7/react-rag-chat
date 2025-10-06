import asyncio
import json
from pathlib import Path
from typing import Dict, List, Optional

from .schemas import TenantRead


class TenantStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._lock = asyncio.Lock()

    async def initialise(self) -> None:
        async with self._lock:
            if not self._file_path.parent.exists():
                self._file_path.parent.mkdir(parents=True, exist_ok=True)
            if not self._file_path.exists():
                await asyncio.to_thread(
                    self._file_path.write_text,
                    json.dumps({'tenants': []}, indent=2),
                )

    async def _read(self) -> Dict[str, List[Dict[str, object]]]:
        await self.initialise()
        data = await asyncio.to_thread(self._file_path.read_text)
        if not data:
            return {'tenants': []}
        return json.loads(data)

    async def _write(self, payload: Dict[str, List[Dict[str, object]]]) -> None:
        await asyncio.to_thread(self._file_path.write_text, json.dumps(payload, indent=2))

    async def list(self) -> List[Dict[str, object]]:
        data = await self._read()
        return data['tenants']

    async def get(self, tenant_id: str) -> Optional[Dict[str, object]]:
        tenants = await self.list()
        for item in tenants:
            if item['tenant_id'] == tenant_id:
                return item
        return None

    async def create(self, record: Dict[str, object]) -> TenantRead:
        async with self._lock:
            data = await self._read()
            if any(item['tenant_id'] == record['tenant_id'] for item in data['tenants']):
                raise ValueError('Tenant already exists')
            data['tenants'].append(record)
            await self._write(data)
            return TenantRead(**record)

    async def update(self, tenant_id: str, updates: Dict[str, object]) -> Optional[TenantRead]:
        async with self._lock:
            data = await self._read()
            for index, item in enumerate(data['tenants']):
                if item['tenant_id'] == tenant_id:
                    item.update(updates)
                    data['tenants'][index] = item
                    await self._write(data)
                    return TenantRead(**item)
        return None

    async def delete(self, tenant_id: str) -> bool:
        async with self._lock:
            data = await self._read()
            remaining = [item for item in data['tenants'] if item['tenant_id'] != tenant_id]
            if len(remaining) == len(data['tenants']):
                return False
            data['tenants'] = remaining
            await self._write(data)
            return True
