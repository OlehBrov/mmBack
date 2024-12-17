const updateProductLoadLots = (withdrawProduct, loadLots) => {
  console.log("updateProductLoadLots invoke");
  console.log("withdrawProduct", withdrawProduct);
  //   console.log("loadLots", loadLots);
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
  console.log("remainingQuantity", remainingQuantity);
  const modifiedLots = [];

  for (const lot of loadLots) {
    if (remainingQuantity === 0) break;
    if (lot.products_left > 0) {
      const decrementAmount = Math.min(remainingQuantity, lot.products_left);

      const originalProductsLeft = lot.products_left;

      lot.products_left -= decrementAmount;
      remainingQuantity -= decrementAmount;
      //   console.log(
      //     "lot.products_left -= decrementAmount;",
      //     (lot.products_left -= decrementAmount)
      //   );
      //   console.log("lot.products_left ", lot.products_left);
      //   console.log("decrementAmount;", decrementAmount);
      if (lot.products_left === 0) {
        lot.lotIsActive = 0; // Deactivate lot if all products are decremented
      }

      // Only add the modified lot to the result
      modifiedLots.push({
        ...lot,
        originalProductsLeft,
        decrementAmount,
      });
    }
  }
  console.log("modifiedLots", modifiedLots);
  return modifiedLots;
};

const clearAllLots = (lots) => {
  return lots.map((lot) => {
    return {
      ...lot,
      products_left: 0,
      lotIsActive: 0,
    };
  });
};

const clearAllExceptLast = (lots) => {
  const lastLot = lots.slice(-1);
  const lastCutlots = lots.slice(0, -1);
  const modified = lastCutlots.map((lot) => {
    return {
      ...lot,
      products_left: 0,
      lotIsActive: 0,
    };
  });

  return [...modified, ...lastLot];
};
module.exports = updateProductLoadLots;
