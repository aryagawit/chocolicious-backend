const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ----------------- LOGIN (Email + Password) -----------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide both email and password" });
    }

    // 1. Find user by email
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = users[0];

    // 2. Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 3. Generate JWT Token
    const token = jwt.sign(
      { id: user.id, is_admin: user.is_admin }, 
      process.env.JWT_SECRET, 
      { expiresIn: "24h" }
    );

    // 4. Send response
    res.json({ 
      success: true,
      message: "Login successful",
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone,
        is_admin: user.is_admin 
      } 
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------- UPDATE PROFILE -----------------
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { name, email, gender, dob, anniversary, address } = req.body;

    await db.query(
      "UPDATE users SET name = ?, email = ?, gender = ?, dob = ?, anniversary = ?, address = ? WHERE id = ?",
      [name, email, gender, dob || null, anniversary || null, address, userId]
    );

    res.json({ success: true, message: "Profile Updated Successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------- GET PROFILE -----------------
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; 
    const [users] = await db.query(
      "SELECT name, email, phone, gender, dob, anniversary, address, is_admin FROM users WHERE id = ?", 
      [userId]
    );
    
    if (users.length > 0) {
      return res.json({ success: true, user: users[0] });
    } else {
      return res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};