const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  requestOTP,
  verifyOTP,
  setPassword,
  login,
  updateProfile,
  getProfile,
  
} = require("../controllers/authControllers");

router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyOTP);
router.post("/set-password", setPassword);
router.post("/login", login);
router.post("/update-profile", auth, updateProfile);
router.get("/profile", getProfile);


module.exports = router;
