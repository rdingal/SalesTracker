import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { getStores, getStoreSalesForWeek, getEmployees } from '../services/database';
import './Analytics.css';

/** Date as YYYY-MM-DD in the user's local timezone. */
function getDateStr(d) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysBetween(start, end) {
  const days = [];
  const curr = new Date(start);
  curr.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  while (curr <= endDate) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

const CHART_COLORS = ['#2196F3', '#43a047', '#FF9800', '#9C27B0', '#f44336', '#00BCD4'];

export default function Analytics() {
  const [stores, setStores] = useState([]);
  const [sales, setSales] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return getDateStr(d);
  });
  const [dateTo, setDateTo] = useState(() => getDateStr(new Date()));
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [chartType, setChartType] = useState('line');
  const [analyzeEnabled, setAnalyzeEnabled] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([getStores(), getStoreSalesForWeek(dateFrom, dateTo), getEmployees()])
      .then(([s, salesData, emps]) => {
        setStores(s);
        setSales(salesData);
        setEmployees(emps || []);
        setSelectedStoreIds((prev) => {
          const valid = prev.filter((id) => s.some((st) => st.id === id));
          return valid.length ? valid : s.map((st) => st.id);
        });
      })
      .catch((err) => setError(err?.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  const chartData = useMemo(() => {
    const days = getDaysBetween(new Date(dateFrom), new Date(dateTo));
    const storeIds = selectedStoreIds.length ? selectedStoreIds : stores.map((s) => s.id);
    const byDateStore = new Map();
    sales.forEach(({ date, storeId, amount }) => {
      const key = `${date}_${storeId}`;
      byDateStore.set(key, amount);
    });
    return days.map((d) => {
      const dateStr = getDateStr(d);
      const point = {
        date: dateStr,
        dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      };
      storeIds.forEach((storeId) => {
        const key = `${dateStr}_${storeId}`;
        point[storeId] = byDateStore.get(key) || 0;
      });
      return point;
    });
  }, [sales, dateFrom, dateTo, selectedStoreIds, stores]);

  const selectedStores = useMemo(
    () => stores.filter((s) => selectedStoreIds.includes(s.id)),
    [stores, selectedStoreIds]
  );

  /** Break-even daily sales per store (same formula as Stores tab) */
  const breakEvenByStoreId = useMemo(() => {
    const map = new Map();
    stores.forEach((store) => {
      const rent = Number(store.monthlyRent) || 0;
      const utility = Number(store.monthlyUtilityBills) || 0;
      const other = Number(store.monthlyOtherExpenses) || 0;
      const fixedDaily = (rent + utility + other) / 30;
      const mainEmployeeDaily = (employees || []).filter(
        (e) => e.storeId === store.id && e.employeeType === 'main'
      ).reduce((sum, e) => sum + (e.salaryRate != null ? Number(e.salaryRate) : 0), 0);
      const totalDailyExpenses = fixedDaily + mainEmployeeDaily;
      const markup = Number(store.markupPercentage) || 0;
      const marginDecimal = markup >= 0 ? (markup / 100) / (1 + markup / 100) : 0;
      const breakEven = marginDecimal > 0 ? totalDailyExpenses / marginDecimal : 0;
      map.set(store.id, breakEven);
    });
    return map;
  }, [stores, employees]);

  /** For selected stores: break-even, avg daily sales in range, and status */
  const breakEvenSummary = useMemo(() => {
    const days = getDaysBetween(new Date(dateFrom), new Date(dateTo));
    const numDays = Math.max(days.length, 1);
    return selectedStores.map((store) => {
      const breakEven = breakEvenByStoreId.get(store.id) ?? 0;
      const totalInRange = sales
        .filter((s) => s.storeId === store.id)
        .reduce((sum, s) => sum + (s.amount || 0), 0);
      const avgDaily = totalInRange / numDays;
      const isAbove = breakEven > 0 ? avgDaily >= breakEven : true;
      return {
        storeId: store.id,
        storeName: store.name,
        breakEven,
        avgDaily,
        isAbove
      };
    });
  }, [selectedStores, breakEvenByStoreId, sales, dateFrom, dateTo]);

  const toggleStore = (storeId) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const selectAllStores = () => setSelectedStoreIds(stores.map((s) => s.id));
  const clearStores = () => setSelectedStoreIds([]);

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h2>Store Sales Analytics</h2>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="analytics-controls">
        <div className="control-group">
          <label>Date range (x-axis)</label>
          <div className="date-range">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
            />
            <span className="date-sep">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
            />
          </div>
        </div>

        <div className="control-group">
          <label>Stores to track</label>
          <div className="store-filters">
            <button type="button" onClick={selectAllStores} className="btn-link">
              All
            </button>
            <button type="button" onClick={clearStores} className="btn-link">
              None
            </button>
            <div className="store-checkboxes">
              {stores.map((store) => (
                <label key={store.id} className="store-filter-item">
                  <input
                    type="checkbox"
                    checked={selectedStoreIds.includes(store.id)}
                    onChange={() => toggleStore(store.id)}
                  />
                  <span
                    className="store-dot"
                    style={{ backgroundColor: store.color || '#333' }}
                  />
                  {store.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="control-group">
          <label>Chart type</label>
          <div className="chart-type-toggle">
            <button
              type="button"
              className={chartType === 'line' ? 'active' : ''}
              onClick={() => setChartType('line')}
            >
              Line
            </button>
            <button
              type="button"
              className={chartType === 'bar' ? 'active' : ''}
              onClick={() => setChartType('bar')}
            >
              Bar
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>Analyze</label>
          <button
            type="button"
            className={`analyze-toggle ${analyzeEnabled ? 'active' : ''}`}
            onClick={() => setAnalyzeEnabled((prev) => !prev)}
            title={analyzeEnabled ? 'Hide break-even analysis' : 'Show break-even summary and reference lines'}
          >
            {analyzeEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="chart-container">
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : stores.length === 0 ? (
          <p className="empty-state">Add stores and enter sales in the Stores tab to see analytics.</p>
        ) : selectedStores.length === 0 ? (
          <p className="empty-state">Select at least one store to track.</p>
        ) : (
          <>
            {analyzeEnabled && (
              <div className="break-even-summary">
                <h4 className="break-even-summary-title">Break-even (avg daily vs target)</h4>
                <div className="break-even-summary-grid">
                  {breakEvenSummary.map(({ storeName, breakEven, avgDaily, isAbove }) => (
                    <div
                      key={storeName}
                      className={`break-even-summary-item ${isAbove ? 'above' : 'below'}`}
                      title={`Break-even: ₱${breakEven.toFixed(2)}/day · Avg in range: ₱${avgDaily.toFixed(2)}/day`}
                    >
                      <span className="break-even-store-name">{storeName}</span>
                      <span className="break-even-status">{isAbove ? 'Above' : 'Below'}</span>
                      <span className="break-even-detail">
                        ₱{avgDaily.toFixed(0)} vs ₱{breakEven.toFixed(0)}/day
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={400}>
              {chartType === 'line' ? (
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: analyzeEnabled ? 140 : 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: 'Sales (₱)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value, name) => [`₱${Number(value).toFixed(2)}`, name]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ paddingTop: 12 }} />
                  {analyzeEnabled &&
                    selectedStores.map((store, i) => {
                      const breakEven = breakEvenByStoreId.get(store.id);
                      return breakEven > 0 ? (
                        <ReferenceLine
                          key={`ref-${store.id}`}
                          y={breakEven}
                          stroke={store.color || CHART_COLORS[i % CHART_COLORS.length]}
                          strokeDasharray="5 5"
                          label={{ value: `${store.name} break-even`, position: 'right', fontSize: 11 }}
                        />
                      ) : null;
                    })}
                  {selectedStores.map((store, i) => (
                    <Line
                      key={store.id}
                      type="monotone"
                      dataKey={store.id}
                      name={store.name}
                      stroke={store.color || CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: analyzeEnabled ? 140 : 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: 'Sales (₱)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value, name) => [`₱${Number(value).toFixed(2)}`, name]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ paddingTop: 12 }} />
                  {analyzeEnabled &&
                    selectedStores.map((store, i) => {
                      const breakEven = breakEvenByStoreId.get(store.id);
                      return breakEven > 0 ? (
                        <ReferenceLine
                          key={`ref-${store.id}`}
                          y={breakEven}
                          stroke={store.color || CHART_COLORS[i % CHART_COLORS.length]}
                          strokeDasharray="5 5"
                          label={{ value: `${store.name} break-even`, position: 'right', fontSize: 11 }}
                        />
                      ) : null;
                    })}
                  {selectedStores.map((store, i) => (
                    <Bar
                      key={store.id}
                      dataKey={store.id}
                      name={store.name}
                      fill={store.color || CHART_COLORS[i % CHART_COLORS.length]}
                      radius={[2, 2, 0, 0]}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}
