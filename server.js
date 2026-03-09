const express = require("express");
const cors = require("cors"); 
require("dotenv").config();
const db = require("./config/db");

// 1. IMPORT MIDDLEWARE & ROUTES
const auth = require("./middleware/authMiddleware"); 
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");

const app = express();

// 2. DATABASE VERIFICATION
db.getConnection()
  .then((connection) => {
    console.log("✅ TiDB Connected successfully!");
    connection.release();
  })
  .catch((err) => console.error("❌ TiDB Connection failed:", err.message));

// 3. GLOBAL MIDDLEWARE
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "https://chocolicious-frontend.vercel.app", 
    "https://www.chocolicious.in",
    "https://chocolicious.in"
  ], 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// 4. ADMIN SECURITY MIDDLEWARE
const isAdmin = (req, res, next) => {
  console.log("Checking Admin Status for User:", req.user); 
  if (req.user && (req.user.is_admin == 1 || req.user.is_admin === true)) {
    next();
  } else {
    console.log("⛔ Access Denied: User is not an admin or req.user is missing.");
    res.status(403).json({ success: false, message: "Access Denied: Admins Only" });
  }
};

// 5. BASE ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes); 
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);

// --- GENERAL PRODUCT ROUTES ---
app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
});

// --- ADMIN DASHBOARD ROUTES ---

// Fetch All Orders
app.get("/api/admin/orders", auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM orders ORDER BY order_id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error fetching orders" });
  }
});

// Update Order Status (Baking, Delivered, etc.)
app.put("/api/admin/orders/status", auth, isAdmin, async (req, res) => {
  const { order_id, order_status } = req.body;
  try {
    const query = "UPDATE orders SET order_status = ? WHERE order_id = ?";
    const [result] = await db.query(query, [order_status, order_id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true, message: "Status updated!" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

// Confirm Payment & Complete Order
app.post("/api/admin/payments/confirm", auth, isAdmin, async (req, res) => {
  const { order_id, payment_mode } = req.body;
  const payment_status = "Completed";
  try {
    // Record in payment table
    await db.query(
      "INSERT INTO payment (order_id, payment_mode, payment_status, payment_date) VALUES (?, ?, ?, NOW())",
      [order_id, payment_mode, payment_status]
    );
    // Update main order record
    const updateOrdersSql = `
      UPDATE orders 
      SET order_status = 'Delivered', payment_status = 'Completed', payment_mode = ? 
      WHERE order_id = ?
    `;
    await db.query(updateOrdersSql, [payment_mode, order_id]);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INVENTORY MANAGEMENT ---

// View Inventory
app.get("/api/admin/inventory", auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM inventory");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// Add Inventory Item
app.post("/api/admin/inventory/add", auth, isAdmin, async (req, res) => {
  const { item_name, category, quantity, unit } = req.body;
  try {
    const query = "INSERT INTO inventory (item_name, category, quantity, unit) VALUES (?, ?, ?, ?)";
    await db.query(query, [item_name, category, quantity, unit]);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Inventory Item
app.delete("/api/admin/inventory/delete/:id", auth, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query("DELETE FROM inventory WHERE item_id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Inventory item deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

