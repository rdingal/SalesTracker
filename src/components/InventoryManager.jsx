import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getInventory, saveInventoryItem, deleteInventoryItem } from '../services/database';
import './InventoryManager.css';

export default function InventoryManager() {
  const { canEdit } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: '',
    quantity: '',
    description: ''
  });

  const loadInventory = () => {
    setLoading(true);
    setError(null);
    getInventory()
      .then(setInventory)
      .catch((err) => setError(err?.message || 'Failed to load inventory'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: formData.id || undefined,
      name: formData.name,
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity, 10),
      description: formData.description || ''
    };
    setError(null);
    try {
      await saveInventoryItem(item);
      loadInventory();
      setFormData({ id: '', name: '', price: '', quantity: '', description: '' });
      setShowForm(false);
    } catch (err) {
      setError(err?.message || 'Failed to save item');
    }
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      name: item.name,
      price: item.price.toString(),
      quantity: item.quantity.toString(),
      description: item.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    setError(null);
    try {
      await deleteInventoryItem(id);
      loadInventory();
    } catch (err) {
      setError(err?.message || 'Failed to delete item');
    }
  };

  return (
    <div className="inventory-manager">
      <div className="inventory-header">
        <h2>Inventory Management</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary" disabled={!canEdit} type="button">
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && inventory.length === 0 ? (
        <p className="empty-state">Loading inventory…</p>
      ) : null}

      {showForm && (
        <form onSubmit={handleSubmit} className="inventory-form">
          <div className="form-row">
            <div className="form-group">
              <label>Item Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={!canEdit}
              />
            </div>
            <div className="form-group">
              <label>Price (₱) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                disabled={!canEdit}
              />
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              disabled={!canEdit}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!canEdit}>
            {formData.id ? 'Update Item' : 'Add Item'}
          </button>
        </form>
      )}

      <div className="inventory-list">
        {!loading && inventory.length === 0 ? (
          <p className="empty-state">No items in inventory. Add your first item to get started!</p>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id} className={item.quantity < 10 ? 'low-stock' : ''}>
                  <td>{item.name}</td>
                  <td>{item.description}</td>
                  <td>₱{item.price.toFixed(2)}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <button onClick={() => handleEdit(item)} className="btn-small" disabled={!canEdit} type="button">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="btn-small btn-danger" disabled={!canEdit} type="button">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
