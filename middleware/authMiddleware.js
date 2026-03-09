const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  // Get token from header (Handling both 'Authorization' and 'authorization' cases)
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "No token, access denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // This makes req.user.is_admin available for the next middleware
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    res.status(401).json({ success: false, message: "Token is not valid" });
  }
};