const express = require("express");
const router = express.Router();

const authStoreController = require("../controllers/authStoreController");
router.post("/refresh-token", authStoreController.refreshToken)
router.post("/login", authStoreController.logInStore);
router.post("/logout", authStoreController.logoutStore);

module.exports = router;
