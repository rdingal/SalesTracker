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
  ReferenceLine,
  Cell
} from 'recharts';
import { getStores, getStoreSalesForWeek, getEmployees, getAttendanceForWeek } from '../services/database';
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
  const [attendance, setAttendance] = useState([]);
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
    Promise.all([
      getStores(),
      getStoreSalesForWeek(dateFrom, dateTo),
      getEmployees(),
      getAttendanceForWeek(dateFrom, dateTo)
    ])
      .then(([s, salesData, emps, att]) => {
        setStores(s);
        setSales(salesData);
        setEmployees(emps || []);
        setAttendance(att || []);
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

  /** Net profit per store: Gross profit − Expenses. Gross profit = Sales × Margin (only when Analyze on) */
  const profitSummary = useMemo(() => {
    const days = getDaysBetween(new Date(dateFrom), new Date(dateTo));
    const numDays = Math.max(days.length, 1);
    return selectedStores.map((store) => {
      const revenue = sales
        .filter((s) => s.storeId === store.id)
        .reduce((sum, s) => sum + (s.amount || 0), 0);
      const markup = Number(store.markupPercentage) || 0;
      const margin = markup >= 0 ? (markup / 100) / (1 + markup / 100) : 0;
      const grossProfit = revenue * margin;
      const rent = Number(store.monthlyRent) || 0;
      const utility = Number(store.monthlyUtilityBills) || 0;
      const other = Number(store.monthlyOtherExpenses) || 0;
      const fixedExpenses = ((rent + utility + other) / 30) * numDays;
      const storeEmployees = (employees || []).filter((e) => e.storeId === store.id);
      const laborExpenses = storeEmployees.reduce((sum, emp) => {
        const daysPresent = attendance.filter(
          (a) => a.employeeId === emp.id && a.date >= dateFrom && a.date <= dateTo
        ).length;
        const rate = emp.salaryRate != null ? Number(emp.salaryRate) : 0;
        return sum + daysPresent * rate;
      }, 0);
      const expenses = fixedExpenses + laborExpenses;
      const profit = revenue - expenses;
      const netProfit = grossProfit - expenses;
      const profitTooltipLines = [
        'Profit = Revenue − Expenses',
        `Revenue = total sales in period: ₱${revenue.toFixed(2)}`,
        `Fixed (prorated): (Rent+Utilities+Other)/30 × ${numDays} days = ₱${fixedExpenses.toFixed(2)}`,
        `Labor: Σ(days present × daily rate) = ₱${laborExpenses.toFixed(2)}`,
        `Expenses = ₱${expenses.toFixed(2)}`,
        `Profit = ₱${profit.toFixed(2)}`
      ];
      const netProfitTooltipLines = [
        'Net profit = Gross profit − Expenses',
        `Gross profit = Sales × Margin (margin = ${(margin * 100).toFixed(2)}%)`,
        `Sales in period: ₱${revenue.toFixed(2)} → Gross profit: ₱${grossProfit.toFixed(2)}`,
        `Fixed (prorated): (Rent+Utilities+Other)/30 × ${numDays} days = ₱${fixedExpenses.toFixed(2)}`,
        `Labor: Σ(days present × daily rate) = ₱${laborExpenses.toFixed(2)}`,
        `Expenses = ₱${expenses.toFixed(2)}`,
        `Net profit = ₱${netProfit.toFixed(2)}`
      ];
      return {
        storeId: store.id,
        storeName: store.name,
        storeColor: store.color,
        revenue,
        grossProfit,
        expenses,
        profit,
        netProfit,
        profitTooltip: profitTooltipLines.join('\n'),
        netProfitTooltip: netProfitTooltipLines.join('\n')
      };
    });
  }, [selectedStores, sales, employees, attendance, dateFrom, dateTo]);

  /** Chart data for profit (Revenue − Expenses) bar chart */
  const profitChartData = useMemo(
    () =>
      profitSummary.map(({ storeName, profit, storeColor }, i) => ({
        name: storeName,
        profit: Math.round(profit * 100) / 100,
        fill: storeColor || CHART_COLORS[i % CHART_COLORS.length]
      })),
    [profitSummary]
  );

  /** Chart data for net profit bar chart */
  const netProfitChartData = useMemo(
    () =>
      profitSummary.map(({ storeName, netProfit, storeColor }, i) => ({
        name: storeName,
        profit: Math.round(netProfit * 100) / 100,
        fill: storeColor || CHART_COLORS[i % CHART_COLORS.length]
      })),
    [profitSummary]
  );

  /** Totals across all selected stores (for summary + chart) */
  const totalSummary = useMemo(() => {
    const totals = profitSummary.reduce(
      (acc, s) => ({
        revenue: acc.revenue + s.revenue,
        expenses: acc.expenses + s.expenses,
        grossProfit: acc.grossProfit + s.grossProfit,
        profit: acc.profit + s.profit,
        netProfit: acc.netProfit + s.netProfit
      }),
      { revenue: 0, expenses: 0, grossProfit: 0, profit: 0, netProfit: 0 }
    );
    const marginPct =
      totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0;
    return { ...totals, marginPct };
  }, [profitSummary]);

  /** Chart data: total Revenue, Expenses, Gross profit, Profit, Net profit (all stores) */
  const totalChartData = useMemo(
    () => [
      { name: 'Revenue', value: Math.round(totalSummary.revenue * 100) / 100, fill: '#2196F3' },
      { name: 'Expenses', value: Math.round(totalSummary.expenses * 100) / 100, fill: '#f44336' },
      { name: 'Gross profit (margin)', value: Math.round(totalSummary.grossProfit * 100) / 100, fill: '#9C27B0' },
      { name: 'Profit', value: Math.round(totalSummary.profit * 100) / 100, fill: '#FF9800' },
      { name: 'Net profit', value: Math.round(totalSummary.netProfit * 100) / 100, fill: '#43a047' }
    ],
    [totalSummary]
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
              <>
                <div className="profit-summary total-summary">
                  <h4 className="profit-summary-title">Total (all selected stores)</h4>
                  <div className="total-summary-stats">
                    <div className="total-summary-stat" title="Total sales in period">
                      <span className="total-summary-label">Revenue</span>
                      <span className="total-summary-value">₱{totalSummary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="total-summary-stat" title="Prorated fixed + labor">
                      <span className="total-summary-label">Expenses</span>
                      <span className="total-summary-value">₱{totalSummary.expenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="total-summary-stat" title="Margin = Gross profit / Revenue">
                      <span className="total-summary-label">Margin</span>
                      <span className="total-summary-value">{totalSummary.marginPct.toFixed(1)}%</span>
                    </div>
                    <div className="total-summary-stat" title="Revenue − Expenses">
                      <span className="total-summary-label">Profit</span>
                      <span className="total-summary-value">₱{totalSummary.profit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="total-summary-stat" title="Gross profit − Expenses">
                      <span className="total-summary-label">Net profit</span>
                      <span className="total-summary-value">₱{totalSummary.netProfit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
                <div className="profit-chart-wrap">
                  <h4 className="profit-chart-title">Total: Revenue, Expenses, Margin, Profit & Net profit</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={totalChartData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${v}`} />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => [`₱${Number(value).toFixed(2)}`, 'Amount']}
                        labelStyle={{ fontWeight: 600 }}
                        contentStyle={{ fontSize: 13 }}
                      />
                      <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]}>
                        {totalChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <hr className="analytics-section-separator" />
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
                <hr className="analytics-section-separator" />
                <div className="profit-summary">
                  <h4 className="profit-summary-title">Net profit (Gross profit − Expenses)</h4>
                  <div className="profit-summary-grid">
                    {profitSummary.map(({ storeName, grossProfit, expenses, netProfit, netProfitTooltip }) => (
                      <div
                        key={storeName}
                        className={`profit-summary-item ${netProfit >= 0 ? 'positive' : 'negative'}`}
                        title={netProfitTooltip}
                      >
                        <span className="profit-store-name">{storeName}</span>
                        <span className="profit-value">₱{netProfit.toFixed(2)}</span>
                        <span className="profit-detail">
                          Gross ₱{grossProfit.toFixed(0)} − Expenses ₱{expenses.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="profit-chart-wrap">
                  <h4 className="profit-chart-title">Net profit by store</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={netProfitChartData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${v}`} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => [`₱${Number(value).toFixed(2)}`, 'Net profit']}
                        labelStyle={{ fontWeight: 600 }}
                        contentStyle={{ fontSize: 13 }}
                      />
                      <Bar dataKey="profit" name="Net profit" radius={[0, 4, 4, 0]}>
                        {netProfitChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <hr className="analytics-section-separator" />
                <div className="profit-summary">
                  <h4 className="profit-summary-title">Profit (Revenue − Expenses)</h4>
                  <div className="profit-summary-grid">
                    {profitSummary.map(({ storeName, revenue, expenses, profit, profitTooltip }) => (
                      <div
                        key={storeName}
                        className={`profit-summary-item ${profit >= 0 ? 'positive' : 'negative'}`}
                        title={profitTooltip}
                      >
                        <span className="profit-store-name">{storeName}</span>
                        <span className="profit-value">₱{profit.toFixed(2)}</span>
                        <span className="profit-detail">
                          Revenue ₱{revenue.toFixed(0)} − Expenses ₱{expenses.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="profit-chart-wrap">
                  <h4 className="profit-chart-title">Profit by store (Revenue − Expenses)</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={profitChartData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${v}`} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => [`₱${Number(value).toFixed(2)}`, 'Profit']}
                        labelStyle={{ fontWeight: 600 }}
                        contentStyle={{ fontSize: 13 }}
                      />
                      <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                        {profitChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <hr className="analytics-section-separator" />
              </>
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
