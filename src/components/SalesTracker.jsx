import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getInventory, getSales, recordSale } from '../services/database';
import './SalesTracker.css';

export default function SalesTracker() {
  const { canEdit } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    itemId: '',
    quantity: '',
    customerName: ''
  });

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([getInventory(), getSales()])
      .then(([inv, s]) => {
        setInventory(inv);
        setSales(s);
      })
      .catch((err) => setError(err?.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const item = inventory.find((i) => i.id === formData.itemId);
    if (!item) {
      alert('Please select an item');
      return;
    }
    const quantity = parseInt(formData.quantity, 10);
    if (quantity > item.quantity) {
      alert(`Only ${item.quantity} units available in stock`);
      return;
    }
    const sale = {
      itemId: formData.itemId,
      itemName: item.name,
      quantity,
      price: item.price,
      total: item.price * quantity,
      customerName: formData.customerName,
      date: new Date().toISOString()
    };
    setError(null);
    try {
      await recordSale(sale);
      loadData();
      setFormData({ itemId: '', quantity: '', customerName: '' });
      setShowForm(false);
    } catch (err) {
      setError(err?.message || 'Failed to record sale');
    }
  };

  const getTotalSales = () => {
    return sales.reduce((sum, sale) => sum + sale.total, 0);
  };

  const getRecentSales = () => {
    return sales.slice(-10).reverse();
  };

  return (
    <div className="sales-tracker">
      <div className="sales-header">
        <h2>Sales Tracking</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary" disabled={!canEdit} type="button">
          {showForm ? 'Cancel' : '+ Record Sale'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && inventory.length === 0 && sales.length === 0 ? (
        <p className="empty-state">Loading…</p>
      ) : null}

      <div className="sales-stats">
        <div className="stat-card">
          <div className="stat-label">Total Sales</div>
          <div className="stat-value">₱{getTotalSales().toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Number of Transactions</div>
          <div className="stat-value">{sales.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Items in Inventory</div>
          <div className="stat-value">{inventory.length}</div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="sales-form">
          <div className="form-row">
            <div className="form-group">
              <label>Select Item *</label>
              <select
                value={formData.itemId}
                onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                required
                disabled={!canEdit}
              >
                <option value="">-- Select an item --</option>
                {inventory.filter(item => item.quantity > 0).map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} (₱{item.price} - {item.quantity} available)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                disabled={!canEdit}
              />
            </div>
            <div className="form-group">
              <label>Customer Name</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                disabled={!canEdit}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={!canEdit}>
            Record Sale
          </button>
        </form>
      )}

      <div className="sales-list">
        <h3>Recent Sales</h3>
        {!loading && sales.length === 0 ? (
          <p className="empty-state">No sales recorded yet. Record your first sale to get started!</p>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Customer</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {getRecentSales().map((sale) => (
                <tr key={sale.id}>
                  <td>{new Date(sale.date).toLocaleDateString()}</td>
                  <td>{sale.itemName}</td>
                  <td>{sale.customerName || '-'}</td>
                  <td>{sale.quantity}</td>
                  <td>₱{sale.price.toFixed(2)}</td>
                  <td>₱{sale.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
