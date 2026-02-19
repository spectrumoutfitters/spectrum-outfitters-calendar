import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import PartsLookup from '../Turn14/PartsLookup';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'turn14'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    is_active: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('price', formData.price);
      formDataToSend.append('is_active', formData.is_active);
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/products', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setShowAddModal(false);
      setEditingProduct(null);
      setFormData({ name: '', description: '', price: '', is_active: true });
      setImageFile(null);
      setImagePreview(null);
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert(error.response?.data?.error || 'Failed to save product');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price,
      is_active: product.is_active === 1
    });
    setImagePreview(product.image_url ? `${window.location.protocol}//${window.location.hostname}:5000${product.image_url}` : null);
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Product Management</h2>
        {activeTab === 'products' && (
          <button
            onClick={() => {
              setEditingProduct(null);
              setFormData({ name: '', description: '', price: '', is_active: true });
              setImageFile(null);
              setImagePreview(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Add Product
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'products'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          My Products
        </button>
        <button
          onClick={() => setActiveTab('turn14')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'turn14'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          🔍 Turn14 Parts Lookup
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'turn14' ? (
        <PartsLookup 
          onPartSelect={(part) => {
            // When a part is selected, pre-fill the add product form
            setFormData({
              name: part.name || part.description || part.title || '',
              description: part.description || part.name || '',
              price: part.price || part.pricing?.amount || part.pricing?.value || '0',
              is_active: true
            });
            setActiveTab('products');
            setShowAddModal(true);
          }}
          showOrderButton={true}
        />
      ) : (
        <>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {products.map(product => (
          <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            {product.image_url && (
              <img
                src={`${window.location.protocol}//${window.location.hostname}:5000${product.image_url}`}
                alt={product.name}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-semibold text-gray-800">{product.name}</h3>
                <span className={`px-2 py-1 rounded text-xs ${
                  product.is_active === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {product.is_active === 1 ? 'Active' : 'Inactive'}
                </span>
              </div>
              {product.description && (
                <p className="text-gray-600 text-sm mb-3">{product.description}</p>
              )}
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-green-600">${parseFloat(product.price).toFixed(2)}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(product)}
                    className="px-3 py-1 bg-primary text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="px-3 py-1 bg-danger text-white rounded hover:bg-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Product is active (visible to employees)
                </label>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-success text-white rounded-lg hover:bg-green-600 transition"
                >
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                    setFormData({ name: '', description: '', price: '', is_active: true });
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default ProductManagement;

