const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed (${response.status})`)
  }
  return response.json()
}

export async function ingestFiles(formData) {
  const response = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse(response)
}

export async function chatWithRag(payload) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function debugSearch(params) {
  const qs = new URLSearchParams(params)
  const response = await fetch(`${API_BASE}/debug/search?${qs.toString()}`)
  return handleResponse(response)
}
