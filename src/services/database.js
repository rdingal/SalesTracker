import { supabase, useSupabase } from './supabaseClient.js';

const STORAGE_KEYS = {
  INVENTORY: 'salestracker_inventory',
  SALES: 'salestracker_sales',
  EMPLOYEES: 'salestracker_employees',
  EMPLOYEE_ORDER: 'salestracker_employee_order',
  ATTENDANCE: 'salestracker_attendance',
  WEEKLY_PAYMENTS: 'salestracker_weekly_payments',
  WEEKLY_DEDUCTIONS: 'salestracker_weekly_deductions',
  STORES: 'salestracker_stores',
  STORE_ORDER: 'salestracker_store_order',
  STORE_DAILY_SALES: 'salestracker_store_daily_sales',
  STORE_MONTHLY_EXPENSES: 'salestracker_store_monthly_expenses'
};

// ---- In-memory cache for Supabase reads (avoids refetch when switching tabs) ----
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

function cacheInvalidate(keyOrPrefix) {
  if (cache.has(keyOrPrefix)) {
    cache.delete(keyOrPrefix);
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyOrPrefix)) cache.delete(key);
  }
}

function cachedRead(key, fetchFn) {
  const hit = cacheGet(key);
  if (hit !== null) return Promise.resolve(hit);
  return fetchFn().then((data) => {
    cacheSet(key, data);
    return data;
  });
}

// ---- Supabase (async) ----
async function getInventorySupabase() {
  const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    price: parseFloat(row.price),
    quantity: row.quantity,
    description: row.description || ''
  }));
}

async function saveInventoryItemSupabase(item) {
  const row = {
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    description: item.description || ''
  };
  if (item.id) {
    const { data, error } = await supabase.from('inventory').update(row).eq('id', item.id).select().single();
    if (error) throw error;
    return { id: data.id, ...row };
  }
  const { data, error } = await supabase.from('inventory').insert(row).select().single();
  if (error) throw error;
  return { id: data.id, ...row };
}

async function deleteInventoryItemSupabase(id) {
  const { error } = await supabase.from('inventory').delete().eq('id', id);
  if (error) throw error;
}

async function getSalesSupabase() {
  const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    quantity: row.quantity,
    price: parseFloat(row.price),
    total: parseFloat(row.total),
    customerName: row.customer_name || '',
    date: row.date
  }));
}

async function getEmployeesSupabase() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    salaryRate: row.salary_rate != null ? parseFloat(row.salary_rate) : 0,
    storeId: row.store_id || null
  }));
}

async function updateEmployeeOrderSupabase(orderedEmployeeIds) {
  for (let i = 0; i < orderedEmployeeIds.length; i++) {
    const { error } = await supabase
      .from('employees')
      .update({ display_order: i })
      .eq('id', orderedEmployeeIds[i]);
    if (error) throw error;
  }
}

async function saveEmployeeSupabase(employee) {
  let row = {
    name: employee.name,
    salary_rate: employee.salaryRate != null ? employee.salaryRate : 0,
    store_id: employee.storeId ?? null
  };
  if (!employee.id) {
    const { data: maxRow } = await supabase
      .from('employees')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    row.display_order = (maxRow?.display_order ?? -1) + 1;
  }
  if (employee.id) {
    const { data, error } = await supabase
      .from('employees')
      .update({ name: row.name, salary_rate: row.salary_rate, store_id: row.store_id })
      .eq('id', employee.id)
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, salaryRate: parseFloat(data.salary_rate || 0), storeId: data.store_id || null };
  }
  const { data, error } = await supabase.from('employees').insert(row).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, salaryRate: parseFloat(data.salary_rate || 0), storeId: data.store_id || null };
}

