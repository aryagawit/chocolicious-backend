const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Helper: Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ----------------- STEP 1: REQUEST OTP -----------------
exports.requestOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) return res.status(400).json({ message: "Phone number is required" });

    // 1. Check if user exists
    const [existing] = await db.query("SELECT * FROM users WHERE phone = ?", [phone]);
    const otp = generateOTP();

    if (existing.length === 0) {
      // 2. Register new user (initially unverified)
      await db.query(
        "INSERT INTO users (phone, otp, is_verified) VALUES (?, ?, FALSE)",
        [phone, otp]
      );
    } else {
      // 3. Update OTP for existing user
      await db.query("UPDATE users SET otp = ? WHERE phone = ?", [otp, phone]);
    }

    // In production, you'd trigger an SMS API here
    console.log(` OTP for ${phone}: ${otp}`); 
    
    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------- STEP 2: VERIFY OTP & AUTO-LOGIN -----------------
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const [users] = await db.query("SELECT * FROM users WHERE phone = ? AND otp = ?", [phone, otp]);

    if (users.length === 0) return res.status(400).json({ message: "Invalid OTP" });

    const user = users[0];
    await db.query("UPDATE users SET is_verified = TRUE, otp = NULL WHERE id = ?", [user.id]);

    const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.json({ 
  success: true, // Helpful for the frontend check
  token, 
  phone: user.phone, // Adding this to match your frontend destructuring
  name: user.name,
  is_admin: user.is_admin, // CRITICAL: This enables the Admin Dashboard
  isNewUser: !user.name 
});
}catch (err) {
    console.error("DEBUG ERROR:", err); // This shows in Render Logs
    res.status(500).json({ 
        message: "Server error", 
        detail: err.message, // This will show in your browser's Network tab
        stack: err.stack 
    });
};

// ----------------- (OPTIONAL) SET PASSWORD -----------------
exports.setPassword = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: "Data missing" });

    const hashed = await bcrypt.hash(password, 10);
    await db.query("UPDATE users SET password = ? WHERE phone = ?", [hashed, phone]);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------- LOGIN (Traditional Email/Phone + Password) -----------------
exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // 1. Validation: Must provide password and either email or phone
    if (!password || (!email && !phone)) {
      return res.status(400).json({ message: "Provide email or phone and password" });
    }

    // 2. Find user by email OR phone
    const [users] = await db.query(
      "SELECT * FROM users WHERE phone = ?",
      [phone]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = users[0];

    // 3. Check if account is verified
    if (!user.is_verified) {
      return res.status(403).json({ message: "Please verify your account first" });
    }

    // 4. Compare passwords
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 5. Generate JWT Token
    const token = jwt.sign(
      { id: user.id, phone: user.phone, is_admin: user.is_admin }, 
      process.env.JWT_SECRET, 
      { expiresIn: "24h" }
    );

    // 6. Send response
    res.json({ 
      message: "Login successful",
      token, 
      user: { id: user.id, email: user.email, phone: user.phone } 
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Function to update profile details for new users
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; // from JWT middleware

    const { fullName, email, gender, dob, anniversary } = req.body;

    await db.query(
      "UPDATE users SET name = ?, email = ?, gender = ?, dob = ?, anniversary = ? WHERE id = ?",
      [fullName, email || null, gender, dob || null, anniversary || null, userId]
    );

    res.json({ message: "Profile Updated Successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};



exports.getProfile = async (req, res) => {
  try {
    const { phone } = req.query;
    const [users] = await db.query("SELECT name, email, gender, dob, anniversary, address FROM users WHERE phone = ?", [phone]);
    
    if (users.length > 0) {
      return res.json({ user: users[0] });
    } else {
      return res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
};