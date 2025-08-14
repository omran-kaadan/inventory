// index.js
import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();
const { Pool } = pkg;
const app = express();

// Middleware
app.use(cors({
  origin: "*", // for dev; replace with CodeSandbox URL if needed
  methods: ["GET","POST","PUT","DELETE"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.use(express.json());

// PostgreSQL Pool
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT
});

// Test DB connection
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ DB connection error:", err));

// JWT Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer token
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ---------------- AUTH ROUTES ----------------

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [username, hashedPassword]
    );
    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: "User not found" });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ---------------- VENDORS ROUTES ----------------

// Get all vendors
app.get('/api/vendors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching vendors" });
  }
});

// Add a vendor
app.post('/api/vendors', authenticate, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Vendor name required" });
  try {
    await pool.query('INSERT INTO vendors (name) VALUES ($1)', [name]);
    res.json({ message: "Vendor added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error adding vendor" });
  }
});

// ---------------- PRODUCTS ROUTES ----------------

// Get all products with vendor info
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, v.name AS vendor_name 
       FROM products p 
       JOIN vendors v ON p.vendor_id = v.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching products" });
  }
});

// Add product
app.post('/api/products', authenticate, async (req, res) => {
  const { vendor_id, name, category, quantity, price, contains, box } = req.body;
  if (!vendor_id || !name || !quantity || !price || !contains || !box) {
    return res.status(400).json({ error: "Missing product fields" });
  }
  try {
    await pool.query(
      `INSERT INTO products (vendor_id, name, category, quantity, price, contains, box)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [vendor_id, name, category, quantity, price, contains, box]
    );
    res.json({ message: "Product added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error adding product" });
  }
});

// Update product
app.put('/api/products/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { vendor_id, name, category, quantity, price, contains, box } = req.body;
  try {
    await pool.query(
      `UPDATE products 
       SET vendor_id=$1, name=$2, category=$3, quantity=$4, price=$5, contains=$6, box=$7 
       WHERE id=$8`,
      [vendor_id, name, category, quantity, price, contains, box, id]
    );
    res.json({ message: "Product updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating product" });
  }
});

// Delete product
app.delete('/api/products/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [id]);
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting product" });
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
