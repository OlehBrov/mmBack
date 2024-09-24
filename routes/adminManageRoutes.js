const express = require("express");
const router = express.Router();
const schemas = require("../validation/validation");
const adminManageController = require("../controllers/adminManageController");
const adminAuthenticate = require("../middlewares/adminAuthenticate");

const { bodyValidator } = require("../validation/validator");

router.use(adminAuthenticate);
router.get("/", adminManageController.getAllStores);
router.get("/:id", adminManageController.getSingleStore);
router.post("/", adminManageController.putProductsInStore);
router.post("/create", adminManageController.createStore);

router.get("/products", adminManageController.getAllProducts);
router.post(
  "/products",
  bodyValidator(schemas.addProductValidation),
  adminManageController.addProducts
);
router.patch(
  "/products",
  bodyValidator(schemas.updateProductValidation),
  adminManageController.updateProducts
);
module.exports = router;