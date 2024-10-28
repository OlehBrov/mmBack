const { prisma } = require("../config/db/dbConfig");

const purchaseDbHandler = async (cartProductsObject, bankResponse) => {
  console.log('purchaseDbHandler bankResponse', bankResponse)
  const products = cartProductsObject.cartProducts
  console.log('purchaseDbHandler products', products)
  const removeProductsData = products.map((product) => {
    const [day, month, year] = bankResponse.params.date.split(".");
    const isoDate = `${year}-${month}-${day}`;
    const isoDateTime = `${isoDate}T${bankResponse.params.time}`;
    const dateObject = new Date(isoDateTime);
    return {
      product_id: product.id,
      remove_date: dateObject,
      remove_quantity: product.inCartQuantity,
      remove_type_id: 1,
      remove_cost: product.product_price * product.inCartQuantity,
      load_id: product.product_lot,
    };
  });
  await prisma.RemoveProducts.createMany({
    data: removeProductsData,
  });

  const updateProducts = async () => {
    for (const product of products) {
     console.log('updateProducts product', product)
      const updProd = await prisma.LoadProducts.update({
        where: {
         id:product.product_lot
        },
        data: {
          products_left: {
            decrement: product.inCartQuantity,
          },
        },
      });
      console.log("updProd", updProd);
    }
  };

  await updateProducts();
};

module.exports = purchaseDbHandler;
