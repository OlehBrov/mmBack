const express = require("express");
const router = express.Router();

const cartController = require("../controllers/cartController");
const amountCounter = require("../middlewares/amountCounter");

// router.post("/buy", amountCounter, cartController.productsSell);
router.post("/buy", cartController.productsSell);
router.post('/cancel', cartController.cancelSell)

module.exports = router;
