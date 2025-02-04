

const preparePurchase = (purchaseProducts, merchant, key) => {

  if (!purchaseProducts || !purchaseProducts.cartProducts.length) return null;
  const purSum = purchaseProducts.cartProducts.reduce((acc, item) => {
    const pr = Number(item.product_price);
    const qt = Number(item.inCartQuantity);
    const finPrice = pr * qt;
    return acc + finPrice;
  }, 0);
  if (Number.isNaN(purSum)) return null; 

  const purchAmount = purSum.toFixed(2);

  // const amount =
  //   key === "noVat"
  //     ? purchaseProducts.taxes.noVATTotalSum
  //     : purchaseProducts.taxes.withVATTotalSum;
  const totalDiscount = purchaseProducts.cartProducts
    .reduce((acc, item) => {
      const productDiscount = Number(item.priceDecrement);
      const productQuantity = Number(item.inCartQuantity);
      const discountPerProduct = productDiscount * productQuantity;
      return acc + discountPerProduct;
    }, 0)
    .toFixed(2);
  
  const paymentAmount = Number(purchAmount) - Number(totalDiscount)
  const paymentAmountRounded = paymentAmount.toFixed(2)
  return {
    method: "Purchase",
    step: 0,
    params: {
      amount: paymentAmountRounded,
      discount: totalDiscount,
      merchantId: merchant,
      facepay: "false",
    },
  };
};

module.exports = preparePurchase;
