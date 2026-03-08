const express = require("express");
const router = express.Router();
const db = require("../config/db"); // Ensure your DB config path is correct

// Fetch all products with the new size column
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error: " + err.message });
  }
});

module.exports = router;