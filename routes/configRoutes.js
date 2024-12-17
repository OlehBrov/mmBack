const express = require("express");
const router = express.Router();

const configController = require("../controllers/configController");

router.post("/category", configController.addCategory) 
router.post("/subcategory", configController.addSubCategory)
router.post("/store-sale", configController.addStoreSale)
router.get("/store-sale", configController.getStoreSale)

module.exports = router