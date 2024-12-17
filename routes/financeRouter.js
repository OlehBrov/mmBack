const express = require("express");
const financeController = require("../controllers/financeController");
const router = express.Router();

router.get("/", financeController.getPaymentsByPeriod)

module.exports = router