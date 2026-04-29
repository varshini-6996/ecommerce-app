import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';
import { 
  ShoppingBag, User, Search, Check, Package, 
  Settings, Trash2, Edit2, Plus, ArrowLeft, Lock 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import axios from 'axios';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDwGJ9SAB9KGacB2MRxizuDmtULXiLKpBc",
  authDomain: "ecommerce-f52f1.firebaseapp.com",
  projectId: "ecommerce-f52f1",
  storageBucket: "ecommerce-f52f1.firebasestorage.app",
  messagingSenderId: "742852536500",
  appId: "1:742852536500:web:025fa8733b65923b570fe1"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// API Base URL (Point this to your server.js address locally, e.g., http://localhost:5000)
const API_BASE_URL = 'http://localhost:5000/api';

// Create an Axios instance for easy configuration
const api = axios.create({
  baseURL: API_BASE_URL
});

// --- APP CONTEXT (Global State) ---
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('eco_cart') || '[]'));
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Google Login Error:", err);
  }
};

  // Setup Axios Interceptor to add Auth Token to every request automatically
  useEffect(() => {
    const interceptor = api.interceptors.request.use(async (config) => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    }, (error) => Promise.reject(error));

    return () => api.interceptors.request.eject(interceptor);
  }, []);

  // Authentication & Sync with Backend User Record
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);

    if (currentUser) {
      try {
        const res = await api.post('/users');
        setUserData(res.data);
      } catch (err) {
        console.error("Error syncing user with backend", err);
      }
    } else {
      setUserData(null);
    }

    setIsAuthLoading(false);
  });

  return () => unsubscribe();
}, []);

  // Data Fetching (Products & Orders via REST API)
  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products", err);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    try {
      const res = await api.get('/orders');
      setOrders(res.data);
    } catch (err) {
      console.error("Error fetching orders", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  // Cart Persistence
  useEffect(() => {
    localStorage.setItem('eco_cart', JSON.stringify(cart));
  }, [cart]);

  // Actions
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item._id === product._id);
      if (existing) return prev.map(item => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item._id !== id));
  
  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item._id === id) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);

  return (
    <AppContext.Provider value={{
      user, userData, setUserData, isAuthLoading,
      products, orders, cart, addToCart, removeFromCart, updateQuantity, setCart, cartTotal,
      fetchProducts, fetchOrders,
      loginWithGoogle
    }}>
      {children}
    </AppContext.Provider>
  );
};

// --- COMPONENTS ---

