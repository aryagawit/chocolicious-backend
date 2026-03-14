const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const db = require("../config/db");

router.post("/place-order", auth, async (req, res) => {
  try {
    const { orderName, amount, phone, address, deliveryDate, fullName } = req.body;
    const customerId = req.user.id; 

    // FIXED: Now has 7 columns and 7 corresponding values
    const [result] = await db.query(
      `INSERT INTO orders 
      (customer_id, order_date, order_status, product_name, price, phone, address, name) 
      VALUES (?, NOW(), 'Pending', ?, ?, ?, ?, ?)`,
      [customerId, orderName, amount, phone, address]
    );

    const officialOrderId = result.insertId;

    res.json({ 
      success: true, 
      orderId: officialOrderId,
      orderName,
      amount,
      phone,
      deliveryDate,
      address: address,
      fullName
    });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ message: "Failed to place order" });
  }
});

router.get("/my-orders", auth, async (req, res) => {
  try {
    const customerId = req.user.id;
    // This will work once you run the ALTER TABLE command
    const [rows] = await db.query(
      `SELECT 
        order_id AS id, 
        price AS total_amount, 
        order_date, 
        product_name, 
        order_status AS status,
        name AS fullName,
        address
      FROM orders 
      WHERE customer_id = ? 
      ORDER BY order_date DESC`,
      [customerId]
    );
res.json({ success: true, orders: rows });
} catch (err) {
    console.error("SQL Error in my-orders:", err.message);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

module.exports = router;