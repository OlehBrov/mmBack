const express = require("express");
const router = express.Router();
const proxyRecieptController = require('../controllers/proxyRecieptController')

router.get("/:id", proxyRecieptController.getReciept)

module.exports = router