async function deleteEmployeeSupabase(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

async function getAttendanceForWeekSupabase(startDate, endDate) {
  const { data, error } = await supabase
    .from('attendance')
    .select('employee_id, date')
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;
  return (data || []).map((row) => ({
    employeeId: row.employee_id,
    date: row.date
  }));
}

async function getWeeklyPaymentsForWeekSupabase(weekStartStr) {
  const { data, error } = await supabase
    .from('weekly_payments')
    .select('employee_id, paid')
    .eq('week_start', weekStartStr);
  if (error) throw error;
  return (data || []).map((row) => ({
    employeeId: row.employee_id,
    paid: !!row.paid
  }));
}

async function setWeeklyPaidSupabase(employeeId, weekStartStr, paid) {
  const { error } = await supabase
    .from('weekly_payments')
    .upsert(
      { employee_id: employeeId, week_start: weekStartStr, paid },
      { onConflict: 'employee_id,week_start' }
    );
  if (error) throw error;
}

async function getDeductionsForWeekSupabase(weekStartStr) {
  const { data, error } = await supabase
    .from('weekly_deductions')
    .select('employee_id, amount')
    .eq('week_start', weekStartStr);
  if (error) throw error;
  return (data || []).map((row) => ({
    employeeId: row.employee_id,
    amount: parseFloat(row.amount || 0)
  }));
}

/** Get all deductions for weeks overlapping [startDate, endDate]. Returns { employeeId, amount } summed per employee. */
async function getDeductionsForDateRangeSupabase(startDate, endDate) {
  const start = new Date(startDate);
  const startMinus6 = new Date(start);
  startMinus6.setDate(start.getDate() - 6);
  const weekStartFrom = startMinus6.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('weekly_deductions')
    .select('employee_id, amount')
    .gte('week_start', weekStartFrom)
    .lte('week_start', endDate);
  if (error) throw error;
  const byEmployee = {};
  (data || []).forEach((row) => {
    const id = row.employee_id;
    const amt = parseFloat(row.amount || 0);
    byEmployee[id] = (byEmployee[id] || 0) + amt;
  });
  return Object.entries(byEmployee).map(([employeeId, amount]) => ({ employeeId, amount }));
}

async function saveDeductionSupabase(employeeId, weekStartStr, amount) {
  const { error } = await supabase
    .from('weekly_deductions')
    .upsert(
      { employee_id: employeeId, week_start: weekStartStr, amount },
      { onConflict: 'employee_id,week_start' }
    );
  if (error) throw error;
}

async function toggleAttendanceSupabase(employeeId, dateStr) {
  const existing = await supabase
    .from('attendance')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('date', dateStr)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const { error } = await supabase.from('attendance').delete().eq('id', existing.data.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('attendance').insert({ employee_id: employeeId, date: dateStr });
  if (error) throw error;
  return true;
}

async function recordSaleSupabase(sale) {
  const { data, error } = await supabase
    .from('sales')
    .insert({
      item_id: sale.itemId,
      item_name: sale.itemName,
      quantity: sale.quantity,
      price: sale.price,
      total: sale.total,
      customer_name: sale.customerName || '',
      date: sale.date
    })
    .select()
    .single();
  if (error) throw error;

  const inventory = await getInventorySupabase();
  const item = inventory.find((i) => i.id === sale.itemId);
  if (item) {
    await supabase.from('inventory').update({ quantity: item.quantity - sale.quantity }).eq('id', sale.itemId);
  }

  return {
    id: data.id,
    itemId: data.item_id,
    itemName: data.item_name,
    quantity: data.quantity,
    price: parseFloat(data.price),
    total: parseFloat(data.total),
    customerName: data.customer_name || '',
    date: data.date
  };
}

async function getStoresSupabase() {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color || '#333333',
    monthlyRent: row.monthly_rent != null ? parseFloat(row.monthly_rent) : 0,
    monthlyUtilityBills: row.monthly_utility_bills != null ? parseFloat(row.monthly_utility_bills) : 0,
    monthlyOtherExpenses: row.monthly_other_expenses != null ? parseFloat(row.monthly_other_expenses) : 0,
    markupPercentage: row.markup_percentage != null ? parseFloat(row.markup_percentage) : 0
  }));
}

