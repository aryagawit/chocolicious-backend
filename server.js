const express = require("express");
const cors = require("cors"); 
require("dotenv").config();
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken"); // Ensure you have this for token verification

const db = mysql.createPool({
  host: "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
  port: 4000,
  user: "4FmVqdMoeFfBEMV.root",
  password: process.env.DB_PASSWORD,
  database: "chocolicious_db",
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection()
  .then(() => console.log("✅ MySQL Connected successfully!"))
  .catch((err) => console.error("❌ MySQL Connection failed:", err.message));

global.db = db;

// --- MIDDLEWARE DEFINITIONS ---

// 1. Base Authentication Middleware (Verifies the JWT)
const auth = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    req.user = decoded; // This contains the user's id, phone, and is_admin status
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

// 2. Admin Security Middleware
const isAdmin = (req, res, next) => {
  // We check the 'is_admin' property that we attached to req.user in the auth middleware
  if (req.user && req.user.is_admin == 1 || req.user.is_admin === true) {
    next();
  } else {
    res.status(403).json({ message: "Access Denied: Admins Only" });
  }
};

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");

const app = express();

app.use(cors({
  origin: ["http://localhost:3000", "https://your-firebase-app-url.web.app"], 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

// --- ROUTES ---

app.get("/", (req, res) => {
  res.send("Server working");
});

app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching products", error: err.message });
  }
});

// MODIFIED: Block Admin from adding customizations
app.post("/api/customizations/add", auth, async (req, res) => {
  if (req.user.is_admin === 1) {
    return res.status(403).json({ message: "Admins cannot place custom orders." });
  }
  const { phone, order_type, custom_info, price, image_url } = req.body;
  if (!phone || phone === "null" || !order_type || !price) {
    return res.status(400).json({ message: "Missing required data." });
  }
  try {
    const query = "INSERT INTO customizations (phone, order_type, custom_info, price, image_url) VALUES (?, ?, ?, ?, ?)";
    await db.query(query, [phone, order_type, custom_info, price, image_url || null]);
    res.status(201).json({ message: "Customization saved!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MODIFIED: Block Admin from adding to cart
app.post("/api/cart/add", auth, async (req, res) => {
  if (req.user.is_admin === 1) {
    return res.status(403).json({ message: "Shopping is disabled for Admin accounts." });
  }
  const { phone, product_name, qty, price, custom_info } = req.body;
  try {
    const query = "INSERT INTO cart (phone, product_name, qty, price, custom_info) VALUES (?, ?, ?, ?, ?)";
    await db.query(query, [phone, product_name, qty, price, custom_info]);
    res.status(201).json({ message: "Added to cart!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SECURED: Only Admins can see all orders
app.get("/api/admin/orders", auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM orders ORDER BY order_id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

// SECURED: Only Admins can confirm payments
app.post("/api/admin/payments/confirm", auth, isAdmin, async (req, res) => {
  const { order_id, payment_mode } = req.body;
  const payment_status = "Completed";
  try {
    await db.query(
      "INSERT INTO payment (order_id, payment_mode, payment_status, payment_date) VALUES (?, ?, ?, NOW())",
      [order_id, payment_mode, payment_status]
    );
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

// SECURED: Only Admins can update inventory
app.put("/api/admin/inventory/update", auth, isAdmin, async (req, res) => {
  const { item_id, new_quantity } = req.body;
  try {
    await db.query("UPDATE inventory SET quantity = ? WHERE item_id = ?", [new_quantity, item_id]);
    res.json({ message: "Inventory updated!" });
  } catch (err) {
    res.status(500).send(err);
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

// ADD THIS to your backend (server.js)
app.put("/api/admin/orders/status", auth, isAdmin, async (req, res) => {
  const { order_id, order_status } = req.body;
  try {
    console.log(`Updating Order ${order_id} to ${order_status}`);

    const query = "UPDATE orders SET order_status = ? WHERE order_id = ?";
    const [result] = await db.query(query, [order_status, order_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ success: true, message: "Status updated successfully!" });
  } catch (err) {
    console.error("Status Update Error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

app.post("/api/login", async (req, res) => {
  const { phone, password } = req.body;
  const [rows] = await db.query("SELECT id, phone, name, is_admin FROM users WHERE phone = ?", [phone]);
  const user = rows[0];

  if (user) {
    // Note: In a real app, generate a real JWT here using jwt.sign({ id: user.id, is_admin: user.is_admin }, ...)
    res.json({
      success: true,
      token: "mock_token_for_now", 
      user: { phone: user.phone, name: user.name, is_admin: user.is_admin }
    });
  }
});

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

// SECURED: Only Admins can delete inventory items
app.delete("/api/admin/inventory/delete/:id", auth, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query("DELETE FROM inventory WHERE item_id = ?", [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item not found" });
    }
    
    res.json({ message: "Inventory item deleted successfully" });
  } catch (err) {
    console.error("Delete Inventory Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ... Keep your other cart/delete routes below as they were ...

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes); 
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));