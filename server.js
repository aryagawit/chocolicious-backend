const express = require("express");
const cors = require("cors"); 
require("dotenv").config();
const db = require("./config/db");
const jwt = require("jsonwebtoken");

// 1. IMPORT MIDDLEWARE & ROUTES
const auth = require("./middleware/authMiddleware"); 
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");

// 2. DATABASE CONFIGURATION (TiDB Optimized)

// Verify connection on startup
// Verify connection on startup
db.getConnection()
  .then((connection) => {
    console.log("✅ MySQL Connected successfully!");
    connection.release();
  })
  .catch((err) => console.error("❌ MySQL Connection failed:", err.message));

// Keeping global.db for your existing controllers
global.db = db;

const app = express();

// 3. GLOBAL MIDDLEWARE
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "https://chocolicious-frontend.vercel.app", 
    "https://www.chocolicious.in"
  ], 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

// 4. CUSTOM MIDDLEWARE
const isAdmin = (req, res, next) => {
  // Handles both boolean true and TiDB tinyint(1)
  if (req.user && (req.user.is_admin == 1 || req.user.is_admin === true)) {
    next();
  } else {
    res.status(403).json({ message: "Access Denied: Admins Only" });
  }
};

// 5. BASE ROUTES
app.get("/", (req, res) => {
  res.send("Chocolicious API is working");
});

// 6. MODULE ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes); 
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);

// 7. PRODUCT & CUSTOMIZATION ROUTES
app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
});

app.post("/api/customizations/add", auth, async (req, res) => {
  if (req.user.is_admin == 1) return res.status(403).json({ message: "Admins cannot place custom orders." });
  
  const { phone, order_type, custom_info, price, image_url } = req.body;
  if (!phone || phone === "null" || !order_type || !price) return res.status(400).json({ message: "Missing required data." });

  try {
    const query = "INSERT INTO customizations (phone, order_type, custom_info, price, image_url) VALUES (?, ?, ?, ?, ?)";
    await db.query(query, [phone, order_type, custom_info, price, image_url || null]);
    res.status(201).json({ message: "Customization saved!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cart/add", auth, async (req, res) => {
  if (req.user.is_admin == 1) return res.status(403).json({ message: "Shopping disabled for Admin." });
  
  const { phone, product_name, qty, price, custom_info } = req.body;
  try {
    const query = "INSERT INTO cart (phone, product_name, qty, price, custom_info) VALUES (?, ?, ?, ?, ?)";
    await db.query(query, [phone, product_name, qty, price, custom_info]);
    res.status(201).json({ message: "Added to cart!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. ADMIN PROTECTED ROUTES
app.get("/api/admin/orders", auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM orders ORDER BY order_id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

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

app.post("/api/admin/payments/confirm", auth, isAdmin, async (req, res) => {
  const { order_id, payment_mode } = req.body;
  try {
    await db.query("INSERT INTO payment (order_id, payment_mode, payment_status, payment_date) VALUES (?, ?, 'Completed', NOW())", [order_id, payment_mode]);
    await db.query("UPDATE orders SET order_status = 'Delivered', payment_status = 'Completed', payment_mode = ? WHERE order_id = ?", [payment_mode, order_id]);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/inventory", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM inventory");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/inventory/update", auth, isAdmin, async (req, res) => {
  const { item_id, new_quantity } = req.body;
  try {
    await db.query("UPDATE inventory SET quantity = ? WHERE item_id = ?", [new_quantity, item_id]);
    res.json({ message: "Inventory updated!" });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post("/api/admin/inventory/add", auth, isAdmin, async (req, res) => {
  const { item_name, category, quantity, unit } = req.body;
  try {
    await db.query("INSERT INTO inventory (item_name, category, quantity, unit) VALUES (?, ?, ?, ?)", [item_name, category, quantity, unit]);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/inventory/delete/:id", auth, isAdmin, async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM inventory WHERE item_id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. PUBLIC UTILITY ROUTES
app.post('/api/contact', async (req, res) => {
    const { firstName, lastName, mobile, email, reqDate, city, query } = req.body;
    try {
        const sql = "INSERT INTO contact_messages (first_name, last_name, mobile, email, req_date, city, query_text) VALUES (?, ?, ?, ?, ?, ?, ?)";
        await db.query(sql, [firstName, lastName, mobile, email, reqDate, city, query]);
        res.status(200).json({ message: "Message sent successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// 10. SERVER STARTUP
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is live on port ${PORT}`);
});