async function saveStoreSupabase(store) {
  const row = {
    name: store.name,
    color: store.color || '#333333',
    monthly_rent: store.monthlyRent != null ? Number(store.monthlyRent) : 0,
    monthly_utility_bills: store.monthlyUtilityBills != null ? Number(store.monthlyUtilityBills) : 0,
    monthly_other_expenses: store.monthlyOtherExpenses != null ? Number(store.monthlyOtherExpenses) : 0,
    markup_percentage: store.markupPercentage != null ? Number(store.markupPercentage) : 0
  };
  if (store.id) {
    const { data, error } = await supabase
      .from('stores')
      .update(row)
      .eq('id', store.id)
      .select()
      .single();
    if (error) throw error;
    if (Array.isArray(store.linkedEmployeeIds)) {
      await supabase.from('employees').update({ store_id: null }).eq('store_id', store.id);
      if (store.linkedEmployeeIds.length > 0) {
        await supabase.from('employees').update({ store_id: store.id }).in('id', store.linkedEmployeeIds);
      }
    }
    return {
      id: data.id,
      name: data.name,
      color: data.color || '#333333',
      monthlyRent: data.monthly_rent != null ? parseFloat(data.monthly_rent) : 0,
      monthlyUtilityBills: data.monthly_utility_bills != null ? parseFloat(data.monthly_utility_bills) : 0,
      monthlyOtherExpenses: data.monthly_other_expenses != null ? parseFloat(data.monthly_other_expenses) : 0,
      markupPercentage: data.markup_percentage != null ? parseFloat(data.markup_percentage) : 0
    };
  }
  const { data: maxRow } = await supabase
    .from('stores')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  row.display_order = (maxRow?.display_order ?? -1) + 1;
  const { data, error } = await supabase.from('stores').insert(row).select().single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    color: data.color || '#333333',
    monthlyRent: data.monthly_rent != null ? parseFloat(data.monthly_rent) : 0,
    monthlyUtilityBills: data.monthly_utility_bills != null ? parseFloat(data.monthly_utility_bills) : 0,
    monthlyOtherExpenses: data.monthly_other_expenses != null ? parseFloat(data.monthly_other_expenses) : 0,
    markupPercentage: data.markup_percentage != null ? parseFloat(data.markup_percentage) : 0
  };
}

async function deleteStoreSupabase(id) {
  const { error } = await supabase.from('stores').delete().eq('id', id);
  if (error) throw error;
}

async function getStoreSalesForWeekSupabase(startDate, endDate) {
  const { data, error } = await supabase
    .from('store_daily_sales')
    .select('store_id, date, amount')
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;
  return (data || []).map((row) => ({
    storeId: row.store_id,
    date: row.date,
    amount: parseFloat(row.amount || 0)
  }));
}

async function saveStoreDailySaleSupabase(storeId, dateStr, amount) {
  const { error } = await supabase
    .from('store_daily_sales')
    .upsert(
      { store_id: storeId, date: dateStr, amount },
      { onConflict: 'store_id,date' }
    );
  if (error) throw error;
}

async function getStoreMonthlyExpensesSupabase(storeId, yearMonth) {
  const { data, error } = await supabase
    .from('store_monthly_expenses')
    .select('monthly_rent, monthly_utility_bills, monthly_employee_salaries, monthly_other_expenses')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    monthlyRent: parseFloat(data.monthly_rent || 0),
    monthlyUtilityBills: parseFloat(data.monthly_utility_bills || 0),
    monthlyEmployeeSalaries: parseFloat(data.monthly_employee_salaries || 0),
    monthlyOtherExpenses: parseFloat(data.monthly_other_expenses || 0)
  };
}

async function saveStoreMonthlyExpensesSupabase(storeId, yearMonth, expenses) {
  const row = {
    store_id: storeId,
    year_month: yearMonth,
    monthly_rent: Number(expenses.monthlyRent ?? 0),
    monthly_utility_bills: Number(expenses.monthlyUtilityBills ?? 0),
    monthly_employee_salaries: Number(expenses.monthlyEmployeeSalaries ?? 0),
    monthly_other_expenses: Number(expenses.monthlyOtherExpenses ?? 0)
  };
  const { error } = await supabase
    .from('store_monthly_expenses')
    .upsert(row, { onConflict: 'store_id,year_month' });
  if (error) throw error;
}

