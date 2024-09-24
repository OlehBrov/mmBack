const express = require("express");
const router = express.Router();

const authAdminController = require("../controllers/authAdminController");
const adminAuthenticate = require("../middlewares/adminAuthenticate");

router.post("/login", authAdminController.logInAdmin);
router.post("/register", authAdminController.registerAdmin);
router.post("/logout", adminAuthenticate, authAdminController.logoutAdmin);

module.exports = router;
