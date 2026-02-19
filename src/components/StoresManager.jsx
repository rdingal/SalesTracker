import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getStores,
  saveStore,
  deleteStore,
  getStoreSalesForWeek,
  saveStoreDailySale,
  getEmployees,
  getAttendanceForWeek,
  getStoreMonthlyExpenses,
  saveStoreMonthlyExpenses,
  saveEmployee
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

/** Date as YYYY-MM-DD in the user's local timezone (for calendar days). */
function toDateStr(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First and last day of month for a given date (YYYY-MM-DD). */
function getMonthBounds(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return {
    firstStr: toDateStr(first),
    lastStr: toDateStr(last)
  };
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
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    color: '#333333',
    markupPercentage: '',
    monthlyRent: '',
    monthlyUtilityBills: '',
    monthlyOtherExpenses: '',
    linkedEmployeeIds: []
  });
  const [employees, setEmployees] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  /** Month for which we show/edit expenses (store form). YYYY-MM. */
  const [expenseMonth, setExpenseMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthAttendance, setMonthAttendance] = useState([]);

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

  const todayColumnIndex = useMemo(() => {
    const todayStr = toDateStr(new Date());
    return weekDates.findIndex((d) => toDateStr(d) === todayStr);
  }, [weekDates]);

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
    const store = {
      id: formData.id || undefined,
      name: formData.name.trim(),
      color: formData.color || '#333333',
      markupPercentage: parseFloat(formData.markupPercentage) || 0,
      monthlyRent: parseFloat(formData.monthlyRent) || 0,
      monthlyUtilityBills: parseFloat(formData.monthlyUtilityBills) || 0,
      monthlyOtherExpenses: parseFloat(formData.monthlyOtherExpenses) || 0,
      linkedEmployeeIds: formData.linkedEmployeeIds || []
    };
    if (!store.name) return;
    setError(null);
    try {
      const saved = await saveStore(store);
      await saveStoreMonthlyExpenses(saved.id, expenseMonth, {
        monthlyRent: store.monthlyRent,
        monthlyUtilityBills: store.monthlyUtilityBills,
        monthlyEmployeeSalaries: computedMonthlySalaries,
        monthlyOtherExpenses: store.monthlyOtherExpenses
      });
      loadData();
      setFormData({
        id: '',
        name: '',
        color: '#333333',
        markupPercentage: '',
        monthlyRent: '',
        monthlyUtilityBills: '',
        monthlyOtherExpenses: '',
        linkedEmployeeIds: []
      });
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
    getEmployees().then((emps) => {
      setEmployees(emps);
      setFormData({
        id: store.id,
        name: store.name,
        color: store.color || '#333333',
        markupPercentage: store.markupPercentage != null ? String(store.markupPercentage) : '',
        monthlyRent: store.monthlyRent != null ? String(store.monthlyRent) : '',
        monthlyUtilityBills: store.monthlyUtilityBills != null ? String(store.monthlyUtilityBills) : '',
        monthlyOtherExpenses: store.monthlyOtherExpenses != null ? String(store.monthlyOtherExpenses) : '',
        linkedEmployeeIds: emps.filter((e) => e.storeId === store.id).map((e) => e.id)
      });
      setShowForm(true);
    });
  };

  const handleAddStore = () => {
    getEmployees().then((emps) => {
      setEmployees(emps);
      setFormData({
        id: '',
        name: '',
        color: '#333333',
        markupPercentage: '',
        monthlyRent: '',
        monthlyUtilityBills: '',
        monthlyOtherExpenses: '',
        linkedEmployeeIds: []
      });
      setShowForm(true);
    });
  };

  /** Load attendance for the selected expense month when form is open */
  useEffect(() => {
    if (!showForm) return;
    const [y, m] = expenseMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const { firstStr, lastStr } = getMonthBounds(first);
    getAttendanceForWeek(firstStr, lastStr)
      .then(setMonthAttendance)
      .catch(() => setMonthAttendance([]));
  }, [showForm, expenseMonth]);

  /** When editing a store and month changes, load saved monthly expenses for that month */
  useEffect(() => {
    if (!showForm || !formData.id || !expenseMonth) return;
    getStoreMonthlyExpenses(formData.id, expenseMonth)
      .then((saved) => {
        if (saved) {
          setFormData((prev) => ({
            ...prev,
            monthlyRent: String(saved.monthlyRent),
            monthlyUtilityBills: String(saved.monthlyUtilityBills),
            monthlyOtherExpenses: String(saved.monthlyOtherExpenses)
          }));
        }
      })
      .catch(() => {});
  }, [showForm, formData.id, expenseMonth]);

  /** Sum of (days present × rate) for employees linked to this store, for the selected month (total pay before deductions) */
  const computedMonthlySalaries = useMemo(() => {
    const linkedIds = formData.linkedEmployeeIds;
    const daysByEmployee = {};
    monthAttendance.forEach((a) => {
      if (linkedIds.includes(a.employeeId)) {
        daysByEmployee[a.employeeId] = (daysByEmployee[a.employeeId] || 0) + 1;
      }
    });
    let total = 0;
    linkedIds.forEach((empId) => {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) return;
      const days = daysByEmployee[empId] || 0;
      const rate = emp.salaryRate != null ? Number(emp.salaryRate) : 0;
      total += days * rate;
    });
    return total;
  }, [employees, formData.linkedEmployeeIds, monthAttendance]);

  const toggleEmployeeForStore = (employeeId) => {
    setFormData((prev) => ({
      ...prev,
      linkedEmployeeIds: prev.linkedEmployeeIds.includes(employeeId)
        ? prev.linkedEmployeeIds.filter((id) => id !== employeeId)
        : [...prev.linkedEmployeeIds, employeeId]
    }));
  };

  const handleEmployeeTypeChange = async (emp, newType) => {
    setError(null);
    try {
      await saveEmployee({
        id: emp.id,
        name: emp.name,
        salaryRate: emp.salaryRate,
        storeId: emp.storeId,
        employeeType: newType
      });
      const updated = await getEmployees();
      setEmployees(updated);
    } catch (err) {
      setError(err?.message || 'Failed to update employee type');
    }
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
                    <th key={i} className={`col-day ${i === todayColumnIndex ? 'col-today' : ''}`}>
                      <div className="day-name">{DAYS[i]}</div>
                      <div className="day-date">{d.getDate()}</div>
                      {i === todayColumnIndex && <div className="today-label">Today</div>}
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
                        <td key={i} className={`col-day ${i === todayColumnIndex ? 'col-today' : ''}`}>
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
            <button onClick={() => (showForm ? setShowForm(false) : handleAddStore())} className="btn-primary">
              {showForm ? 'Cancel' : '+ Add Store'}
            </button>
          </div>
          {showForm && (
            <form onSubmit={handleStoreSubmit} className="stores-form stores-form-full">
              <div className="form-row form-row-month">
                <div className="form-group">
                  <label>Expenses for month</label>
                  <input
                    type="month"
                    value={expenseMonth}
                    onChange={(e) => setExpenseMonth(e.target.value)}
                    className="month-input"
                    title="Employee salaries are calculated from attendance and deductions for this month"
                  />
                </div>
              </div>
              <div className="form-row">
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
                <div className="form-group form-group-color">
                  <label>Color (for calendar)</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    title="Color for employee names in attendance calendar"
                  />
                </div>
                <div className="form-group form-group-markup">
                  <label>Markup %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.markupPercentage}
                    onChange={(e) => setFormData({ ...formData, markupPercentage: e.target.value })}
                    placeholder="0"
                    title="Fixed markup percentage for break-even calculations"
                  />
                </div>
                <div className="form-group form-group-margin">
                  <label>Margin %</label>
                  <span className="margin-value" title="Margin = Markup / (1 + Markup)">
                    {(() => {
                      const markup = parseFloat(formData.markupPercentage) || 0;
                      const margin = markup >= 0 ? (markup / 100) / (1 + markup / 100) * 100 : 0;
                      return `${margin.toFixed(2)}%`;
                    })()}
                  </span>
                </div>
              </div>
              <div className="form-group form-group-expenses">
                <label>Monthly expenses (₱)</label>
                <div className="expense-fields">
                  <div className="expense-row">
                    <span className="expense-label">Rent</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.monthlyRent}
                      onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="expense-row">
                    <span className="expense-label">Utility bills</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.monthlyUtilityBills}
                      onChange={(e) => setFormData({ ...formData, monthlyUtilityBills: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="expense-row expense-row-readonly">
                    <span className="expense-label">Employee salaries</span>
                    <span className="expense-value" title="Sum of (days present × rate) for linked employees for the selected month">
                      ₱{computedMonthlySalaries.toFixed(2)}
                    </span>
                  </div>
                  <div className="expense-row">
                    <span className="expense-label">Other</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.monthlyOtherExpenses}
                      onChange={(e) => setFormData({ ...formData, monthlyOtherExpenses: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div className="form-group form-group-employees">
                <label>Employees in this store</label>
                <div className="employee-checkbox-list">
                  {employees.length === 0 ? (
                    <p className="form-hint">No employees yet. Add employees in the Attendance tab.</p>
                  ) : (
                    employees.map((emp) => (
                      <div key={emp.id} className="employee-checkbox-row">
                        <label className="employee-checkbox-item">
                          <input
                            type="checkbox"
                            checked={formData.linkedEmployeeIds.includes(emp.id)}
                            onChange={() => toggleEmployeeForStore(emp.id)}
                          />
                          <span>{emp.name}</span>
                        </label>
                        <select
                          value={emp.employeeType === 'reliever' ? 'reliever' : 'main'}
                          onChange={(e) => handleEmployeeTypeChange(emp, e.target.value)}
                          className="employee-type-select"
                          title={formData.linkedEmployeeIds.includes(emp.id) ? 'Main or Reliever' : 'Assign employee to store first'}
                          disabled={!formData.linkedEmployeeIds.includes(emp.id)}
                        >
                          <option value="main">Main</option>
                          <option value="reliever">Reliever</option>
                        </select>
                      </div>
                    ))
                  )}
                </div>
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