// ---- LocalStorage (sync, wrapped in Promises for same API) ----
function getInventoryLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  return data ? JSON.parse(data) : [];
}

function saveInventoryItemLocal(item) {
  const inventory = getInventoryLocal();
  const existingIndex = inventory.findIndex((i) => i.id === item.id);
  if (existingIndex >= 0) {
    inventory[existingIndex] = item;
  } else {
    inventory.push(item);
  }
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  return item;
}

function deleteInventoryItemLocal(id) {
  const inventory = getInventoryLocal().filter((i) => i.id !== id);
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
}

function getEmployeeOrderLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_ORDER);
  return data ? JSON.parse(data) : [];
}

function getEmployeesLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
  const list = data ? JSON.parse(data) : [];
  const order = getEmployeeOrderLocal();
  const employees = list.map((e) => ({
    id: e.id,
    name: e.name,
    salaryRate: e.salaryRate != null ? parseFloat(e.salaryRate) : 0,
    storeId: e.storeId ?? null
  }));
  if (order.length === 0) return employees.sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(employees.map((e) => [e.id, e]));
  const ordered = [];
  for (const id of order) {
    const emp = byId.get(id);
    if (emp) {
      ordered.push(emp);
      byId.delete(id);
    }
  }
  ordered.push(...byId.values());
  return ordered;
}

function updateEmployeeOrderLocal(orderedEmployeeIds) {
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_ORDER, JSON.stringify(orderedEmployeeIds));
}

function saveEmployeeLocal(employee) {
  const emp = {
    id: employee.id || crypto.randomUUID(),
    name: employee.name,
    salaryRate: employee.salaryRate != null ? Number(employee.salaryRate) : 0,
    storeId: employee.storeId ?? null
  };
  const rawList = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES) || '[]');
  const rawIndex = rawList.findIndex((e) => e.id === emp.id);
  const raw = { id: emp.id, name: emp.name, salaryRate: emp.salaryRate, storeId: emp.storeId };
  if (rawIndex >= 0) {
    rawList[rawIndex] = raw;
  } else {
    rawList.push(raw);
    const order = getEmployeeOrderLocal();
    order.push(emp.id);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_ORDER, JSON.stringify(order));
  }
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(rawList));
  return emp;
}

function deleteEmployeeLocal(id) {
  const rawList = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES) || '[]');
  const filtered = rawList.filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(filtered));
  const order = getEmployeeOrderLocal().filter((oid) => oid !== id);
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_ORDER, JSON.stringify(order));
}

function getAttendanceLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
  return data ? JSON.parse(data) : [];
}

function getAttendanceForWeekLocal(startDate, endDate) {
  const attendance = getAttendanceLocal();
  return attendance.filter(
    (a) => a.date >= startDate && a.date <= endDate
  ).map((a) => ({ employeeId: a.employeeId, date: a.date }));
}

function toggleAttendanceLocal(employeeId, dateStr) {
  const attendance = getAttendanceLocal();
  const idx = attendance.findIndex(
    (a) => a.employeeId === employeeId && a.date === dateStr
  );
  if (idx >= 0) {
    attendance.splice(idx, 1);
  } else {
    attendance.push({ id: crypto.randomUUID(), employeeId, date: dateStr });
  }
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
  return idx < 0;
}

function getWeeklyPaymentsLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_PAYMENTS);
  return data ? JSON.parse(data) : [];
}

function getWeeklyPaymentsForWeekLocal(weekStartStr) {
  const payments = getWeeklyPaymentsLocal();
  return payments
    .filter((p) => p.weekStart === weekStartStr)
    .map((p) => ({ employeeId: p.employeeId, paid: !!p.paid }));
}

