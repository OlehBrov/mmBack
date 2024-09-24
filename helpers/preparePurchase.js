const preparePurchase = (purchaseProductsList) => {
  const purSum = purchaseProductsList.reduce((acc, item) => {
    const pr = Number(item.Products.price);
    const qt = Number(item.total);
    const finPrice = pr * qt;
    return acc + finPrice;
  }, 0);
  if (Number.isNaN(purSum)) return null; // Return here to stop further execution

  const purchAmount = purSum.toFixed(2);
  return {
    method: "Purchase",
    step: 0,
    params: {
      amount: purchAmount,
      discount: "",
      merchantId: "0",
      facepay: "false",
    },
  };
};

module.exports = preparePurchase;
