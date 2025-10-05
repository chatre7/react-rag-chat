import React, { useCallback, useRef, useState } from 'react'
import { ingestFiles } from '../lib/api'

const ACCEPTED_TYPES = ['.txt', '.md', '.pdf', '.docx', '.csv', '.xlsx']

export default function FileDrop() {
  const [dragActive, setDragActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [tenantId, setTenantId] = useState('')
  const [tags, setTags] = useState('')
  const [pendingFiles, setPendingFiles] = useState(null)
  const inputRef = useRef(null)

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const uploadFiles = useCallback(
    async (fileList) => {
      if (!fileList || fileList.length === 0) {
        return
      }
      const trimmedTenant = tenantId.trim()
      const trimmedTags = tags.trim()
      const formData = new FormData()
      Array.from(fileList).forEach((file) => {
        formData.append('files', file)
      })
      if (trimmedTenant) {
        formData.append('tenant_id', trimmedTenant)
      }
      if (trimmedTags) {
        formData.append('tags', trimmedTags)
      }

      setBusy(true)
      setFeedback(null)
      try {
        const result = await ingestFiles(formData)
        setFeedback({
          type: 'success',
          message: `Indexed ${result.chunks_indexed} chunks from ${result.files_processed} file(s).`,
          skipped: result.skipped,
        })
        resetInput()
      } catch (error) {
        setFeedback({ type: 'error', message: error.message })
      } finally {
        setBusy(false)
      }
    },
    [tags, tenantId],
  )

  const onDrop = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    if (event.dataTransfer?.files?.length) {
      setPendingFiles(event.dataTransfer.files)
    }
  }, [])

  const onDrag = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true)
    } else if (event.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const onChange = useCallback(
    async (event) => {
      if (event.target.files?.length) {
        await uploadFiles(event.target.files)
      }
    },
    [uploadFiles],
  )

  const acceptPendingFiles = useCallback(async () => {
    if (!pendingFiles) {
      return
    }
    await uploadFiles(pendingFiles)
    setPendingFiles(null)
  }, [pendingFiles, uploadFiles])

  const cancelPendingFiles = () => {
    setPendingFiles(null)
  }

  const pendingFileNames = pendingFiles ? Array.from(pendingFiles).map((file) => file.name) : []

  return (
    <div className="card" aria-live="polite">
      <div
        className={`file-drop ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        role="group"
        aria-label="Document ingestion dropzone"
      >
        <label htmlFor="file-upload" className="file-drop-label">
          <strong>Drop files here</strong>
          <br />
          or
          <br />
          <span className="badge">Browse and ingest</span>
        </label>
        <input
          ref={inputRef}
          id="file-upload"
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onChange}
          aria-describedby="file-drop-help"
        />
        <p id="file-drop-help" className="section-description">
          Supported formats: {ACCEPTED_TYPES.join(', ')}
        </p>
        <div className="file-drop-actions">
          <div>
            <label htmlFor="tenant-id">Tenant ID (optional)</label>
            <input
              id="tenant-id"
              type="text"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="acme-co"
            />
          </div>
          <div>
            <label htmlFor="tags">Tags (comma separated)</label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="sales, playbooks"
            />
          </div>
        </div>
      </div>

      {pendingFiles && (
        <div className="card" role="dialog" aria-modal="true">
          <p>{`Process ${pendingFiles.length} file(s)?`}</p>
          <ul>
            {pendingFileNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <div className="file-drop-actions">
            <button type="button" onClick={acceptPendingFiles} disabled={busy}>
              {busy ? 'Indexing...' : 'Confirm upload'}
            </button>
            <button type="button" onClick={cancelPendingFiles} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`card ${feedback.type === 'error' ? 'error' : ''}`} role="status">
          <p>{feedback.message}</p>
          {feedback.skipped && Object.keys(feedback.skipped).length > 0 && (
            <ul>
              {Object.entries(feedback.skipped).map(([filename, reason]) => (
                <li key={filename}>
                  <strong>{filename}</strong>: {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