function setWeeklyPaidLocal(employeeId, weekStartStr, paid) {
  const payments = getWeeklyPaymentsLocal();
  const idx = payments.findIndex(
    (p) => p.employeeId === employeeId && p.weekStart === weekStartStr
  );
  const record = { employeeId, weekStart: weekStartStr, paid };
  if (idx >= 0) {
    payments[idx] = record;
  } else {
    payments.push(record);
  }
  localStorage.setItem(STORAGE_KEYS.WEEKLY_PAYMENTS, JSON.stringify(payments));
}

function getDeductionsLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_DEDUCTIONS);
  return data ? JSON.parse(data) : [];
}

function getDeductionsForWeekLocal(weekStartStr) {
  const list = getDeductionsLocal();
  return list
    .filter((d) => d.weekStart === weekStartStr)
    .map((d) => ({ employeeId: d.employeeId, amount: parseFloat(d.amount || 0) }));
}

/** Get all deductions for weeks overlapping [startDate, endDate]. Returns { employeeId, amount } summed per employee. */
function getDeductionsForDateRangeLocal(startDate, endDate) {
  const list = getDeductionsLocal();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMinus6 = new Date(start);
  startMinus6.setDate(start.getDate() - 6);
  const byEmployee = {};
  list.forEach((d) => {
    const ws = new Date(d.weekStart);
    if (ws >= startMinus6 && ws <= end) {
      const id = d.employeeId;
      const amt = parseFloat(d.amount || 0);
      byEmployee[id] = (byEmployee[id] || 0) + amt;
    }
  });
  return Object.entries(byEmployee).map(([employeeId, amount]) => ({ employeeId, amount }));
}

function saveDeductionLocal(employeeId, weekStartStr, amount) {
  const list = getDeductionsLocal();
  const idx = list.findIndex(
    (d) => d.employeeId === employeeId && d.weekStart === weekStartStr
  );
  const record = { employeeId, weekStart: weekStartStr, amount: Number(amount) || 0 };
  if (idx >= 0) {
    list[idx] = record;
  } else {
    list.push(record);
  }
  localStorage.setItem(STORAGE_KEYS.WEEKLY_DEDUCTIONS, JSON.stringify(list));
}

function getStoreOrderLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.STORE_ORDER);
  return data ? JSON.parse(data) : [];
}

function getStoresLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.STORES);
  const list = data ? JSON.parse(data) : [];
  const order = getStoreOrderLocal();
  const stores = list.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color || '#333333',
    monthlyRent: s.monthlyRent != null ? parseFloat(s.monthlyRent) : 0,
    monthlyUtilityBills: s.monthlyUtilityBills != null ? parseFloat(s.monthlyUtilityBills) : 0,
    monthlyOtherExpenses: s.monthlyOtherExpenses != null ? parseFloat(s.monthlyOtherExpenses) : 0,
    markupPercentage: s.markupPercentage != null ? parseFloat(s.markupPercentage) : 0
  }));
  if (order.length === 0) return stores.sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(stores.map((s) => [s.id, s]));
  const ordered = [];
  for (const id of order) {
    const store = byId.get(id);
    if (store) {
      ordered.push(store);
      byId.delete(id);
    }
  }
  ordered.push(...byId.values());
  return ordered;
}

function saveStoreLocal(store) {
  const s = {
    id: store.id || crypto.randomUUID(),
    name: store.name,
    color: store.color || '#333333',
    monthlyRent: store.monthlyRent != null ? Number(store.monthlyRent) : 0,
    monthlyUtilityBills: store.monthlyUtilityBills != null ? Number(store.monthlyUtilityBills) : 0,
    monthlyOtherExpenses: store.monthlyOtherExpenses != null ? Number(store.monthlyOtherExpenses) : 0,
    markupPercentage: store.markupPercentage != null ? Number(store.markupPercentage) : 0
  };
  const rawList = JSON.parse(localStorage.getItem(STORAGE_KEYS.STORES) || '[]');
  const rawIndex = rawList.findIndex((x) => x.id === s.id);
  if (rawIndex >= 0) {
    rawList[rawIndex] = s;
  } else {
    rawList.push(s);
    const order = getStoreOrderLocal();
    order.push(s.id);
    localStorage.setItem(STORAGE_KEYS.STORE_ORDER, JSON.stringify(order));
  }
  localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(rawList));
  if (Array.isArray(store.linkedEmployeeIds)) {
    const empList = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES) || '[]');
    empList.forEach((e) => {
      const inList = store.linkedEmployeeIds.includes(e.id);
      const wasInStore = e.storeId === s.id;
      if (wasInStore && !inList) e.storeId = null;
      else if (inList) e.storeId = s.id;
    });
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(empList));
  }
  return { id: s.id, name: s.name, color: s.color, monthlyRent: s.monthlyRent, monthlyUtilityBills: s.monthlyUtilityBills, monthlyOtherExpenses: s.monthlyOtherExpenses, markupPercentage: s.markupPercentage };
}

