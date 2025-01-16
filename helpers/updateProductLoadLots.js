const updateProductLoadLots = (withdrawProduct, loadLots) => {


  if (withdrawProduct.decrement === "all" && withdrawProduct.limit === "") {
    return clearAllLots(loadLots);
  }

  if (
    withdrawProduct.decrement === "all" &&
    withdrawProduct.limit === "not-last"
  ) {
    return clearAllExceptLast(loadLots);
  }
  let remainingQuantity = parseFloat(withdrawProduct.decrement);

  const modifiedLots = [];

  for (const lot of loadLots) {
    if (remainingQuantity === 0) break;
    if (lot.products_left > 0) {
      const decrementAmount = Math.min(remainingQuantity, lot.products_left);

      const originalProductsLeft = lot.products_left;

      lot.products_left -= decrementAmount;
      remainingQuantity -= decrementAmount;

      if (lot.products_left === 0) {
        lot.lotIsActive = 0; // Deactivate lot if all products are decremented
      }

      // Only add the modified lot to the result
      modifiedLots.push({
        ...lot,
        originalProductsLeft,
        decrementAmount,
        withdrawQuantity: decrementAmount,
      });
    }
  }

  return modifiedLots;
};

const clearAllLots = (lots) => {
  if (!Array.isArray(lots) || lots.length === 0) return [];
  return lots.map((lot) => {
    return {
      ...lot,
      products_left: 0,
      lotIsActive: 0,
      withdrawQuantity: lot.products_left,
    };
  });
};

const clearAllExceptLast = (lots) => {
  if (!Array.isArray(lots) || lots.length < 1) return [];
  const modifiedLots = lots.slice(0, -1).map((lot) => ({
    ...lot,
    products_left: 0,
    lotIsActive: 0,
    withdrawQuantity: lot.products_left,
  }));

  return [...modifiedLots];
};
module.exports = updateProductLoadLots;
