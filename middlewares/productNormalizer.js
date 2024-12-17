const { httpError } = require("../helpers");

const productNormalizer = (req, res, next) => {
  const normalizedProducts = [];
  const abNormalProducts = [];
  try {
    const productsArray = req.body;
    
    if (!productsArray) throw Error("No products provided");
    for (const product of productsArray) {
      const {
        product_category,
        product_subcategory,
        product_left,
        product_price,
        exposition_term,
        sale_id,
        product_code,
      } = product;

      const productCategory = parseInt(product_category);
      const productSubcategory = parseInt(product_subcategory);
      const productLeft = parseFloat(product_left);
      const productPrice = parseFloat(product_price);
      const expositionTerm = parseInt(exposition_term) || 0;
      const saleId = parseInt(sale_id);
      const productCode = product_code.toString();

      if (
        isNaN(productCategory) ||
        isNaN(productSubcategory) ||
        isNaN(productLeft) ||
        isNaN(productPrice) ||
        isNaN(saleId)
      ) {
        

        abNormalProducts.push(product);
      } else {
        normalizedProducts.push({
          ...product,
          product_category: productCategory,
          product_subcategory: productSubcategory,
          product_left: product_left,
          product_price: productPrice,
          exposition_term: expositionTerm,
          sale_id: saleId,
          product_code: productCode,
        });
      }
    }
    req.normalizedProducts = normalizedProducts;
    req.abNormalProducts = abNormalProducts;

    next();
  } catch (error) {
    next(httpError(409, "Error with productNormalizer middleware"));
  }
};
module.exports = productNormalizer;
