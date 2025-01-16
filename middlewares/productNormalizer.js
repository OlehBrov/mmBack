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
        product_price_no_VAT,
        VAT_value,
        excise_value
      } = product;

      const productCategory = parseInt(product_category);
      const productSubcategory = parseInt(product_subcategory);
      const productLeft = parseFloat(product_left);
      const productPrice = parseFloat(product_price);
      const expositionTerm = parseInt(exposition_term) || 0;
      const saleId = parseInt(sale_id);
      const productCode = product_code.toString();
      const productPriceNoVAT = parseFloat(product_price_no_VAT);
      const vatValue = parseFloat(VAT_value);
      const exciseValue = parseFloat(excise_value) || 0;

      if (
        isNaN(productCategory) ||
        isNaN(productSubcategory) ||
        isNaN(productLeft) ||
        isNaN(productPrice) ||
        isNaN(saleId) ||
        isNaN(productPriceNoVAT) ||
        isNaN(vatValue)
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
          product_price_no_vat: productPriceNoVAT,
          vat_value: vatValue,
          excise_value: exciseValue
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
