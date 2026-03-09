const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const db = require("../config/db");

// GET PROFILE
router.get("/history/:phone", async (req, res) => {
  try {
    // We use aliases (AS) to make the database names match what 
    // your frontend React code is likely expecting.
    const [rows] = await db.query(
      `SELECT 
        order_id AS id, 
        price AS total_amount, 
        order_date, 
        product_name AS item_summary, 
        order_status AS status 
      FROM orders 
      WHERE phone = ? 
      ORDER BY order_date DESC`,
      [req.params.phone]
    );
    res.json(rows);
  } catch (err) {
    console.error("Order History Error:", err);
    res.status(500).json({ error: "Could not fetch history" });
  }
});

// ADD THIS TO userRoutes.js
// GET PROFILE DATA
router.get("/profile", auth, async (req, res) => {
  try {
    // We use req.user.id from the 'auth' middleware to find the right person
    const [rows] = await db.query(
      "SELECT name, phone, email, gender, dob, anniversary, address FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Sending the data back to your React frontend
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("Profile Load Error:", err);
    res.status(500).json({ message: "Error loading profile" });
  }
});

// UPDATE PROFILE
router.put("/profile", auth, async (req, res) => {
  try {
    const { name, phone, email, gender, dob, anniversary, address } = req.body;

    // 1. Format for NULL safety (Treat empty strings as NULL for the UNIQUE constraint)
    const fPhone = phone && phone.trim() !== "" ? phone : null;
    const fEmail = email && email.trim() !== "" ? email : null;
    const fDob = dob && dob !== "" ? dob : null;
    const fAnniversary = anniversary && anniversary !== "" ? anniversary : null;

    // 2. The Query (Check every comma and every '?')
    const sql = `
      UPDATE users 
      SET name = ?, 
          phone = ?, 
          email = ?, 
          gender = ?, 
          dob = ?, 
          anniversary = ?, 
          address = ? 
      WHERE id = ?
    `;

    // 3. The Array (MUST match the order of '?' above exactly)
    const params = [
      name,         // 1st ?
      fPhone,       // 2nd ? (Previously missing/shifted)
      fEmail,       // 3rd ?
      gender,       // 4th ?
      fDob,         // 5th ?
      fAnniversary, // 6th ?
      address,      // 7th ?
      req.user.id   // 8th ? (The WHERE clause)
    ];

    await db.query(sql, params);

    res.json({ success: true, message: "Profile updated successfully! 🧁" });

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: "This phone number is already registered to another account." 
      });
    }
    console.error("Database Error:", err);
    res.status(500).json({ success: false, message: "Failed to update profile." });
  }
});

module.exports = router;
