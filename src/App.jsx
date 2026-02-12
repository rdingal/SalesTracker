import { useState } from 'react'
import InventoryManager from './components/InventoryManager'
import SalesTracker from './components/SalesTracker'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('inventory')

  return (
    <div className="app">
      <header className="app-header">
        <h1>📊 Sales Tracker</h1>
        <p>Track your inventory and sales in one place</p>
      </header>

      <nav className="tab-nav">
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
      </nav>

      <main className="app-content">
        {activeTab === 'inventory' ? <InventoryManager /> : <SalesTracker />}
      </main>

      <footer className="app-footer">
        <p>💡 Data is stored locally. To use Supabase, see src/services/database.js</p>
      </footer>
    </div>
  )
}

export default App
