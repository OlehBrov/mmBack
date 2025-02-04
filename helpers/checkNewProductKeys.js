const { NEW_PRODUCT_DATA_KEYS_DEFAULTS } = require("../constant/constants");
const setProductImgUrl = require("./setProductImgUrl");

const checkNewProductKeys = async (product, possibleUpdateKeys) => {
  const imageUrl = await setProductImgUrl(product);
  product.data.product_image = imageUrl;
  const updatedData = {
    ...NEW_PRODUCT_DATA_KEYS_DEFAULTS,
    ...product.data,
  };

    const newProd = {
     ...product,
    data: updatedData,
    }
  return {
    ...product,
    data: updatedData,
  };
};

const checkUpdateProductKeys = (product, possibleUpdateKeys) => {
  const updatedData = { ...NEW_PRODUCT_DATA_KEYS_DEFAULTS };
  possibleUpdateKeys.forEach((key) => {
    if (key === "barcode") return;

    updatedData[key] = product.data.hasOwnProperty(key) && product.data[key];
  });

  return {
    ...product,
    data: updatedData,
  };
};


module.exports = { checkNewProductKeys, checkUpdateProductKeys };
