import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getEmployees,
  saveEmployee,
  deleteEmployee,
  getAttendanceForWeek,
  toggleAttendance,
  getWeeklyPaymentsForWeek,
  setWeeklyPaid,
  updateEmployeeOrder,
  getStores
} from '../services/database';
import './AttendanceManager.css';

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

export default function AttendanceManager() {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [weeklyPayments, setWeeklyPayments] = useState([]);
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const { start } = getWeekBounds(now);
    return start;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('calendar');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', salaryRate: '' });
  const [draggedEmployeeId, setDraggedEmployeeId] = useState(null);
  const [stores, setStores] = useState([]);

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
    Promise.all([
      getEmployees(),
      getAttendanceForWeek(startStr, endStr),
      getWeeklyPaymentsForWeek(startStr),
      getStores()
    ])
      .then(([emps, att, payments, storeList]) => {
        setEmployees(emps);
        setAttendance(att);
        setWeeklyPayments(payments);
        setStores(storeList || []);
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

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    const employee = {
      id: formData.id || undefined,
      name: formData.name.trim(),
      salaryRate: parseFloat(formData.salaryRate) || 0
    };
    if (!employee.name) return;
    setError(null);
    try {
      await saveEmployee(employee);
      loadData();
      setFormData({ id: '', name: '', salaryRate: '' });
      setShowForm(false);
    } catch (err) {
      setError(err?.message || 'Failed to save employee');
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Delete this employee? Their attendance records will be removed.')) return;
    setError(null);
    try {
      await deleteEmployee(id);
      loadData();
    } catch (err) {
      setError(err?.message || 'Failed to delete employee');
    }
  };

  const handleEditEmployee = (emp) => {
    setFormData({
      id: emp.id,
      name: emp.name,
      salaryRate: emp.salaryRate != null ? String(emp.salaryRate) : ''
    });
    setShowForm(true);
  };

  const isPresent = (employeeId, dateStr) =>
    attendance.some((a) => a.employeeId === employeeId && a.date === dateStr);

  const isPaidForWeek = (employeeId) =>
    weeklyPayments.some((p) => p.employeeId === employeeId && p.paid);

  const getStoreColorForEmployee = (storeId) => {
    if (!storeId) return null;
    const store = stores.find((s) => s.id === storeId);
    return store?.color || null;
  };

  const getWeeklyPay = (emp) => {
    const daysPresent = weekDates.filter((d) => isPresent(emp.id, toDateStr(d))).length;
    const rate = emp.salaryRate != null ? Number(emp.salaryRate) : 0;
    return daysPresent * rate;
  };

  const handlePaidChange = async (employeeId, checked) => {
    setError(null);
    const startStr = toDateStr(start);
    try {
      await setWeeklyPaid(employeeId, startStr, checked);
      setWeeklyPayments((prev) => {
        const rest = prev.filter((p) => p.employeeId !== employeeId);
        return checked ? [...rest, { employeeId, paid: true }] : rest;
      });
    } catch (err) {
      setError(err?.message || 'Failed to update paid status');
    }
  };

  const handleDragStart = (e, employeeId) => {
    setDraggedEmployeeId(employeeId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', employeeId);
    e.dataTransfer.setData('application/x-employee-id', employeeId);
    e.target.closest('tr')?.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    setDraggedEmployeeId(null);
    e.target.closest('tr')?.classList.remove('dragging');
  };

  const handleDragOver = (e, dropEmployeeId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedEmployeeId && draggedEmployeeId !== dropEmployeeId) {
      e.currentTarget.closest('tr')?.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e) => {
    e.currentTarget.closest('tr')?.classList.remove('drag-over');
  };

  const handleDrop = async (e, dropEmployeeId) => {
    e.preventDefault();
    e.currentTarget.closest('tr')?.classList.remove('drag-over');
    if (!draggedEmployeeId || draggedEmployeeId === dropEmployeeId) return;
    const fromIdx = employees.findIndex((emp) => emp.id === draggedEmployeeId);
    const toIdx = employees.findIndex((emp) => emp.id === dropEmployeeId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...employees];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);
    setEmployees(reordered);
    setError(null);
    try {
      await updateEmployeeOrder(reordered.map((emp) => emp.id));
    } catch (err) {
      setError(err?.message || 'Failed to save order');
      setEmployees(employees);
    }
  };

  const handleCellClick = async (employeeId, dateStr) => {
    setError(null);
    try {
      await toggleAttendance(employeeId, dateStr);
      setAttendance((prev) => {
        const exists = prev.some((a) => a.employeeId === employeeId && a.date === dateStr);
        if (exists) {
          return prev.filter((a) => !(a.employeeId === employeeId && a.date === dateStr));
        }
        return [...prev, { employeeId, date: dateStr }];
      });
    } catch (err) {
      setError(err?.message || 'Failed to update attendance');
    }
  };

  const weekLabel = `${start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="attendance-manager">
      <div className="attendance-header">
        <h2>Employee Attendance</h2>
      </div>

      <nav className="attendance-sub-tabs">
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('calendar')}
        >
          Calendar
        </button>
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('employees')}
        >
          Employees
        </button>
      </nav>

      {error && <p className="error-message">{error}</p>}
      {loading && employees.length === 0 ? (
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
          <p className="calendar-hint">Click a cell to mark present or absent. Drag rows to reorder employees.</p>
          <div className="attendance-calendar">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th className="col-employee">Employee</th>
                  {weekDates.map((d, i) => (
                    <th key={i} className="col-day">
                      <div className="day-name">{DAYS[i]}</div>
                      <div className="day-date">{d.getDate()}</div>
                    </th>
                  ))}
                  <th className="col-total">Total Pay</th>
                  <th className="col-paid">Paid</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, emp.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, emp.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, emp.id)}
                    className={`draggable-row ${isPaidForWeek(emp.id) ? 'row-paid' : ''}`}
                  >
                    <td className="col-employee employee-name-cell col-drag-handle" title="Drag to reorder">
                      <span className="drag-handle" aria-hidden>⋮⋮</span>
                      <span
                        className="employee-name-by-store"
                        style={
                          getStoreColorForEmployee(emp.storeId)
                            ? { color: getStoreColorForEmployee(emp.storeId) }
                            : undefined
                        }
                      >
                        {emp.name}
                      </span>
                    </td>
                    {weekDates.map((d, i) => {
                      const dateStr = toDateStr(d);
                      const present = isPresent(emp.id, dateStr);
                      return (
                        <td key={i} className="col-day">
                          <button
                            type="button"
                            className={`attendance-cell ${present ? 'present' : ''}`}
                            onClick={() => handleCellClick(emp.id, dateStr)}
                            title={`${present ? 'Present' : 'Absent'} – click to toggle`}
                          >
                            {present ? '✓' : ''}
                          </button>
                        </td>
                      );
                    })}
                    <td className="col-total total-cell">
                      ₱{getWeeklyPay(emp).toFixed(2)}
                    </td>
                    <td className="col-paid">
                      <label className="paid-checkbox-label">
                        <input
                          type="checkbox"
                          checked={isPaidForWeek(emp.id)}
                          onChange={(e) => handlePaidChange(emp.id, e.target.checked)}
                          title="Mark as paid for this week"
                        />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'employees' && (
        <div className="employee-list-section">
          <div className="employee-list-header">
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              {showForm ? 'Cancel' : '+ Add Employee'}
            </button>
          </div>
          {showForm && (
            <form onSubmit={handleEmployeeSubmit} className="attendance-form">
              <div className="form-group">
                <label>Employee Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Daily Salary Rate (₱)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.salaryRate}
                  onChange={(e) => setFormData({ ...formData, salaryRate: e.target.value })}
                  placeholder="0"
                />
              </div>
              <button type="submit" className="btn-primary">
                {formData.id ? 'Update' : 'Add'} Employee
              </button>
            </form>
          )}
          {employees.length === 0 && !loading ? (
            <p className="empty-state">No employees yet. Add employees to track attendance.</p>
          ) : (
            <ul className="employee-list">
              {employees.map((emp) => (
                <li key={emp.id} className="employee-item">
                  <div className="employee-info">
                    <span className="employee-name">{emp.name}</span>
                    <span className="employee-salary">₱{Number(emp.salaryRate || 0).toFixed(2)}/day</span>
                  </div>
                  <div className="employee-actions">
                    <button
                      type="button"
                      onClick={() => handleEditEmployee(emp)}
                      className="btn-small"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEmployee(emp.id)}
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
