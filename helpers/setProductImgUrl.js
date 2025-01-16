const fs = require("fs/promises");
const path = require("path");
const { IMAGE_EXTENSIONS } = require("../constant/constants");
const {MM_HOST} = process.env
const imagesDir = process.env.IMAGE_DIR;
const setProductImgUrl = async (product) => {
  let imagePath = `${MM_HOST}/api/product-image/default-product.jpg`;
  for (const ext of IMAGE_EXTENSIONS) {
    const fullPath = path.join(imagesDir, `${product.barcode}${ext}`);
    try {
      const imgpath = await fs.access(fullPath); // If file exists, fs.access will not throw an error
 
      if (!imgpath) {
        throw Error("File not found");
      }
      imagePath = `${MM_HOST}/api/product-image/${product.barcode}${ext}`;
      break; // Exit the loop if image is found
    } catch (err) {
      // Do nothing, try next extension
      console.log("fs.access err", err);
    }
  }
  return imagePath;
};

module.exports = setProductImgUrl;
