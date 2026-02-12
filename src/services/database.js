/**
 * Database Service Placeholder
 * 
 * This is a placeholder for database operations.
 * To connect to Supabase:
 * 1. Install: npm install @supabase/supabase-js
 * 2. Create a Supabase project at https://supabase.com
 * 3. Replace SUPABASE_URL and SUPABASE_KEY with your project credentials
 * 4. Uncomment the Supabase client code below
 */

// import { createClient } from '@supabase/supabase-js'
// const SUPABASE_URL = 'your-project-url'
// const SUPABASE_KEY = 'your-anon-key'
// export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// For now, using localStorage as a simple storage mechanism
const STORAGE_KEYS = {
  INVENTORY: 'salestracker_inventory',
  SALES: 'salestracker_sales'
};

/**
 * Get all inventory items
 */
export const getInventory = () => {
  const data = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  return data ? JSON.parse(data) : [];
};

/**
 * Add or update an inventory item
 */
export const saveInventoryItem = (item) => {
  const inventory = getInventory();
  const existingIndex = inventory.findIndex(i => i.id === item.id);
  
  if (existingIndex >= 0) {
    inventory[existingIndex] = item;
  } else {
    inventory.push(item);
  }
  
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  return item;
};

/**
 * Delete an inventory item
 */
export const deleteInventoryItem = (id) => {
  const inventory = getInventory();
  const filtered = inventory.filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(filtered));
};

/**
 * Get all sales records
 */
export const getSales = () => {
  const data = localStorage.getItem(STORAGE_KEYS.SALES);
  return data ? JSON.parse(data) : [];
};

/**
 * Record a new sale
 */
export const recordSale = (sale) => {
  const sales = getSales();
  sales.push(sale);
  localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  
  // Update inventory quantity
  const inventory = getInventory();
  const item = inventory.find(i => i.id === sale.itemId);
  if (item) {
    item.quantity -= sale.quantity;
    saveInventoryItem(item);
  }
  
  return sale;
};

/**
 * Clear all data (useful for testing)
 */
export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEYS.INVENTORY);
  localStorage.removeItem(STORAGE_KEYS.SALES);
};
