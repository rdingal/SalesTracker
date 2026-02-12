import { useState, useEffect } from 'react';
import { getInventory, saveInventoryItem, deleteInventoryItem } from '../services/database';
import './InventoryManager.css';

export default function InventoryManager() {
  const [inventory, setInventory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: '',
    quantity: '',
    description: ''
  });

  const loadInventory = () => {
    const items = getInventory();
    setInventory(items);
  };

  useEffect(() => {
    // Load initial inventory data from storage
    const items = getInventory();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInventory(items);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const item = {
      id: formData.id || Date.now().toString(),
      name: formData.name,
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity),
      description: formData.description
    };

    saveInventoryItem(item);
    loadInventory();
    setFormData({ id: '', name: '', price: '', quantity: '', description: '' });
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setFormData({
      id: item.id,
      name: item.name,
      price: item.price.toString(),
      quantity: item.quantity.toString(),
      description: item.description
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteInventoryItem(id);
      loadInventory();
    }
  };

  return (
    <div className="inventory-manager">
      <div className="inventory-header">
        <h2>Inventory Management</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

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
              />
            </div>
            <div className="form-group">
              <label>Price ($) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
            />
          </div>
          <button type="submit" className="btn-primary">
            {formData.id ? 'Update Item' : 'Add Item'}
          </button>
        </form>
      )}

      <div className="inventory-list">
        {inventory.length === 0 ? (
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
                  <td>${item.price.toFixed(2)}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <button onClick={() => handleEdit(item)} className="btn-small">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="btn-small btn-danger">
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
