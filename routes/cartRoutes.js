const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const db = require("../config/db");
// Fetch cart items by phone
router.get("/get-cart/:phone", auth, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM cart WHERE phone = ?", [req.params.phone]);
    res.json({ success: true, cart: rows });
  } catch (err) {
    res.status(500).json({ message: "Error fetching cart" });
  }
});
// routes/cartRoutes.js
router.post("/add", auth, async (req, res) => {
  const { phone, product_name, qty, price, size } = req.body;
  if (!phone || !product_name || !price) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const [existing] = await db.query(
      "SELECT * FROM cart WHERE phone = ? AND product_name = ? AND size = ?",
      [phone, product_name, size || 'Small']
    );

    if (existing.length > 0) {
      // 2. Agar item pehle se hai, toh quantity update karein
      await db.query(
        "UPDATE cart SET qty = qty + ? WHERE id = ?",
        [qty, existing[0].id]
      );
      return res.status(200).json({ message: "Cart updated" });
    } else {
    // Check if item already exists to update qty, or insert new
    await db.query(
      "INSERT INTO cart (phone, product_name, qty, price, size) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE qty = qty + 1",
      [phone, product_name, qty, price, size || 'Small']
    );
    return res.status(201).json({ message: "Added to cart" });
  }
  } catch (err) {
    console.error("Cart DB Error:", err);
    res.status(500).json({ message: "Error adding to cart" });
  }
});
// Update quantity in DB
// routes/cartRoutes.js
router.put("/update-qty", auth, async (req, res) => {
  const { phone, product_name, newQty } = req.body;
  console.log("Searching for:", { phone, product_name });
  try {
    // We use the column names exactly as seen in your DESCRIBE cart image
    const [result] = await db.query(
      "UPDATE cart SET qty = ? WHERE phone = ? AND product_name = ?", 
      [newQty, phone, product_name]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    res.json({ success: true, message: "Quantity updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error" });
  }
});


// routes/cartRoutes.js
// Add to your cart routes file
router.delete("/clear/:phone", auth, async (req, res) => {
  try {
    const { phone } = req.params;
    // Deletes every row in the cart table for this specific phone number
    await db.query("DELETE FROM cart WHERE phone = ?", [phone]);
    
    res.json({ success: true, message: "Cart emptied successfully" });
  } catch (err) {
    console.error("Clear Cart Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router; 