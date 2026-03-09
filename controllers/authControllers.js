const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ----------------- SIGNUP -----------------
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // 1. Check if user already exists
    const [existing] = await db.query("SELECT * FROM users WHERE email = ? OR phone = ?", [email, phone]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "User with this email or phone already exists" });
    }

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insert into TiDB
    await db.query(
      "INSERT INTO users (name, email, phone, password, is_verified) VALUES (?, ?, ?, ?, TRUE)",
      [name, email, phone || null, hashedPassword]
    );

    res.status(201).json({ success: true, message: "User registered successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during registration" });
  }
};

/// ----------------- LOGIN (Final Corrected) -----------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Fetch user from DB
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(400).json({ message: "User not found" });

    const user = users[0];

    // 2. Compare Password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    // 3. Create Payload (Ensuring 'id' matches your table column name)
    // If your DB column is 'id', use user.id. If it's 'user_id', use user.user_id.
    const payload = {
      id: user.id, 
      is_admin: user.is_admin 
    };

    // 4. Generate Token
    const token = jwt.sign(
      payload, 
      process.env.JWT_SECRET, 
      { expiresIn: "24h" }
    );

    // 5. Send Response
    res.json({ 
      success: true, 
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
    console.error("Login error:", err);
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