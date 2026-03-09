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
    "https://www.chocolicious.in"
  ], 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// 4. ADMIN MIDDLEWARE
const isAdmin = (req, res, next) => {
  if (req.user && (req.user.is_admin == 1 || req.user.is_admin === true)) {
    next();
  } else {
    res.status(403).json({ message: "Access Denied: Admins Only" });
  }
};

// 5. ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes); 
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);

// General Product Routes
app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
});

// Admin Dashboard Routes
app.get("/api/admin/orders", auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM orders ORDER BY order_id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// ... (Rest of your specific Inventory/Order routes stay the same as your previous logic)

app.get("/", (req, res) => res.send("Chocolicious API is live."));

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});