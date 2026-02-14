import { supabase, useSupabase } from './supabaseClient.js';

const STORAGE_KEYS = {
  INVENTORY: 'salestracker_inventory',
  SALES: 'salestracker_sales',
  EMPLOYEES: 'salestracker_employees',
  ATTENDANCE: 'salestracker_attendance',
  WEEKLY_PAYMENTS: 'salestracker_weekly_payments'
};

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
  const { data, error } = await supabase.from('employees').select('*').order('name');
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    salaryRate: row.salary_rate != null ? parseFloat(row.salary_rate) : 0
  }));
}

async function saveEmployeeSupabase(employee) {
  const row = {
    name: employee.name,
    salary_rate: employee.salaryRate != null ? employee.salaryRate : 0
  };
  if (employee.id) {
    const { data, error } = await supabase.from('employees').update(row).eq('id', employee.id).select().single();
    if (error) throw error;
    return { id: data.id, name: data.name, salaryRate: parseFloat(data.salary_rate || 0) };
  }
  const { data, error } = await supabase.from('employees').insert(row).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, salaryRate: parseFloat(data.salary_rate || 0) };
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

function getEmployeesLocal() {
  const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
  const list = data ? JSON.parse(data) : [];
  return list.map((e) => ({
    id: e.id,
    name: e.name,
    salaryRate: e.salaryRate != null ? parseFloat(e.salaryRate) : 0
  }));
}

function saveEmployeeLocal(employee) {
  const emp = {
    id: employee.id || crypto.randomUUID(),
    name: employee.name,
    salaryRate: employee.salaryRate != null ? Number(employee.salaryRate) : 0
  };
  const employees = getEmployeesLocal();
  const existingIndex = employees.findIndex((e) => e.id === emp.id);
  if (existingIndex >= 0) {
    employees[existingIndex] = emp;
  } else {
    employees.push(emp);
  }
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  return emp;
}

function deleteEmployeeLocal(id) {
  const employees = getEmployeesLocal().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
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

// ---- Public API (always async) ----
export const getInventory = () =>
  useSupabase() ? getInventorySupabase() : Promise.resolve(getInventoryLocal());

export const saveInventoryItem = (item) =>
  useSupabase() ? saveInventoryItemSupabase(item) : Promise.resolve(saveInventoryItemLocal(item));

export const deleteInventoryItem = (id) =>
  useSupabase()
    ? deleteInventoryItemSupabase(id)
    : Promise.resolve(deleteInventoryItemLocal(id));

export const getSales = () =>
  useSupabase() ? getSalesSupabase() : Promise.resolve(getSalesLocal());

export const recordSale = (sale) =>
  useSupabase() ? recordSaleSupabase(sale) : Promise.resolve(recordSaleLocal(sale));

export const getEmployees = () =>
  useSupabase() ? getEmployeesSupabase() : Promise.resolve(getEmployeesLocal());

export const saveEmployee = (employee) =>
  useSupabase() ? saveEmployeeSupabase(employee) : Promise.resolve(saveEmployeeLocal(employee));

export const deleteEmployee = (id) =>
  useSupabase() ? deleteEmployeeSupabase(id) : Promise.resolve(deleteEmployeeLocal(id));

export const getAttendanceForWeek = (startDate, endDate) =>
  useSupabase()
    ? getAttendanceForWeekSupabase(startDate, endDate)
    : Promise.resolve(getAttendanceForWeekLocal(startDate, endDate));

export const toggleAttendance = (employeeId, dateStr) =>
  useSupabase()
    ? toggleAttendanceSupabase(employeeId, dateStr)
    : Promise.resolve(toggleAttendanceLocal(employeeId, dateStr));

export const getWeeklyPaymentsForWeek = (weekStartStr) =>
  useSupabase()
    ? getWeeklyPaymentsForWeekSupabase(weekStartStr)
    : Promise.resolve(getWeeklyPaymentsForWeekLocal(weekStartStr));

export const setWeeklyPaid = (employeeId, weekStartStr, paid) =>
  useSupabase()
    ? setWeeklyPaidSupabase(employeeId, weekStartStr, paid)
    : Promise.resolve(setWeeklyPaidLocal(employeeId, weekStartStr, paid));

export const clearAllData = () => {
  if (useSupabase()) {
    return Promise.all([
      supabase.from('weekly_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]).then(() => {});
  }
  localStorage.removeItem(STORAGE_KEYS.WEEKLY_PAYMENTS);
  localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
  localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
  localStorage.removeItem(STORAGE_KEYS.INVENTORY);
  localStorage.removeItem(STORAGE_KEYS.SALES);
  return Promise.resolve();
};
