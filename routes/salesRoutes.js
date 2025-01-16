const express = require("express");
const router = express.Router();
const salesController = require("../controllers/salesController");
const storeAuthenticate = require("../middlewares/storeAuthenticate");
// router.use(storeAuthenticate)
router.get('/', salesController.getSalesList)
router.post("/add", salesController.addSale);
router.post('/edit', salesController.editSale)
router.delete('/delete', salesController.removeSale)

module.exports = router;
