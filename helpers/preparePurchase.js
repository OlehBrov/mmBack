const preparePurchase = (purchaseProducts) => {
  // const purSum = purchaseProductsList.reduce((acc, item) => {
  //   const pr = Number(item.product_price);
  //   const qt = Number(item.inCartQuantity);
  //   const finPrice = pr * qt;
  //   return acc + finPrice;
  // }, 0);
  // if (Number.isNaN(purSum)) return null; // Return here to stop further execution

  // const purchAmount = purSum.toFixed(2);
  const totalDiscount = purchaseProducts.cartProducts.reduce((acc, item) => {
    const productDiscount = Number(item.priceDecrement);
    const productQuantity = Number(item.inCartQuantity);
    const discountPerProduct = productDiscount * productQuantity
    return acc + discountPerProduct
  }, 0).toFixed(2)
  return {
    method: "Purchase",
    step: 0,
    params: {
      amount: purchaseProducts.cartTotalSum,
      discount: totalDiscount,
      merchantId: "0",
      facepay: "false",
    },
  };
};

module.exports = preparePurchase;
