import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import InventoryManager from './components/InventoryManager'
import SalesTracker from './components/SalesTracker'
import AttendanceManager from './components/AttendanceManager'
import StoresManager from './components/StoresManager'
import Analytics from './components/Analytics'
import LoginModal from './components/LoginModal'
import './App.css'

const THEME_KEY = 'koolet_theme'

function App() {
  const { user, loading, signOut, hasSupabase } = useAuth()
  const [activeTab, setActiveTab] = useState('attendance')
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(THEME_KEY) || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (user) setLoginModalOpen(false)
  }, [user])

  const cycleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  if (loading) {
    return (
      <div className="app" style={{ padding: '48px', textAlign: 'center' }}>
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className="app">
      {loginModalOpen && (
        <LoginModal onClose={() => setLoginModalOpen(false)} />
      )}
      <header className="app-header">
        <div className="app-header-actions">
          {hasSupabase && !user && (
            <button
              type="button"
              className="header-btn"
              onClick={() => setLoginModalOpen(true)}
              title="Sign in to edit"
            >
              Login
            </button>
          )}
          {user && (
            <>
              <span className="header-email" title={user.email}>
                {user.email}
              </span>
              <button
                type="button"
                className="header-btn"
                onClick={signOut}
                title="Sign out"
              >
                Sign out
              </button>
            </>
          )}
          <button
            type="button"
            className="header-btn theme-toggle"
            onClick={cycleTheme}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            aria-label={`Current theme: ${theme}. Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            <span aria-hidden>{theme === 'light' ? '🌙' : '☀️'}</span>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        <h1>📊 Koolet's Inventory Management System</h1>
        <p>Track your inventory, sales, and employee attendance in one place</p>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance
        </button>
        <button
          className={`tab ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => setActiveTab('stores')}
        >
          Stores
        </button>
        <button
          className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory
        </button>
        <button
          className={`tab ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </nav>

      <main className="app-content">
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'sales' && <SalesTracker />}
        {activeTab === 'attendance' && <AttendanceManager />}
        {activeTab === 'stores' && <StoresManager />}
        {activeTab === 'analytics' && <Analytics />}
      </main>

    </div>
  )
}

export default App
