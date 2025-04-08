const express = require("express");
const router = express.Router();

const configController = require("../controllers/configController");

router.get("/check-categories", configController.checkCategories);
router.post("/category", configController.addCategory);
router.patch("/category", configController.editCategory);
router.post("/subcategory", configController.addSubCategory);
router.patch("/subcategory", configController.editSubCategory);
router.post("/move-subcategory", configController.moveSubCategory);
router.post("/store-sale", configController.addStoreSale);
router.post("/merchant", configController.setMerchantData);
router.post("/category-image", configController.addCategoryImage);
router.get("/store-sale", configController.getStoreSale);
router.get("/merchant", configController.getMerchantData);

module.exports = router;
