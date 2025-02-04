const { prisma } = require("../config/db/dbConfig");

const checkComboProducts = async (products) => {
  // console.log("checkComboProducts products", products);
  const withChildBarcode = [];
  const noChildBarcode = [];

  for (const product of products) {
    if (product.sale_id !== 7) {
      product.child_product_barcode = null;
      noChildBarcode.push(product);
      continue
    }
    if (
      (product.sale_id === 7 && !product.child_product_barcode) ||
      product.child_product_barcode === ""
    ) {
      product.sale_id = 0;
      product.child_product_barcode = null;
      noChildBarcode.push(product);
      continue;
    }
    const childProductExist = await prisma.products.findUnique({
      where: {
        barcode: product.child_product_barcode,
      },
    });

    if (!childProductExist) {
      product.sale_id = 0;
      product.child_product_barcode = null;
      noChildBarcode.push(product);
      continue;
    }
    product.child_id = childProductExist.id
    withChildBarcode.push(product);
  }

  const checkedChildBarcodeProducts = [...withChildBarcode, ...noChildBarcode];
// console.log('checkedChildBarcodeProducts', checkedChildBarcodeProducts)
  return checkedChildBarcodeProducts;
};

module.exports = checkComboProducts;
