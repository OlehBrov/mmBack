const { prisma } = require("../config/db/dbConfig");

const checkComboProducts = async (products) => {
    console.log('checkComboProducts products', products)
  const withChildBarcode = [];
  const noChildBarcode = [];
  for (const product of products) {
    if (!product.child_product_barcode || child_product_barcode === "") {
      product.sale_id = 0;
      noChildBarcode.push(product);
      continue;
    }
    withChildBarcode.push(product);
  }
  const existingChildProduct = await prisma.products.findMany({
    where: { barcode: { in: products.map((p) => p.child_product_barcode) } },
  });

  return { withChildBarcode, noChildBarcode, existingChildProduct };
};

module.exports = checkComboProducts;
