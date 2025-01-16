const express = require("express");
const router = express.Router();
const productsController = require("../controllers/storeController");
const storeAuthenticate = require("../middlewares/storeAuthenticate");
const imageController = require("../controllers/imagesController");
const upload = require("../middlewares/imagesMiddleware");
const checkIfProductCategory = require("../middlewares/checkIfProductCategory");
const productNormalizer = require('../middlewares/productNormalizer')

// router.use(storeAuthenticate)
router.get("/", storeAuthenticate, productsController.getAllStoreProducts);

router.get("/search", productsController.searchProducts);
router.get("/product", productsController.getProductById);
router.get("/single", productsController.getSingleProduct);
router.post("/add", productNormalizer, checkIfProductCategory, productsController.addProducts);
router.post("/withdraw", productsController.withdrawProducts);
// router.post("/image", upload.single("productImage"), imageController.saveImage);
router.post("/image", imageController.saveImage);
router.post("/update", productsController.updateProducts)

module.exports = router;
