import React, { useCallback, useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import FileDrop from './components/FileDrop'
import ChatBox from './components/ChatBox'

const SIDEBAR_PREFERENCE_KEY = 'jamai.sidebarCollapsed'
const MOBILE_SIDEBAR_PREFERENCE_KEY = 'jamai.mobileSidebarOpen'

const snapshotItems = [
  { label: 'Active tenants', value: 'Pending' },
  { label: 'Tagged collections', value: 'Pending' },
  { label: 'Knowledge files indexed', value: 'Upload to begin' },
]

const navigation = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', to: '/' },
      { label: 'Snapshot', to: '/snapshot' },
      { label: 'Knowledge', to: '/knowledge' },
      { label: 'Tenants', to: '/tenants' },
      { label: 'Chat', to: '/chat' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Debug search', to: '/debug-search' },
      { label: 'Reporting', to: '/reporting' },
    ],
  },
]

function SnapshotPanel({ items }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Workspace snapshot</h2>
          <p className="mt-2 text-sm text-slate-500">Monitor ingestion at a glance while you curate your corpus.</p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">Live</span>
      </div>
      <dl className="mt-6 grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <dt className="font-medium text-slate-500">{item.label}</dt>
            <dd className="text-slate-900">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function KnowledgePanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Knowledge ingestion</h2>
          <p className="mt-1 text-sm text-slate-500">Upload documents and tag them for scoped retrieval.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
          txt | md | pdf | docx | csv | xlsx
        </span>
      </div>
      <div className="mt-6">
        <FileDrop />
      </div>
    </section>
  )
}

function ChatPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Contextual chat</h2>
          <p className="mt-1 text-sm text-slate-500">Ask questions grounded by your curated knowledge base.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-600">
          Citations ready
        </span>
      </div>
      <div className="mt-6">
        <ChatBox />
      </div>
    </section>
  )
}

function TenantsPage() {
  const tenants = [
    { name: 'Acme Corp', id: 'acme', segments: 12, status: 'Active' },
    { name: 'Globex', id: 'globex', segments: 5, status: 'Paused' },
    { name: 'Initech', id: 'initech', segments: 8, status: 'Active' },
  ]
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Tenant registry</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review ingestion footprint per tenant, toggle availability, or queue re-index operations.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Add tenant
          </button>
        </div>
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Segments indexed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{tenant.name}</p>
                    <p className="text-xs text-slate-500">ID: {tenant.id}</p>
                  </td>
                  <td className="px-4 py-3">{tenant.segments}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`${
                        tenant.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      } inline-flex items-center rounded-full px-3 py-1 text-xs font-medium`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Pause
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        <p>
          Tenant actions are mirrored to the ingestion API. Integrate service accounts for automated provisioning or connect
          your billing system to enforce per-tenant quotas.
        </p>
      </div>
    </div>
  )
}

function OverviewPage({ items }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
      <div className="space-y-6">
        <SnapshotPanel items={items} />
        <KnowledgePanel />
      </div>
      <ChatPanel />
    </section>
  )
}

function SnapshotPage({ items }) {
  return (
    <div className="space-y-6">
      <SnapshotPanel items={items} />
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        <p>
          Snapshot metrics update after every ingestion cycle. Use reporting to review historical trends or export corpus
          metadata.
        </p>
      </div>
    </div>
  )
}

function PlaceholderPage({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-3 text-sm text-slate-500">{description}</p>
    </div>
  )
}

function SidebarNavItem({ item, collapsed, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) => {
        const activeClasses = 'bg-indigo-50 text-indigo-600 shadow-sm'
        const baseCollapsed = 'flex w-full items-center justify-center rounded-lg px-0 py-2 text-sm font-medium transition'
        const baseExpanded = 'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition'
        const base = collapsed ? baseCollapsed : baseExpanded
        return `${base} ${isActive ? activeClasses : 'text-slate-600 hover:bg-slate-100'}`
      }}
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <span className={collapsed ? 'font-semibold' : 'flex-1 text-left'}>
            {collapsed ? item.label.slice(0, 1) : item.label}
          </span>
          {!collapsed && isActive && (
            <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500" aria-hidden="true" />
          )}
        </>
      )}
    </NavLink>
  )
}

