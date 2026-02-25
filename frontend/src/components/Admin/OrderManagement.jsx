import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [products, setProducts] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadOrders();
    loadProducts();
  }, [filterStatus, searchTerm]);

  const loadProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await api.get('/orders');
      let allOrders = response.data.orders || [];
      
      // Filter by status
      if (filterStatus !== 'all') {
        allOrders = allOrders.filter(order => order.status === filterStatus);
      }
      
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        allOrders = allOrders.filter(order => 
          order.user_name?.toLowerCase().includes(term) ||
          order.id.toString().includes(term) ||
          order.total_amount.toString().includes(term)
        );
      }
      
      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetails = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data.order);
      setIsEditing(false);
    } catch (error) {
      console.error('Error loading order details:', error);
      alert('Failed to load order details');
    }
  };

  const startEdit = () => {
    if (!selectedOrder) return;
    setEditData({
      items: selectedOrder.items ? selectedOrder.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      })) : [],
      notes: selectedOrder.notes || '',
      status: selectedOrder.status,
      total_amount: selectedOrder.total_amount
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      await api.put(`/orders/${selectedOrder.id}`, editData);
      await loadOrderDetails(selectedOrder.id);
      await loadOrders();
      setIsEditing(false);
      alert('Order updated successfully');
    } catch (error) {
      console.error('Error updating order:', error);
      alert(error.response?.data?.error || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    if (!confirm(`Are you sure you want to delete Order #${selectedOrder.id}? This action cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/orders/${selectedOrder.id}`);
      setSelectedOrder(null);
      await loadOrders();
      alert('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting order:', error);
      alert(error.response?.data?.error || 'Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  const addOrderItem = () => {
    setEditData({
      ...editData,
      items: [...(editData.items || []), { product_id: '', quantity: 1, price: 0 }]
    });
  };

  const removeOrderItem = (index) => {
    const newItems = [...(editData.items || [])];
    newItems.splice(index, 1);
    setEditData({ ...editData, items: newItems });
  };

  const updateOrderItem = (index, field, value) => {
    const newItems = [...(editData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // If product_id changed, update price from product
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        newItems[index].price = product.price;
      }
    }
    
    // Recalculate total
    const total = newItems.reduce((sum, item) => {
      return sum + (parseFloat(item.price || 0) * parseInt(item.quantity || 1));
    }, 0);
    
    setEditData({ ...editData, items: newItems, total_amount: total });
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        loadOrderDetails(orderId);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 md:gap-4">
        <h2 className="text-xl md:text-2xl font-semibold">Order Management</h2>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-4 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base w-full sm:w-auto"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base w-full sm:w-auto"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending Payment</option>
            <option value="paid">Paid</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md dark:shadow-neutral-950/50 dark:border dark:border-neutral-700 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Order #</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Customer</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Items</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Total</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <tr
                  key={order.id}
                  className="border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
                  onClick={() => loadOrderDetails(order.id)}
                >
                  <td className="px-4 py-3 font-semibold">#{order.id}</td>
                  <td className="px-4 py-3">{order.user_name}</td>
                  <td className="px-4 py-3">{formatDateTime(order.created_at)}</td>
                  <td className="px-4 py-3">{order.item_count} item{order.item_count !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">${parseFloat(order.total_amount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-sm ${
                      order.status === 'paid' ? 'bg-green-100 text-green-800' :
                      order.status === 'fulfilled' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="fulfilled">Fulfilled</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg dark:border dark:border-neutral-700 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">Order #{selectedOrder.id}</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-semibold">{selectedOrder.user_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Date</p>
                <p className="font-semibold">{formatDateTime(selectedOrder.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="font-semibold text-lg text-green-600">${parseFloat(selectedOrder.total_amount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`px-2 py-1 rounded text-sm inline-block ${
                  selectedOrder.status === 'paid' ? 'bg-green-100 text-green-800' :
                  selectedOrder.status === 'fulfilled' ? 'bg-blue-100 text-blue-800' :
                  selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {selectedOrder.status}
                </span>
              </div>
            </div>

            {selectedOrder.photo_url && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Order Photo</p>
                <img
                  src={`${window.location.protocol}//${window.location.hostname}:5000${selectedOrder.photo_url}`}
                  alt="Order items"
                  className="max-w-full h-auto rounded-lg border border-gray-300"
                />
              </div>
            )}

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Order Items</p>
              <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4">
                {selectedOrder.items && selectedOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between py-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity} × ${parseFloat(item.price).toFixed(2)}</p>
                    </div>
                    <p className="font-semibold">${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                <p className="text-gray-600">{selectedOrder.notes}</p>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Items</label>
                  <div className="space-y-2">
                    {(editData.items || []).map((item, index) => (
                      <div key={index} className="flex gap-2 items-center p-2 bg-gray-50 dark:bg-neutral-800 rounded">
                        <select
                          value={item.product_id || ''}
                          onChange={(e) => updateOrderItem(index, 'product_id', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">Select Product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} - ${parseFloat(p.price).toFixed(2)}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity || 1}
                          onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Qty"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price || 0}
                          onChange={(e) => updateOrderItem(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Price"
                        />
                        <span className="text-sm font-semibold w-20 text-right">
                          ${((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeOrderItem(index)}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addOrderItem}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                  >
                    + Add Item
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={editData.notes || ''}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={editData.status || 'pending'}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="fulfilled">Fulfilled</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.total_amount || 0}
                      onChange={(e) => setEditData({ ...editData, total_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || (editData.items || []).length === 0}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-300 dark:bg-neutral-600 text-gray-700 dark:text-neutral-200 rounded-lg hover:bg-gray-400 dark:hover:bg-neutral-500 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-4 flex-wrap">
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button
                    onClick={startEdit}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  >
                    Edit Order
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Order'}
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 bg-gray-300 dark:bg-neutral-600 text-gray-700 dark:text-neutral-200 rounded-lg hover:bg-gray-400 dark:hover:bg-neutral-500 transition"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;

