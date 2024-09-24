const express = require("express");
const router = express.Router();
const productsController = require('../controllers/storeController');
const storeAuthenticate = require("../middlewares/storeAuthenticate");


router.get("/", storeAuthenticate, productsController.getAllStoreProducts)
router.get('/:filter')

module.exports = router;
