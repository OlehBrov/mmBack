const ctrlWrapper = require("./ctrlWrapper");
const recipeReqCreator = require("./recipeReqCreator");
const httpError = require("./httpError");
const preparePurchase = require("./preparePurchase");
const { initBuffer, saveBuffer } = require("./unsentFiscalHandler");
const withResolvers = require("./withResolvers");
const purchaseDbHandler = require("./purchaseDbHandler");
const updateProductLoadLots = require("./updateProductLoadLots");
// const saveTempProductData = require("./saveTempProductDataToDB")
const parceProduct = require("./parceProduct");
const checkExistingCategory = require("./checkExistingCategory");
const { checkNewProductKeys } = require("./checkNewProductKeys");
const setProductImgUrl = require("./setProductImgUrl");
const checkIfProductExist = require("./checkIfProductExist");
const checkComboProducts = require("./checkComboProducts");
const addProductTaxGroup = require("./addProductTaxGroup");
const processSubcategoryMove = require("./processSubcategoryMove");
const saveTempFileSubcategoryMoveData = require("./saveTempFileSubcategoryMoveData");

module.exports = {
  ctrlWrapper,
  recipeReqCreator,
  httpError,
  preparePurchase,
  initBuffer,
  saveBuffer,
  withResolvers,
  purchaseDbHandler,
  updateProductLoadLots,
  parceProduct,
  checkExistingCategory,
  checkNewProductKeys,
  setProductImgUrl,
  checkIfProductExist,
  checkComboProducts,
  addProductTaxGroup,
  processSubcategoryMove,
  saveTempFileSubcategoryMoveData,
  // saveTempProductData
};
