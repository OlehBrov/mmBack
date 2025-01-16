const parceProduct = (product) => {
  const parsedProduct = {
    barcode: product.barcode,
    data: {
      ...product.data,
    },
  };

  for (const key in product.data) {
    if (Object.hasOwn(product.data, key)) {
      const value = product.data[key];

      // Check if value is a boolean, skip parsing
      if (typeof value === "boolean") {
        parsedProduct.data[key] = value;
        continue;
      }
        if (key === "product_code") {
 
          parsedProduct.data[key] = value.replace(/\s/g, "");
          continue;
      }
      // Check if value is parsable as a float
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue) && value !== null && value !== "") {
        parsedProduct.data[key] = parsedValue;
      } else {
        // If not parsable, keep the original value
        parsedProduct.data[key] = value;
      }
    }
  }

  return parsedProduct;
};

module.exports = parceProduct;
