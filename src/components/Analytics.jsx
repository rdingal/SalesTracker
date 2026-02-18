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
  ResponsiveContainer
} from 'recharts';
import { getStores, getStoreSalesForWeek } from '../services/database';
import './Analytics.css';

function getDateStr(d) {
  return d.toISOString().slice(0, 10);
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

const CHART_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#f44336', '#00BCD4'];

export default function Analytics() {
  const [stores, setStores] = useState([]);
  const [sales, setSales] = useState([]);
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

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([getStores(), getStoreSalesForWeek(dateFrom, dateTo)])
      .then(([s, salesData]) => {
        setStores(s);
        setSales(salesData);
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
      </div>

      <div className="chart-container">
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : stores.length === 0 ? (
          <p className="empty-state">Add stores and enter sales in the Stores tab to see analytics.</p>
        ) : selectedStores.length === 0 ? (
          <p className="empty-state">Select at least one store to track.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'Sales (₱)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value, name) => [`₱${Number(value).toFixed(2)}`, name]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel}
                />
                <Legend />
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
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'Sales (₱)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value, name) => [`₱${Number(value).toFixed(2)}`, name]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel}
                />
                <Legend />
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
        )}
      </div>
    </div>
  );
}