const Navbar = ({ navigate, currentView, openCart }) => {
  const { userData, cart } = useContext(AppContext);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center cursor-pointer" onClick={() => navigate('catalog')}>
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center mr-3">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">CRAFTIFY.</span>
          </div>

          <div className="flex items-center space-x-6">
            <button onClick={openCart} className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ShoppingBag className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => navigate('dashboard')}
              className="flex items-center space-x-2 p-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <User className="w-6 h-6" />
              <span className="hidden md:block text-sm font-medium">
                {userData?.role === 'admin' ? 'Admin' : 'Account'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const ProductCatalog = ({ onProductClick }) => {
  const { products, addToCart } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 space-y-4 md:space-y-0">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Essentials</h1>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search products..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 outline-none text-sm"
          />
        </div>
      </div>

      <div className="flex overflow-x-auto space-x-2 mb-8 pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat 
                ? 'bg-slate-900 text-white' 
                : 'bg-white border border-gray-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 text-slate-500">No products found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map(product => (
            <div key={product._id} className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="relative aspect-square overflow-hidden bg-gray-50 cursor-pointer" onClick={() => onProductClick(product)}>
                <img 
                  src={product.image || 'https://via.placeholder.com/400?text=No+Image'} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5 flex flex-col flex-grow">
                <p className="text-xs font-semibold text-indigo-600 mb-1 uppercase tracking-wider">{product.category}</p>
                <h3 className="font-semibold text-slate-900 mb-2 truncate cursor-pointer" onClick={() => onProductClick(product)}>{product.name}</h3>
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-bold text-lg">₹{Number(product.price).toFixed(2)}</span>
                  <button 
                    onClick={() => addToCart(product)}
                    className="bg-slate-900 text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProductDetails = ({ product, onBack }) => {
  const { addToCart } = useContext(AppContext);
  if (!product) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button onClick={onBack} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Catalog
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 items-center">
        <div className="bg-gray-50 rounded-3xl overflow-hidden shadow-sm border border-gray-100">
          <img src={product.image} alt={product.name} className="w-full h-auto object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-indigo-600 mb-2 uppercase tracking-wider">{product.category}</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">{product.name}</h1>
          <p className="text-3xl font-light text-slate-900 mb-6">₹{Number(product.price).toFixed(2)}</p>
          <p className="text-slate-600 text-lg leading-relaxed mb-8">{product.description}</p>
          
          <button 
            onClick={() => addToCart(product)}
            disabled={product.stock <= 0}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>{product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const CartSidebar = ({ isOpen, onClose, navigate }) => {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useContext(AppContext);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="p-6 flex justify-between items-center border-b border-gray-100">
          <h2 className="text-xl font-bold text-slate-900">Your Cart</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full bg-gray-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cart.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center">
              <ShoppingBag className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-500">Your cart is empty.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item._id} className="flex space-x-4">
                <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-xl bg-gray-50" />
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <h3 className="font-semibold text-slate-900 line-clamp-1">{item.name}</h3>
                    <button onClick={() => removeFromCart(item._id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-slate-500 text-sm mb-3">₹{Number(item.price).toFixed(2)}</p>
                  <div className="flex items-center space-x-3">
                    <button onClick={() => updateQuantity(item._id, -1)} className="w-7 h-7 rounded-md border border-gray-200">-</button>
                    <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item._id, 1)} className="w-7 h-7 rounded-md border border-gray-200">+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 border-t border-gray-100 bg-gray-50">
            <div className="flex justify-between text-lg font-bold text-slate-900 mb-6">
              <span>Subtotal</span>
              <span>₹{cartTotal.toFixed(2)}</span>
            </div>
            <button 
              onClick={() => { onClose(); navigate('checkout'); }}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Checkout = ({ navigate }) => {
  const { cart, cartTotal, setCart, user, fetchOrders } = useContext(AppContext);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please log in to checkout");
    
    setIsProcessing(true);
    try {
      const orderData = {
        items: cart.map(item => ({
          productId: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalAmount: cartTotal
      };
      
      await api.post('/orders', orderData);
      setCart([]);
      await fetchOrders();
      alert("Order placed successfully!");
      navigate('dashboard');
    } catch (err) {
      console.error(err);
      alert("Error placing order. Ensure backend is running.");
    }
    setIsProcessing(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">Checkout</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8 space-y-4">
          {cart.map(item => (
            <div key={item._id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center space-x-4">
                <span className="font-medium text-slate-500">{item.quantity}x</span>
                <span className="font-semibold text-slate-900">{item.name}</span>
              </div>
              <span className="text-slate-600">₹{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="pt-4 flex justify-between items-center text-xl font-bold border-t border-gray-100">
            <span>Total</span>
            <span>₹{cartTotal.toFixed(2)}</span>
          </div>
        </div>
        <button 
          onClick={handleCheckout} 
          disabled={isProcessing}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : `Pay ₹{cartTotal.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

const UserDashboard = ({ navigate }) => {
  const { user, userData, orders, setUserData } = useContext(AppContext);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [passcode, setPasscode] = useState('');
  const { loginWithGoogle } = useContext(AppContext);

if (!user) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-3xl shadow-xl p-8 text-center">

        {/* Logo / Brand */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center mr-2">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">CRAFTIFY</span>
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Welcome back
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Sign in to continue shopping
        </p>

        {/* Google Button */}
        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all"
        >
          {/* Google Icon */}
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.2 3.6l6.85-6.85C35.92 2.55 30.35 0 24 0 14.63 0 6.44 5.48 2.56 13.44l7.98 6.2C12.64 13.12 17.82 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24c0-1.64-.15-3.2-.42-4.7H24v9h12.7c-.55 2.96-2.22 5.48-4.74 7.18l7.34 5.7C43.98 37.18 46.5 31.12 46.5 24z"/>
            <path fill="#FBBC05" d="M10.54 28.64A14.5 14.5 0 019.5 24c0-1.61.28-3.16.78-4.64l-7.98-6.2A23.93 23.93 0 000 24c0 3.84.92 7.47 2.56 10.56l7.98-6.2z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.92-2.13 15.9-5.8l-7.34-5.7c-2.04 1.37-4.65 2.18-8.56 2.18-6.18 0-11.36-3.62-13.46-8.86l-7.98 6.2C6.44 42.52 14.63 48 24 48z"/>
          </svg>

          Continue with Google
        </button>

        {/* Optional subtle note */}
        <p className="text-xs text-slate-400 mt-6">
          We only use your Google account for authentication.
        </p>
      </div>
    </div>
  );
}

  const handleAdminUpgrade = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users', { passcode });
      setUserData(res.data);
      setIsAdminLogin(false);
    } catch (err) {
      alert("Invalid passcode for Admin access.");
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Shipped': return 'bg-blue-100 text-blue-700';
      case 'Delivered': return 'bg-green-100 text-green-700';
      default: return 'bg-orange-100 text-orange-700';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Account</h1>
          <p className="text-slate-500 mt-1">{userData?.email}</p>
        </div>
        <div>
          {userData?.role === 'admin' ? (
            <button onClick={() => navigate('admin')} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Settings className="w-4 h-4 mr-2" /> Admin Panel
            </button>
          ) : (
            <button onClick={() => setIsAdminLogin(true)} className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
              <Lock className="w-4 h-4 mr-2" /> Admin Access
            </button>
          )}
        </div>
      </div>

      {isAdminLogin && (
        <div className="mb-10 bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
          <h3 className="font-semibold text-indigo-900 mb-2">Reviewer Access</h3>
          <form onSubmit={handleAdminUpgrade} className="flex space-x-3">
            <input 
              type="password" placeholder="Passcode (ADMIN123)" value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border border-indigo-200 outline-none"
            />
            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl">Unlock</button>
          </form>
        </div>
      )}

      <h2 className="text-xl font-bold text-slate-900 mb-6">Order History</h2>
      <div className="space-y-6">
        {orders.length === 0 ? (
          <p className="text-slate-500">No orders found.</p>
        ) : (
          orders.map(order => (
            <div key={order._id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-4">
                <span className="text-sm font-mono text-slate-400">Order #{order._id.slice(-6)}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span>{item.quantity}x {item.name}</span>
                  <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between font-bold">
                <span>Total</span>
                <span>₹{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AdminDashboard = ({ navigate }) => {
  const { products, orders, fetchProducts, fetchOrders } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('products');
  const [editingProduct, setEditingProduct] = useState(null);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}`, { status: newStatus });
      await fetchOrders();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleDeleteProduct = async (id) => {
    if (confirm("Delete this product?")) {
      try {
        await api.delete(`/products/${id}`);
        await fetchProducts();
      } catch (err) { alert("Delete failed"); }
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productData = Object.fromEntries(formData);
    productData.price = parseFloat(productData.price);
    productData.stock = parseInt(productData.stock);

    try {
      if (editingProduct._id) {
        await api.put(`/products/${editingProduct._id}`, productData);
      } else {
        await api.post('/products', productData);
      }
      await fetchProducts();
      setEditingProduct(null);
    } catch (err) { alert("Save failed"); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center mb-8">
        <button onClick={() => navigate('dashboard')} className="mr-4 p-2 bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
      </div>

      <div className="flex space-x-4 border-b mb-8">
        <button onClick={() => setActiveTab('products')} className={`pb-4 px-2 ${activeTab === 'products' ? 'border-b-2 border-indigo-600' : ''}`}>Products</button>
        <button onClick={() => setActiveTab('orders')} className={`pb-4 px-2 ${activeTab === 'orders' ? 'border-b-2 border-indigo-600' : ''}`}>Orders</button>
      </div>

      {activeTab === 'products' && (
        <>
          <button onClick={() => setEditingProduct({})} className="mb-6 bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center">
            <Plus className="w-4 h-4 mr-2" /> New Product
          </button>
          {editingProduct && (
            <form onSubmit={handleSaveProduct} className="bg-gray-50 p-6 rounded-2xl mb-8 grid grid-cols-2 gap-4 shadow-inner">
              <input name="name" defaultValue={editingProduct.name} placeholder="Name" required className="p-2 border rounded" />
              <input name="price" type="number" step="0.01" defaultValue={editingProduct.price} placeholder="Price" required className="p-2 border rounded" />
              <input name="category" defaultValue={editingProduct.category} placeholder="Category" required className="p-2 border rounded" />
              <input name="stock" type="number" defaultValue={editingProduct.stock} placeholder="Stock" required className="p-2 border rounded" />
              <input name="image" defaultValue={editingProduct.image} placeholder="Image URL" className="p-2 border rounded col-span-2" />
              <textarea name="description" defaultValue={editingProduct.description} placeholder="Description" className="p-2 border rounded col-span-2" />
              <div className="col-span-2 flex space-x-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">Save</button>
                <button type="button" onClick={() => setEditingProduct(null)} className="px-4 py-2 bg-white border rounded">Cancel</button>
              </div>
            </form>
          )}
          <div className="grid gap-4">
            {products.map(p => (
              <div key={p._id} className="bg-white p-4 border rounded-xl flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <img src={p.image} className="w-12 h-12 object-cover rounded" />
                  <div>
                    <h3 className="font-bold">{p.name}</h3>
                    <p className="text-xs text-slate-500">₹{p.price} • Stock: {p.stock}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => setEditingProduct(p)} className="p-2 text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteProduct(p._id)} className="p-2 text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order._id} className="bg-white p-6 border rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-xs font-mono">#{order._id}</p>
                <p className="font-bold">{order.userEmail}</p>
                <p className="text-sm text-slate-500">₹{order.totalAmount}</p>
              </div>
              <select 
                value={order.status} 
                onChange={(e) => handleUpdateStatus(order._id, e.target.value)}
                className="p-2 border rounded-lg text-sm font-bold"
              >
                <option value="Pending">Pending</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const navigate = (view) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AppProvider>
      <div className="min-h-screen bg-white">
        <Navbar navigate={navigate} currentView={currentView} openCart={() => setIsCartOpen(true)} />
        <main className="pb-24">
          {currentView === 'catalog' && <ProductCatalog onProductClick={(p) => { setSelectedProduct(p); navigate('details'); }} />}
          {currentView === 'details' && <ProductDetails product={selectedProduct} onBack={() => navigate('catalog')} />}
          {currentView === 'checkout' && <Checkout navigate={navigate} />}
          {currentView === 'dashboard' && <UserDashboard navigate={navigate} />}
          {currentView === 'admin' && <AdminDashboard navigate={navigate} />}
        </main>
        <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} navigate={(v) => { setIsCartOpen(false); navigate(v); }} />
      </div>
    </AppProvider>
  );
}

const X = ({ className }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>;