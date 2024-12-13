const moment = require("moment");
const { prisma } = require("../config/db/dbConfig");

const purchaseDbHandler = async (cartProductsObject, bankResponse) => {
  console.log("purchaseDbHandler bankResponse", bankResponse);
  const { params } = bankResponse;
  const products = cartProductsObject.cartProducts;
  console.log("purchaseDbHandler products", products);
  const removeProductsData = products.map((product) => {
    const [day, month, year] = params.date.split(".");
    const isoDate = `${year}-${month}-${day}`;
    const isoDateTime = `${isoDate}T${params.time}`;
    const dateObject = moment(isoDateTime).toISOString(true);
    const validDateTime = moment(dateObject).format('YYYY-MM-DDTHH:mm:ss.SSS')
    console.log('dateObject', dateObject)
    return {
      product_id: product.id,
      remove_date: `${validDateTime}+00:00`,
      remove_quantity: product.inCartQuantity,
      remove_type_id: 1,
      remove_cost: product.product_price * product.inCartQuantity,
      load_id: product.product_lot,
      method: bankResponse.method,
      amount: params.amount,
      approvalCode: params.approvalCode,
      date: params.date,
      time: params.time,
      discount: params.discount,
      pan: params.pan,
      responseCode: params.responseCode,
      rrn: params.rrn,
      rrnExt: params.rrnExt,
      bankAcquirer: params.bankAcquirer,
      paymentSystem: params.paymentSystem,
      subMerchant: params.subMerchant,
    };
  });
  await prisma.RemoveProducts.createMany({
    data: removeProductsData,
  });

  const updateProducts = async () => {
    await prisma.$transaction(async (tx) => {
      for (const product of removeProductsData) {
        await prisma.LoadProducts.update({
          where: {
            id: product.load_id,
          },
          data: {
            products_left: {
              decrement: parseFloat(product.remove_quantity),
            },
          },
        });

        await tx.Products.update({
          where: {
            id: product.product_id,
          },
          data: {
            product_left: {
              decrement: parseFloat(product.remove_quantity),
            },
          },
        });
      }
    });

    // for (const product of products) {
    //   console.log("updateProducts product", product);
    //   const updProd = await prisma.LoadProducts.update({
    //     where: {
    //       id: product.product_lot,
    //     },
    //     data: {
    //       products_left: {
    //         decrement: product.inCartQuantity,
    //       },
    //     },
    //   });

    // }
  };

  await updateProducts();
};

module.exports = purchaseDbHandler;
