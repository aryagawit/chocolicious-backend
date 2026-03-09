const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  login,
  updateProfile,
  getProfile,
} = require("../controllers/authControllers");

router.post("/login", login);
router.post("/update-profile", auth, updateProfile);
router.get("/profile", auth, getProfile);

module.exports = router;