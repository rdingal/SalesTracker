import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getEmployees,
  saveEmployee,
  deleteEmployee,
  getAttendanceForWeek,
  toggleAttendance
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
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const { start } = getWeekBounds(now);
    return start;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', salaryRate: '' });

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
    Promise.all([getEmployees(), getAttendanceForWeek(startStr, endStr)])
      .then(([emps, att]) => {
        setEmployees(emps);
        setAttendance(att);
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

  const getWeeklyPay = (emp) => {
    const daysPresent = weekDates.filter((d) => isPresent(emp.id, toDateStr(d))).length;
    const rate = emp.salaryRate != null ? Number(emp.salaryRate) : 0;
    return daysPresent * rate;
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
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && employees.length === 0 ? (
        <p className="empty-state">Loading…</p>
      ) : null}

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

      <div className="attendance-layout">
        <div className="employee-list-section">
          <h3>Employees</h3>
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
          <p className="calendar-hint">Click a cell to mark present or absent.</p>
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
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="col-employee employee-name-cell">{emp.name}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