function deleteStoreLocal(id) {
  const rawList = JSON.parse(localStorage.getItem(STORAGE_KEYS.STORES) || '[]');
  localStorage.setItem(
    STORAGE_KEYS.STORES,
    JSON.stringify(rawList.filter((s) => s.id !== id))
  );
  localStorage.setItem(
    STORAGE_KEYS.STORE_ORDER,
    JSON.stringify(getStoreOrderLocal().filter((oid) => oid !== id))
  );
  const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.STORE_DAILY_SALES) || '[]');
  localStorage.setItem(
    STORAGE_KEYS.STORE_DAILY_SALES,
    JSON.stringify(sales.filter((s) => s.storeId !== id))
  );
}

function getStoreSalesLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.STORE_DAILY_SALES);
  return data ? JSON.parse(data) : [];
}

function getStoreSalesForWeekLocal(startDate, endDate) {
  const sales = getStoreSalesLocal();
  return sales
    .filter((s) => s.date >= startDate && s.date <= endDate)
    .map((s) => ({
      storeId: s.storeId,
      date: s.date,
      amount: parseFloat(s.amount || 0)
    }));
}

function saveStoreDailySaleLocal(storeId, dateStr, amount) {
  const sales = getStoreSalesLocal();
  const idx = sales.findIndex((s) => s.storeId === storeId && s.date === dateStr);
  const record = { storeId, date: dateStr, amount: Number(amount) || 0 };
  if (idx >= 0) {
    sales[idx] = record;
  } else {
    sales.push(record);
  }
  localStorage.setItem(STORAGE_KEYS.STORE_DAILY_SALES, JSON.stringify(sales));
}

function getStoreMonthlyExpensesLocal(storeId, yearMonth) {
  const data = localStorage.getItem(STORAGE_KEYS.STORE_MONTHLY_EXPENSES);
  const list = data ? JSON.parse(data) : [];
  const row = list.find((r) => r.storeId === storeId && r.yearMonth === yearMonth);
  if (!row) return null;
  return {
    monthlyRent: parseFloat(row.monthlyRent || 0),
    monthlyUtilityBills: parseFloat(row.monthlyUtilityBills || 0),
    monthlyEmployeeSalaries: parseFloat(row.monthlyEmployeeSalaries || 0),
    monthlyOtherExpenses: parseFloat(row.monthlyOtherExpenses || 0)
  };
}

function saveStoreMonthlyExpensesLocal(storeId, yearMonth, expenses) {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.STORE_MONTHLY_EXPENSES) || '[]');
  const idx = list.findIndex((r) => r.storeId === storeId && r.yearMonth === yearMonth);
  const row = {
    storeId,
    yearMonth,
    monthlyRent: Number(expenses.monthlyRent ?? 0),
    monthlyUtilityBills: Number(expenses.monthlyUtilityBills ?? 0),
    monthlyEmployeeSalaries: Number(expenses.monthlyEmployeeSalaries ?? 0),
    monthlyOtherExpenses: Number(expenses.monthlyOtherExpenses ?? 0)
  };
  if (idx >= 0) {
    list[idx] = row;
  } else {
    list.push(row);
  }
  localStorage.setItem(STORAGE_KEYS.STORE_MONTHLY_EXPENSES, JSON.stringify(list));
}

function getSalesLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.SALES);
  return data ? JSON.parse(data) : [];
}

function recordSaleLocal(sale) {
  const sales = getSalesLocal();
  sales.push(sale);
  localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  const inventory = getInventoryLocal();
  const item = inventory.find((i) => i.id === sale.itemId);
  if (item) {
    item.quantity -= sale.quantity;
    saveInventoryItemLocal(item);
  }
  return sale;
}

// ---- Public API (cached reads when using Supabase; invalidation on write) ----
export const getInventory = () =>
  useSupabase()
    ? cachedRead('inventory', getInventorySupabase)
    : Promise.resolve(getInventoryLocal());

export const saveInventoryItem = (item) =>
  useSupabase()
    ? saveInventoryItemSupabase(item).then((result) => {
        cacheInvalidate('inventory');
        return result;
      })
    : Promise.resolve(saveInventoryItemLocal(item));

export const deleteInventoryItem = (id) =>
  useSupabase()
    ? deleteInventoryItemSupabase(id).then(() => {
        cacheInvalidate('inventory');
      })
    : Promise.resolve(deleteInventoryItemLocal(id));

export const getSales = () =>
  useSupabase()
    ? cachedRead('sales', getSalesSupabase)
    : Promise.resolve(getSalesLocal());

export const recordSale = (sale) =>
  useSupabase()
    ? recordSaleSupabase(sale).then((result) => {
        cacheInvalidate('sales');
        cacheInvalidate('inventory');
        return result;
      })
    : Promise.resolve(recordSaleLocal(sale));

export const getEmployees = () =>
  useSupabase()
    ? cachedRead('employees', getEmployeesSupabase)
    : Promise.resolve(getEmployeesLocal());

export const saveEmployee = (employee) =>
  useSupabase()
    ? saveEmployeeSupabase(employee).then((result) => {
        cacheInvalidate('employees');
        return result;
      })
    : Promise.resolve(saveEmployeeLocal(employee));

export const deleteEmployee = (id) =>
  useSupabase()
    ? deleteEmployeeSupabase(id).then(() => {
        cacheInvalidate('employees');
      })
    : Promise.resolve(deleteEmployeeLocal(id));

export const updateEmployeeOrder = (orderedEmployeeIds) =>
  useSupabase()
    ? updateEmployeeOrderSupabase(orderedEmployeeIds).then(() => {
        cacheInvalidate('employees');
      })
    : Promise.resolve(updateEmployeeOrderLocal(orderedEmployeeIds));

export const getAttendanceForWeek = (startDate, endDate) =>
  useSupabase()
    ? cachedRead(`attendance:${startDate}:${endDate}`, () =>
        getAttendanceForWeekSupabase(startDate, endDate)
      )
    : Promise.resolve(getAttendanceForWeekLocal(startDate, endDate));

export const toggleAttendance = (employeeId, dateStr) =>
  useSupabase()
    ? toggleAttendanceSupabase(employeeId, dateStr).then((result) => {
        cacheInvalidate('attendance:');
        return result;
      })
    : Promise.resolve(toggleAttendanceLocal(employeeId, dateStr));

export const getWeeklyPaymentsForWeek = (weekStartStr) =>
  useSupabase()
    ? cachedRead(`weeklyPayments:${weekStartStr}`, () =>
        getWeeklyPaymentsForWeekSupabase(weekStartStr)
      )
    : Promise.resolve(getWeeklyPaymentsForWeekLocal(weekStartStr));

export const setWeeklyPaid = (employeeId, weekStartStr, paid) =>
  useSupabase()
    ? setWeeklyPaidSupabase(employeeId, weekStartStr, paid).then(() => {
        cacheInvalidate('weeklyPayments:');
      })
    : Promise.resolve(setWeeklyPaidLocal(employeeId, weekStartStr, paid));

export const getDeductionsForWeek = (weekStartStr) =>
  useSupabase()
    ? cachedRead(`deductions:${weekStartStr}`, () =>
        getDeductionsForWeekSupabase(weekStartStr)
      )
    : Promise.resolve(getDeductionsForWeekLocal(weekStartStr));

