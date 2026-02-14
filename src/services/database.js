import { supabase, useSupabase } from './supabaseClient.js';

const STORAGE_KEYS = {
  INVENTORY: 'salestracker_inventory',
  SALES: 'salestracker_sales'
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

export const clearAllData = () => {
  if (useSupabase()) {
    return Promise.all([
      supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]).then(() => {});
  }
  localStorage.removeItem(STORAGE_KEYS.INVENTORY);
  localStorage.removeItem(STORAGE_KEYS.SALES);
  return Promise.resolve();
};
