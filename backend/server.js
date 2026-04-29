// --- REQUIRED DEPENDENCIES ---
// npm install express mongoose cors dotenv firebase-admin

require('dotenv').config(); // ✅ MUST BE FIRST

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- FIREBASE (still mock for now) ---------------- */
const verifyToken = async (req, res, next) => {
  req.user = {
    uid: "test-user-id",
    email: "test@gmail.com"
  };
  next();
};

/* ---------------- MONGODB CONNECTION ---------------- */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

/* ---------------- MONGOOSE MODELS ---------------- */

const UserSchema = new mongoose.Schema({
  firebaseUID: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  role: { type: String, default: 'user', enum: ['user', 'admin'] }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const ProductSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  category: String,
  image: String,
  stock: { type: Number, default: 0 }
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

const OrderSchema = new mongoose.Schema({
  userId: String,
  userEmail: String,
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number,
    quantity: Number
  }],
  totalAmount: Number,
  status: { type: String, default: 'Pending' }
}, { timestamps: true });

const Order = mongoose.model('Order', OrderSchema);

/* ---------------- ADMIN CHECK ---------------- */
const verifyAdmin = async (req, res, next) => {
  try {
    const user = await User.findOne({ firebaseUID: req.user.uid });

    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: 'Requires admin privileges' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- ROUTES ---------------- */

// USERS
app.post('/api/users', verifyToken, async (req, res) => {
  try {
    let user = await User.findOne({ firebaseUID: req.user.uid });

    if (!user) {
      user = new User({
        firebaseUID: req.user.uid,
        email: req.user.email,
        role: req.body.passcode === 'ADMIN123' ? 'admin' : 'user'
      });
      await user.save();
    } else if (req.body.passcode === 'ADMIN123') {
      user.role = 'admin';
      await user.save();
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PRODUCTS
app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post('/api/products', verifyToken, verifyAdmin, async (req, res) => {
  const product = new Product(req.body);
  await product.save();
  res.json(product);
});

app.put('/api/products/:id', verifyToken, verifyAdmin, async (req, res) => {
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

app.delete('/api/products/:id', verifyToken, verifyAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// ORDERS
app.post('/api/orders', verifyToken, async (req, res) => {
  const order = new Order({
    userId: req.user.uid,
    userEmail: req.user.email,
    ...req.body
  });

  await order.save();
  res.json(order);
});

app.get('/api/orders', verifyToken, async (req, res) => {
  const user = await User.findOne({ firebaseUID: req.user.uid });

  let orders;
  if (user?.role === 'admin') {
    orders = await Order.find().sort({ createdAt: -1 });
  } else {
    orders = await Order.find({ userId: req.user.uid });
  }

  res.json(orders);
});

app.put('/api/orders/:id', verifyToken, verifyAdmin, async (req, res) => {
  const updated = await Order.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true }
  );

  res.json(updated);
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});