function SidebarContent({ collapsed, onCollapseToggle, onNavigate, showCollapseToggle = true }) {
  return (
    <>
      <div
        className={`mb-6 flex items-center gap-3 border-b border-slate-200 pb-5 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white">
            J
          </span>
          {!collapsed && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">JamAI</p>
              <p className="text-sm font-semibold text-slate-900">Control Center</p>
            </div>
          )}
        </div>
        {showCollapseToggle && (
          <button
            type="button"
            onClick={onCollapseToggle}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '>' : '<'}
          </button>
        )}
      </div>

      <nav className={`flex-1 space-y-8 overflow-y-auto ${collapsed ? 'pr-0' : 'pr-2'}`} aria-label="Primary">
        {navigation.map((section) => (
          <div key={section.label} className={`space-y-3 ${collapsed ? 'text-center' : ''}`}>
            {!collapsed && (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{section.label}</p>
            )}
            <ul className={collapsed ? 'space-y-2' : 'space-y-1'}>
              {section.items.map((item) => (
                <li key={item.label}>
                  <SidebarNavItem item={item} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          <p className="font-semibold text-slate-600">Need a hand?</p>
          <p className="mt-2 leading-relaxed">
            Review ingestion health, adjust tenants, or contact the JamAI team for onboarding support.
          </p>
        </div>
      )}
    </>
  )
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    try {
      const storedValue = window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY)
      return storedValue ? JSON.parse(storedValue) === true : false
    } catch (error) {
      console.warn('Failed to read sidebar preference', error)
      return false
    }
  })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    try {
      const storedValue = window.localStorage.getItem(MOBILE_SIDEBAR_PREFERENCE_KEY)
      const shouldOpen = storedValue ? JSON.parse(storedValue) === true : false
      if (shouldOpen && window.innerWidth >= 1024) {
        return false
      }
      return shouldOpen
    } catch (error) {
      console.warn('Failed to read mobile sidebar preference', error)
      return false
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, JSON.stringify(sidebarCollapsed))
    } catch (error) {
      console.warn('Failed to persist sidebar preference', error)
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(MOBILE_SIDEBAR_PREFERENCE_KEY, JSON.stringify(mobileSidebarOpen))
    } catch (error) {
      console.warn('Failed to persist mobile sidebar preference', error)
    }
  }, [mobileSidebarOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleNavNavigate = useCallback(() => {
    setMobileSidebarOpen(false)
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((previous) => !previous)
  }, [])

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <aside
          className={`hidden flex-none border-r border-slate-200 bg-white/95 pb-8 pt-6 shadow-sm transition-[width] duration-200 lg:flex lg:flex-col ${
            sidebarCollapsed ? 'w-20 px-3' : 'w-72 px-5'
          }`}
        >
          <SidebarContent
            collapsed={sidebarCollapsed}
            onCollapseToggle={toggleSidebarCollapsed}
            onNavigate={handleNavNavigate}
          />
        </aside>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileSidebarOpen(false)} />
            <div
              className="relative ml-0 flex h-full w-64 flex-col bg-white px-5 pb-8 pt-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <SidebarContent
                collapsed={false}
                onCollapseToggle={() => setMobileSidebarOpen(false)}
                onNavigate={handleNavNavigate}
                showCollapseToggle={false}
              />
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="mt-6 inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="flex w-full flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:px-10">
              <div className="flex items-center justify-between lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100"
                >
                  Menu
                </button>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span>Healthy</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">JamAI workspace</p>
                  <h1 className="mt-2 text-3xl font-semibold text-slate-900 md:text-4xl">Knowledge operations console</h1>
                  <p className="mt-3 text-sm text-slate-500 md:text-base">
                    Upload reference material, organise tenants and tags, then interrogate the corpus with grounded answers and citations.
                  </p>
                </div>
                <div className="hidden items-center gap-3 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600 shadow-sm md:flex md:self-auto">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span>Services healthy</span>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pb-12 pt-8 md:px-10">
            <Routes>
              <Route path="/" element={<OverviewPage items={snapshotItems} />} />
              <Route path="/snapshot" element={<SnapshotPage items={snapshotItems} />} />
              <Route path="/knowledge" element={<KnowledgePanel />} />
              <Route path="/tenants" element={<TenantsPage />} />
              <Route path="/chat" element={<ChatPanel />} />
              <Route
                path="/debug-search"
                element={
                  <PlaceholderPage
                    title="Debug search"
                    description="Surface upcoming tooling for low-level vector inspection and relevance debugging."
                  />
                }
              />
              <Route
                path="/reporting"
                element={
                  <PlaceholderPage
                    title="Reporting"
                    description="Visualise ingestion activity, token usage, and corpus health. Connect your telemetry backend to enable this view."
                  />
                }
              />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}
