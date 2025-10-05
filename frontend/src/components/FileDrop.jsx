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

      const formData = new FormData()
      Array.from(fileList).forEach((file) => {
        formData.append('files', file)
      })

      const trimmedTenant = tenantId.trim()
      const trimmedTags = tags.trim()
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

  const dropZoneClass = [
    'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-cyan-400/30 bg-slate-900/40 px-6 py-12 text-center transition focus-within:outline-none focus-within:ring-2 focus-within:ring-cyan-400/50',
    dragActive ? 'border-cyan-300 bg-cyan-500/10 ring-2 ring-cyan-400/50' : 'hover:border-cyan-300/60 hover:bg-slate-900/60',
  ].join(' ')

  return (
    <div
      className="space-y-6 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
      aria-live="polite"
    >
      <div
        className={dropZoneClass}
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        role="group"
        aria-label="Document ingestion dropzone"
      >
        <label htmlFor="file-upload" className="flex cursor-pointer flex-col items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/15 px-3 py-1 text-sm font-medium text-cyan-200">
            Drop files
          </span>
          <h3 className="text-lg font-semibold text-slate-100">or click to browse</h3>
          <p className="text-sm text-slate-300">We&apos;ll index everything client-side before sending.</p>
        </label>
        <input
          ref={inputRef}
          id="file-upload"
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onChange}
          className="hidden"
          aria-describedby="file-drop-help"
        />
        <p id="file-drop-help" className="text-xs text-slate-400">
          Supported formats: {ACCEPTED_TYPES.join(', ')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="tenant-id" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Tenant ID (optional)
          </label>
          <input
            id="tenant-id"
            type="text"
            className="w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="acme-co"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="tags" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Tags (comma separated)
          </label>
          <input
            id="tags"
            type="text"
            className="w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="sales, playbooks"
          />
        </div>
      </div>

      {pendingFiles && (
        <div className="space-y-4 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-6">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-slate-100">Confirm upload</h4>
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/15 px-3 py-1 text-sm font-medium text-cyan-200">
              {pendingFiles.length} file(s)
            </span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {pendingFileNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={acceptPendingFiles}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:shadow-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              disabled={busy}
            >
              {busy ? 'Indexing...' : 'Process files'}
            </button>
            <button
              type="button"
              onClick={cancelPendingFiles}
              className="inline-flex items-center justify-center rounded-full border border-slate-600/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-400/80 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={
            feedback.type === 'error'
              ? 'rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100'
              : 'rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100'
          }
          role="status"
        >
          <p className="text-sm font-medium">{feedback.message}</p>
          {feedback.skipped && Object.keys(feedback.skipped).length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {Object.entries(feedback.skipped).map(([filename, reason]) => (
                <li key={filename} className="flex items-start gap-2">
                  <span className="font-semibold text-slate-100">{filename}</span>
                  <span className="text-slate-200/80">{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
