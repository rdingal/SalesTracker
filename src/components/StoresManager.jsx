import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getStores,
  saveStore,
  deleteStore,
  getStoreSalesForWeek,
  saveStoreDailySale
} from '../services/database';
import './StoresManager.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekBounds(date) {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

export default function StoresManager() {
  const [stores, setStores] = useState([]);
  const [storeSales, setStoreSales] = useState([]);
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const { start } = getWeekBounds(now);
    return start;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('calendar');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '' });
  const [editingCell, setEditingCell] = useState(null);

  const { start, end } = useMemo(() => getWeekBounds(weekStart), [weekStart]);
  const weekDates = useMemo(() => {
    const dates = [];
    const curr = new Date(start);
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [start]);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    const startStr = toDateStr(start);
    const endStr = toDateStr(end);
    Promise.all([getStores(), getStoreSalesForWeek(startStr, endStr)])
      .then(([s, sales]) => {
        setStores(s);
        setStoreSales(sales);
      })
      .catch((err) => setError(err?.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [start, end]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goPrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const goNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const handleStoreSubmit = async (e) => {
    e.preventDefault();
    const store = { id: formData.id || undefined, name: formData.name.trim() };
    if (!store.name) return;
    setError(null);
    try {
      await saveStore(store);
      loadData();
      setFormData({ id: '', name: '' });
      setShowForm(false);
    } catch (err) {
      setError(err?.message || 'Failed to save store');
    }
  };

  const handleDeleteStore = async (id) => {
    if (!window.confirm('Delete this store? Its sales data will be removed.')) return;
    setError(null);
    try {
      await deleteStore(id);
      loadData();
    } catch (err) {
      setError(err?.message || 'Failed to delete store');
    }
  };

  const handleEditStore = (store) => {
    setFormData({ id: store.id, name: store.name });
    setShowForm(true);
  };

  const getSaleForDay = (storeId, dateStr) => {
    const s = storeSales.find(
      (x) => x.storeId === storeId && x.date === dateStr
    );
    return s ? String(s.amount) : '';
  };

  const handleSaleBlur = async (storeId, dateStr, value) => {
    const amount = parseFloat(value) || 0;
    setEditingCell(null);
    setError(null);
    try {
      await saveStoreDailySale(storeId, dateStr, amount);
      setStoreSales((prev) => {
        const filtered = prev.filter(
          (x) => !(x.storeId === storeId && x.date === dateStr)
        );
        return amount > 0 ? [...filtered, { storeId, date: dateStr, amount }] : filtered;
      });
    } catch (err) {
      setError(err?.message || 'Failed to save sales');
    }
  };

  const getDisplayValue = (storeId, dateStr) => {
    if (editingCell?.storeId === storeId && editingCell?.dateStr === dateStr) {
      return editingCell.value;
    }
    return getSaleForDay(storeId, dateStr);
  };

  const getWeeklyTotal = (storeId) => {
    return storeSales
      .filter((s) => s.storeId === storeId)
      .reduce((sum, s) => sum + (s.amount || 0), 0);
  };

  const weekLabel = `${start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="stores-manager">
      <div className="stores-header">
        <h2>Store Sales</h2>
      </div>

      <nav className="stores-sub-tabs">
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('calendar')}
        >
          Calendar
        </button>
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'stores' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('stores')}
        >
          Stores
        </button>
      </nav>

      {error && <p className="error-message">{error}</p>}
      {loading && stores.length === 0 ? (
        <p className="empty-state">Loading…</p>
      ) : null}

      {activeSubTab === 'calendar' && (
        <div className="calendar-section">
          <div className="calendar-header">
            <button type="button" onClick={goPrevWeek} className="btn-nav" aria-label="Previous week">
              ←
            </button>
            <h3 className="week-label">{weekLabel}</h3>
            <button type="button" onClick={goNextWeek} className="btn-nav" aria-label="Next week">
              →
            </button>
          </div>
          <p className="calendar-hint">Enter daily sales amount (₱) for each store.</p>
          <div className="stores-calendar">
            <table className="stores-table">
              <thead>
                <tr>
                  <th className="col-store">Store</th>
                  {weekDates.map((d, i) => (
                    <th key={i} className="col-day">
                      <div className="day-name">{DAYS[i]}</div>
                      <div className="day-date">{d.getDate()}</div>
                    </th>
                  ))}
                  <th className="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td className="col-store store-name-cell">{store.name}</td>
                    {weekDates.map((d, i) => {
                      const dateStr = toDateStr(d);
                      const value = getSaleForDay(store.id, dateStr);
                      return (
                        <td key={i} className="col-day">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="sale-input"
                            value={getDisplayValue(store.id, dateStr)}
                            onChange={(e) =>
                              setEditingCell({
                                storeId: store.id,
                                dateStr,
                                value: e.target.value
                              })
                            }
                            onFocus={() =>
                              setEditingCell({
                                storeId: store.id,
                                dateStr,
                                value: getSaleForDay(store.id, dateStr)
                              })
                            }
                            onBlur={(e) =>
                              handleSaleBlur(store.id, dateStr, e.target.value)
                            }
                            placeholder="0"
                            title={`Sales for ${dateStr}`}
                          />
                        </td>
                      );
                    })}
                    <td className="col-total total-cell">
                      ₱{getWeeklyTotal(store.id).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'stores' && (
        <div className="store-list-section">
          <div className="store-list-header">
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              {showForm ? 'Cancel' : '+ Add Store'}
            </button>
          </div>
          {showForm && (
            <form onSubmit={handleStoreSubmit} className="stores-form">
              <div className="form-group">
                <label>Store Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter store name"
                  required
                />
              </div>
              <button type="submit" className="btn-primary">
                {formData.id ? 'Update' : 'Add'} Store
              </button>
            </form>
          )}
          {stores.length === 0 && !loading ? (
            <p className="empty-state">No stores yet. Add stores to track daily sales.</p>
          ) : (
            <ul className="store-list">
              {stores.map((store) => (
                <li key={store.id} className="store-item">
                  <span className="store-name">{store.name}</span>
                  <div className="store-actions">
                    <button
                      type="button"
                      onClick={() => handleEditStore(store)}
                      className="btn-small"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStore(store.id)}
                      className="btn-small btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
