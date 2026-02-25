import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

// Helper to get backend URL for images
const getBackendUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:5000`;
};

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderPhoto, setOrderPhoto] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showZelleQR, setShowZelleQR] = useState(false);
  const [zelleQRCode, setZelleQRCode] = useState('');
  const [qrCodeError, setQrCodeError] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderHistory, setOrderHistory] = useState([]);

  useEffect(() => {
    loadProducts();
    loadOrderHistory();
  }, []);

  // Debug: Log when showZelleQR changes
  useEffect(() => {
    console.log('showZelleQR state changed:', showZelleQR);
    console.log('showCamera state:', showCamera);
    console.log('showCheckout state:', showCheckout);
    console.log('orderPhoto:', orderPhoto ? 'exists' : 'null');
  }, [showZelleQR, showCamera, showCheckout, orderPhoto]);

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

  const loadOrderHistory = async () => {
    try {
      const response = await api.get('/orders');
      setOrderHistory(response.data.orders || []);
    } catch (error) {
      console.error('Error loading order history:', error);
    }
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product_id: product.id, product_name: product.name, price: product.price, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.product_id === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }
    setOrderTotal(getCartTotal());
    setShowCheckout(true);
    
    // Check if we're on localhost (camera works with HTTP on localhost)
    // Or if we're on HTTPS (camera works with HTTPS)
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    const isHTTPS = window.location.protocol === 'https:';
    
    if (isLocalhost || isHTTPS) {
      // Camera access works on localhost (HTTP) or HTTPS
      setShowCamera(true);
    } else {
      // On network IP with HTTP - show file upload option directly
      setShowCamera(false);
      // Show file input directly
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.capture = 'environment';
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          setOrderPhoto(file);
          // Use setTimeout to ensure state updates complete before showing QR modal
          setTimeout(() => {
            showZelleQRCode();
          }, 100);
        }
      };
      fileInput.click();
    }
  };

  const capturePhoto = () => {
    const video = document.getElementById('camera-video');
    if (!video || !video.videoWidth || !video.videoHeight) {
      alert('Camera not ready. Please wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Failed to capture photo. Please try again.');
        return;
      }
      console.log('Photo captured, blob size:', blob.size);
      // Stop camera first
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
      // Set photo and close camera, then show QR code
      setOrderPhoto(blob);
      setShowCamera(false);
      // Use setTimeout to ensure state updates complete before showing QR modal
      setTimeout(() => {
        console.log('Calling showZelleQRCode after capture');
        showZelleQRCode();
      }, 150);
    }, 'image/jpeg', 0.9);
  };

  const showZelleQRCode = () => {
    // Zelle QR code should be placed in frontend/public/zelle-qr.png or zelle-qr.jpg
    // Or you can configure it via environment variable
    // Default to .jpg first since that's what exists, then fallback to .png
    const qrCodePath = import.meta.env.VITE_ZELLE_QR_CODE || '/zelle-qr.jpg';
    console.log('Showing Zelle QR Code:', qrCodePath);
    setZelleQRCode(qrCodePath);
    setQrCodeError(false);
    setShowCheckout(true); // Ensure checkout stays open
    setShowCamera(false); // Ensure camera is closed
    setShowZelleQR(true);
    console.log('showZelleQR set to true');
  };

  useEffect(() => {
    if (showCamera) {
      // Check if mediaDevices is available
      // Camera access works on localhost (HTTP) or HTTPS
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.protocol === 'https:';
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isLocalhost && window.location.protocol !== 'https:') {
          alert('Camera access requires HTTPS or localhost. Please access via localhost or enable HTTPS.');
          setShowCamera(false);
          return;
        }
        // If on localhost, try anyway - it might work
      }

      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          const video = document.getElementById('camera-video');
          if (video) {
            video.srcObject = stream;
            video.play();
          }
        })
        .catch(err => {
          console.error('Error accessing camera:', err);
          let errorMessage = 'Could not access camera. ';
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage += 'Please grant camera permissions and try again.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage += 'No camera found on this device.';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage += 'Camera is already in use by another application.';
          } else {
            errorMessage += 'Please ensure camera permissions are granted.';
          }
          alert(errorMessage);
          setShowCamera(false);
        });
    } else {
      // Clean up camera stream when closing
      const video = document.getElementById('camera-video');
      if (video && video.srcObject) {
        const stream = video.srcObject;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    }

    // Cleanup function
    return () => {
      if (!showCamera) {
        const video = document.getElementById('camera-video');
        if (video && video.srcObject) {
          const stream = video.srcObject;
          stream.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }
      }
    };
  }, [showCamera]);

  const handleOrderSubmit = async () => {
    if (!orderPhoto) {
      alert('Please take a photo of the items');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('photo', orderPhoto, 'order-photo.jpg');
      formData.append('items', JSON.stringify(cart));
      formData.append('zelle_qr_code', zelleQRCode);
      formData.append('notes', `Order placed by ${user.full_name}`);

      await api.post('/orders', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Order placed successfully! Please complete payment via Zelle.');
      setCart([]);
      setShowCheckout(false);
      setShowCamera(false);
      setShowZelleQR(false);
      setOrderPhoto(null);
      loadOrderHistory();
    } catch (error) {
      console.error('Error placing order:', error);
      alert(error.response?.data?.error || 'Failed to place order');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-neutral-200">Loading products...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 md:gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-neutral-100">Products</h1>
        {cart.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="bg-primary text-white px-4 py-2 rounded-lg text-sm md:text-base text-center sm:text-left">
              Cart: {cart.length} item{cart.length !== 1 ? 's' : ''} - ${getCartTotal().toFixed(2)}
            </div>
            <button
              onClick={handleCheckout}
              className="px-6 py-2 bg-success text-white rounded-lg hover:bg-green-600 transition font-medium text-sm md:text-base"
            >
              Checkout
            </button>
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {products.map(product => {
          const cartItem = cart.find(item => item.product_id === product.id);
          return (
            <div key={product.id} className="bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-neutral-800">
              {product.image_url && (
                <img
                  src={`${getBackendUrl()}${product.image_url}`}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-neutral-100 mb-2">{product.name}</h3>
                {product.description && (
                  <p className="text-gray-600 dark:text-neutral-200 text-sm mb-3">{product.description}</p>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">${parseFloat(product.price).toFixed(2)}</span>
                  {cartItem ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                        className="px-3 py-1 bg-gray-200 dark:bg-neutral-700 rounded hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-800 dark:text-neutral-100"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 bg-primary text-white rounded font-medium">
                        {cartItem.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                        className="px-3 py-1 bg-gray-200 dark:bg-neutral-700 rounded hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-800 dark:text-neutral-100"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(product)}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shopping Cart Sidebar */}
      {cart.length > 0 && !showCheckout && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-neutral-900 shadow-2xl border-l border-gray-200 dark:border-neutral-800 z-50 p-6 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-neutral-100">Shopping Cart</h2>
          <div className="space-y-4 mb-4">
            {cart.map(item => (
              <div key={item.product_id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-neutral-800 rounded">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-neutral-100">{item.product_name}</p>
                  <p className="text-sm text-gray-600 dark:text-neutral-200">${item.price.toFixed(2)} x {item.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600">${(item.price * item.quantity).toFixed(2)}</span>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="text-danger hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-neutral-700 pt-4">
            <div className="flex justify-between text-xl font-bold mb-4 text-gray-900 dark:text-neutral-100">
              <span>Total:</span>
              <span className="text-green-600 dark:text-green-400">${getCartTotal().toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full px-4 py-3 bg-success text-white rounded-lg hover:bg-green-600 transition font-medium"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-transparent dark:border-neutral-800 p-4 md:p-6 max-w-2xl w-full mx-2 md:mx-4">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-gray-900 dark:text-neutral-100">Take Photo of Items</h2>
            {navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? (
              <>
                <video
                  id="camera-video"
                  autoPlay
                  playsInline
                  className="w-full rounded-lg mb-4 bg-gray-900"
                  style={{ maxHeight: '60vh', minHeight: '300px' }}
                />
                <div className="flex gap-4">
                  <button
                    onClick={capturePhoto}
                    className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition font-medium"
                  >
                    Capture Photo
                  </button>
                  <label className="px-6 py-3 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-600 transition font-medium cursor-pointer">
                    Upload Instead
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          console.log('File selected from camera modal:', file.name);
                          // Stop camera first
                          const video = document.getElementById('camera-video');
                          if (video && video.srcObject) {
                            video.srcObject.getTracks().forEach(track => track.stop());
                            video.srcObject = null;
                          }
                          // Set photo and close camera, then show QR code
                          setOrderPhoto(file);
                          setShowCamera(false);
                          // Use setTimeout to ensure state updates complete before showing QR modal
                          await new Promise(resolve => setTimeout(resolve, 150));
                          showZelleQRCode();
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => {
                      setShowCamera(false);
                      setShowCheckout(false);
                      const video = document.getElementById('camera-video');
                      if (video && video.srcObject) {
                        video.srcObject.getTracks().forEach(track => track.stop());
                        video.srcObject = null;
                      }
                    }}
                    className="px-6 py-3 bg-gray-300 dark:bg-neutral-600 text-gray-700 dark:text-neutral-200 rounded-lg hover:bg-gray-400 dark:hover:bg-neutral-500 transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-red-600 dark:text-red-400 mb-4">
                  Camera access is not available. Please ensure you're using HTTPS or localhost.
                </p>
                <p className="text-gray-600 dark:text-neutral-200 mb-4">
                  You can still place an order by uploading a photo manually.
                </p>
                <div className="flex gap-4">
                  <label className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition font-medium cursor-pointer text-center">
                    Upload Photo Instead
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          console.log('File selected (no camera):', file.name);
                          setOrderPhoto(file);
                          setShowCamera(false);
                          // Use setTimeout to ensure state updates complete before showing QR modal
                          setTimeout(() => {
                            console.log('Calling showZelleQRCode after file upload (no camera)');
                            showZelleQRCode();
                          }, 150);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => {
                      setShowCamera(false);
                      setShowCheckout(false);
                    }}
                    className="px-6 py-3 bg-gray-300 dark:bg-neutral-600 text-gray-700 dark:text-neutral-200 rounded-lg hover:bg-gray-400 dark:hover:bg-neutral-500 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zelle QR Code Modal */}
      {showZelleQR && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-2 md:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-transparent dark:border-neutral-800 p-4 md:p-6 max-w-lg w-full mx-2 md:mx-4 text-center my-auto">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-gray-900 dark:text-neutral-100">Complete Payment</h2>
            <p className="text-base md:text-lg font-semibold mb-2 text-gray-900 dark:text-neutral-100">Total: <span className="text-green-600 dark:text-green-400">${orderTotal.toFixed(2)}</span></p>
            <p className="text-sm md:text-base text-gray-600 dark:text-neutral-200 mb-4">Scan the QR code below to send payment via Zelle</p>
            {zelleQRCode && !qrCodeError ? (
              <div className="flex justify-center mb-4">
                <img
                  src={zelleQRCode}
                  alt="Zelle QR Code"
                  className="w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 mx-auto border-4 border-gray-300 dark:border-neutral-600 rounded-lg object-contain bg-white dark:bg-neutral-800 shadow-lg"
                  style={{ minWidth: '288px', minHeight: '288px' }}
                  onError={() => {
                    setQrCodeError(true);
                  }}
                  onLoad={() => {
                    setQrCodeError(false);
                  }}
                />
              </div>
            ) : (
              <div className="w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 mx-auto mb-4 border-4 border-gray-300 dark:border-neutral-600 rounded-lg flex flex-col items-center justify-center bg-gray-100 dark:bg-neutral-800 p-4" style={{ minWidth: '288px', minHeight: '288px' }}>
                <p className="text-gray-500 dark:text-neutral-300 text-sm font-medium">Zelle QR Code</p>
                <p className="text-xs text-gray-400 dark:text-neutral-400 mt-2 text-center">
                  {qrCodeError 
                    ? `Image not found at ${zelleQRCode}. Please check the file exists.`
                    : 'Place your QR code image at /public/zelle-qr.png or /public/zelle-qr.jpg'
                  }
                </p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
              <button
                onClick={handleOrderSubmit}
                className="flex-1 px-6 py-3 bg-success text-white rounded-lg hover:bg-green-600 transition font-medium"
              >
                I've Sent Payment
              </button>
              <button
                onClick={() => {
                  setShowZelleQR(false);
                  setShowCheckout(false);
                  setOrderPhoto(null);
                }}
                className="px-6 py-3 bg-gray-300 dark:bg-neutral-600 text-gray-700 dark:text-neutral-200 rounded-lg hover:bg-gray-400 dark:hover:bg-neutral-500 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order History */}
      {orderHistory.length > 0 && (
        <div className="mt-6 md:mt-8">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-900 dark:text-neutral-100">Order History</h2>
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-transparent dark:border-neutral-800 overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-neutral-200">Order #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-neutral-200">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-neutral-200">Items</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-neutral-200">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-neutral-200">Status</th>
                </tr>
              </thead>
              <tbody>
                {orderHistory.map(order => (
                  <tr key={order.id} className="border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="px-4 py-3 text-gray-900 dark:text-neutral-100">#{order.id}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-neutral-100">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-neutral-100">{order.item_count} item{order.item_count !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">${parseFloat(order.total_amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        order.status === 'paid' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' :
                        order.status === 'fulfilled' ? 'bg-primary-subtle dark:bg-primary/20 text-primary' :
                        order.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300' :
                        'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;

