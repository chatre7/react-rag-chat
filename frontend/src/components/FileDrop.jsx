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
    'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-200',
    dragActive ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200' : 'hover:border-indigo-400 hover:bg-white',
  ].join(' ')

  return (
    <div className='space-y-6'>
      <div
        className={dropZoneClass}
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        role='group'
        aria-label='Document ingestion dropzone'
      >
        <label htmlFor='file-upload' className='flex cursor-pointer flex-col items-center gap-2 text-slate-600'>
          <span className='inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600'>Drop files</span>
          <h3 className='text-lg font-semibold text-slate-800'>or click to browse</h3>
          <p className='text-sm text-slate-500'>Files are securely processed before upload.</p>
        </label>
        <input
          ref={inputRef}
          id='file-upload'
          type='file'
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onChange}
          className='hidden'
          aria-describedby='file-drop-help'
        />
        <p id='file-drop-help' className='text-xs text-slate-400'>Supported formats: {ACCEPTED_TYPES.join(', ')}</p>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <div className='space-y-2'>
          <label htmlFor='tenant-id' className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Tenant ID (optional)</label>
          <input
            id='tenant-id'
            type='text'
            className='w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200'
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder='acme-co'
          />
        </div>
        <div className='space-y-2'>
          <label htmlFor='tags' className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Tags (comma separated)</label>
          <input
            id='tags'
            type='text'
            className='w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200'
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder='sales, playbooks'
          />
        </div>
      </div>

      {pendingFiles && (
        <div className='space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5'>
          <div className='flex items-center justify-between'>
            <h4 className='text-base font-semibold text-slate-900'>Confirm upload</h4>
            <span className='inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-600'>{pendingFiles.length} file(s)</span>
          </div>
          <ul className='list-disc space-y-1 pl-5 text-sm text-slate-600'>
            {pendingFileNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <div className='flex flex-wrap gap-3'>
            <button
              type='button'
              onClick={acceptPendingFiles}
              className='inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300'
              disabled={busy}
            >
              {busy ? 'Indexing...' : 'Process files'}
            </button>
            <button
              type='button'
              onClick={cancelPendingFiles}
              className='inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400'
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
              ? 'rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'
              : 'rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700'
          }
          role='status'
        >
          <p className='text-sm font-medium'>{feedback.message}</p>
          {feedback.skipped && Object.keys(feedback.skipped).length > 0 && (
            <ul className='mt-3 space-y-1 text-xs text-slate-500'>
              {Object.entries(feedback.skipped).map(([filename, reason]) => (
                <li key={filename} className='flex items-start gap-2'>
                  <span className='font-semibold text-slate-700'>{filename}</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
