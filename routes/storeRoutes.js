const express = require("express");
const router = express.Router();
const productsController = require("../controllers/storeController");
const storeAuthenticate = require("../middlewares/storeAuthenticate");

router.get("/", storeAuthenticate, productsController.getAllStoreProducts);

router.get("/search", storeAuthenticate, productsController.searchProducts);
router.get(
  "/product",
  storeAuthenticate,
  productsController.getProductById
);

module.exports = router;
