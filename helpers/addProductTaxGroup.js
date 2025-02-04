const { v4: uuidv4 } = require("uuid");

const addProductTaxGroup = (products, store, noVATSProducts, VATSProducts) => {
  const taxGroupForNoVatProduct = store.default_merchant_taxgrp;
  const taxGroupForOnlyVatProduct = store.VAT_merchant_taxgrp;
  const taxGroupForVatExciseProduct = store.VAT_excise_taxgrp;
  const internalCheckId = uuidv4();
  for (const product of products) {
    product.internalCheckId = internalCheckId;
    if (product.merchant === "both") {
      if (product.is_VAT_Excise && product.excise_product) {
        product.taxGroup = taxGroupForVatExciseProduct;
        VATSProducts.cartProducts.push(product);
        continue;
      } else if (product.is_VAT_Excise && !product.excise_product) {
        product.taxGroup = taxGroupForOnlyVatProduct;
        VATSProducts.cartProducts.push(product);
        continue;
      } else {
        product.taxGroup = taxGroupForNoVatProduct;
        noVATSProducts.cartProducts.push(product);
        continue;
      }
    } else if (product.merchant === "VAT") {
      product.taxGroup = product.excise_product
        ? taxGroupForVatExciseProduct
        : taxGroupForOnlyVatProduct;
      VATSProducts.cartProducts.push(product);
      continue;
    } else {
      // if (product.merchant === "noVAT")
      product.taxGroup = taxGroupForNoVatProduct;
      noVATSProducts.cartProducts.push(product);
    }
  }
};

module.exports = addProductTaxGroup;