export const getDeductionsForDateRange = (startDate, endDate) =>
  useSupabase()
    ? cachedRead(`deductionsRange:${startDate}:${endDate}`, () =>
        getDeductionsForDateRangeSupabase(startDate, endDate)
      )
    : Promise.resolve(getDeductionsForDateRangeLocal(startDate, endDate));

export const saveDeduction = (employeeId, weekStartStr, amount) =>
  useSupabase()
    ? saveDeductionSupabase(employeeId, weekStartStr, amount).then(() => {
        cacheInvalidate('deductions:');
        cacheInvalidate('deductionsRange:');
      })
    : Promise.resolve(saveDeductionLocal(employeeId, weekStartStr, amount));

export const getStores = () =>
  useSupabase()
    ? cachedRead('stores', getStoresSupabase)
    : Promise.resolve(getStoresLocal());

export const saveStore = (store) =>
  useSupabase()
    ? saveStoreSupabase(store).then((result) => {
        cacheInvalidate('stores');
        cacheInvalidate('storeSales:');
        cacheInvalidate('storeMonthlyExpenses:');
        return result;
      })
    : Promise.resolve(saveStoreLocal(store));

export const deleteStore = (id) =>
  useSupabase()
    ? deleteStoreSupabase(id).then(() => {
        cacheInvalidate('stores');
        cacheInvalidate('storeSales:');
        cacheInvalidate('storeMonthlyExpenses:');
      })
    : Promise.resolve(deleteStoreLocal(id));

export const getStoreSalesForWeek = (startDate, endDate) =>
  useSupabase()
    ? cachedRead(`storeSales:${startDate}:${endDate}`, () =>
        getStoreSalesForWeekSupabase(startDate, endDate)
      )
    : Promise.resolve(getStoreSalesForWeekLocal(startDate, endDate));

export const saveStoreDailySale = (storeId, dateStr, amount) =>
  useSupabase()
    ? saveStoreDailySaleSupabase(storeId, dateStr, amount).then(() => {
        cacheInvalidate('storeSales:');
      })
    : Promise.resolve(saveStoreDailySaleLocal(storeId, dateStr, amount));

export const getStoreMonthlyExpenses = (storeId, yearMonth) =>
  useSupabase()
    ? cachedRead(`storeMonthlyExpenses:${storeId}:${yearMonth}`, () =>
        getStoreMonthlyExpensesSupabase(storeId, yearMonth)
      )
    : Promise.resolve(getStoreMonthlyExpensesLocal(storeId, yearMonth));

export const saveStoreMonthlyExpenses = (storeId, yearMonth, expenses) =>
  useSupabase()
    ? saveStoreMonthlyExpensesSupabase(storeId, yearMonth, expenses).then(() => {
        cacheInvalidate(`storeMonthlyExpenses:${storeId}:${yearMonth}`);
      })
    : Promise.resolve(saveStoreMonthlyExpensesLocal(storeId, yearMonth, expenses));

export const clearAllData = () => {
  cache.clear();
  if (useSupabase()) {
    return Promise.all([
      supabase.from('store_monthly_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('store_daily_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('stores').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('weekly_deductions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('weekly_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]).then(() => {});
  }
  localStorage.removeItem(STORAGE_KEYS.STORE_MONTHLY_EXPENSES);
  localStorage.removeItem(STORAGE_KEYS.STORE_DAILY_SALES);
  localStorage.removeItem(STORAGE_KEYS.STORE_ORDER);
  localStorage.removeItem(STORAGE_KEYS.STORES);
  localStorage.removeItem(STORAGE_KEYS.WEEKLY_DEDUCTIONS);
  localStorage.removeItem(STORAGE_KEYS.WEEKLY_PAYMENTS);
  localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEE_ORDER);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
  localStorage.removeItem(STORAGE_KEYS.INVENTORY);
  localStorage.removeItem(STORAGE_KEYS.SALES);
  return Promise.resolve();
};
