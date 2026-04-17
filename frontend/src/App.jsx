import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom'
import WorkspaceList from './components/WorkspaceList'
import WorkflowEditor from './components/WorkflowEditor'
import DatabasePage from './components/DatabasePage'
import { ToastContainer } from './components/Toast'
import { LanguageProvider, useLanguage } from './i18n'

function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState([])
  const navigate = useNavigate()

  const loadWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces')
      const data = await res.json()
      setWorkspaces(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Load workspaces failed:', error)
      setWorkspaces([])
    }
  }

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const handleSelectWorkspace = (workspace) => {
    navigate(`/workspace/${workspace.id}`)
  }

  const handleCreateWorkspace = async (name, description) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      })
      const newWorkspace = await res.json()
      setWorkspaces([...workspaces, newWorkspace])
      navigate(`/workspace/${newWorkspace.id}`)
    } catch (error) {
      console.error('Create failed:', error)
    }
  }

  const handleDeleteWorkspace = async (id) => {
    try {
      await fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
      setWorkspaces(workspaces.filter(w => w.id !== id))
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  return (
    <WorkspaceList
      workspaces={workspaces}
      onSelect={handleSelectWorkspace}
      onCreate={handleCreateWorkspace}
      onDelete={handleDeleteWorkspace}
      onRefresh={loadWorkspaces}
    />
  )
}

function HomePage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/workspaces')
  }, [navigate])

  return null
}

function LanguageToggle() {
  const { lang, toggleLang } = useLanguage()

  return (
    <span
      onClick={toggleLang}
      style={{
        padding: '6px 12px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '4px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '12px',
        letterSpacing: '1px',
        cursor: 'pointer'
      }}
    >
      {lang === 'zh' ? 'EN' : '中'}
    </span>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)'
        }}>
          {/* 顶部导航 */}
          <div style={{
            padding: '16px 24px',
            background: 'linear-gradient(180deg, rgba(20, 20, 35, 0.95) 0%, rgba(15, 15, 25, 0.9) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <span style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#e8e8e8',
                letterSpacing: '2px'
              }}>
                NEXUS FLOW
              </span>
            </Link>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Link to="/db" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none' }}>数据库</Link>
              <LanguageToggle />
            </div>
          </div>

          {/* 主内容区域 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/workspaces" element={<WorkspacePage />} />
              <Route path="/workspace/:workspaceId" element={<WorkflowEditor />} />
              <Route path="/db" element={<DatabasePage />} />
              <Route path="/dbSQLite" element={<DatabasePage />} />
            </Routes>
          </div>

          {/* Toast 通知 */}
          <ToastContainer />
        </div>
      </BrowserRouter>
    </LanguageProvider>
  )
}