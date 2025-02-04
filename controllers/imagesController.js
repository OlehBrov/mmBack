const { prisma } = require("../config/db/dbConfig");
const { ctrlWrapper } = require("../helpers");
const fs = require("fs");
const path = require("path");
const { wsServer } = require("../socket/heartbeat");
const { MM_HOST } = process.env;
const imagesDir = process.env.IMAGE_DIR;

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
const barcodeFromFilename = (string) => {
  return string.slice(0, string.lastIndexOf("."));
};

const saveImage = async (req, res) => {
  try {
    const imageData = req.body; // Expecting an array of objects


    for (const imageDataItem of imageData) {
      const { productImage, fileName } = imageDataItem;
      if (!productImage || !fileName) {
        throw new Error("Invalid request: Missing image data or file name.");
      }

      // Decode base64 and save as a file
      const buffer = Buffer.from(productImage, "base64");
      const filePath = path.join(imagesDir, fileName);

      fs.writeFile(filePath, buffer, (err) => {
        if (err) throw err;
        console.log("The file has been saved!");
      });
      console.log(`Image saved as ${filePath}`);
      const barcode = barcodeFromFilename(fileName);
      if (!barcode.length) {
        res.status(401).json({
          message: "Bad file name, should be barcode and extension",
        });
      }
      const productInDb = await prisma.Products.findUnique({
        where: {
          barcode: barcode,
        },
      });
      if(productInDb){
      await prisma.Products.update({
        where: {
          barcode: barcode,
        },
        data: {
          product_image: `${MM_HOST}/api/product-image/${fileName}`,
        },
      });}
    }

    wsServer.emit("product-updated");

    res.send({
      message: "File(s) uploaded successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};
module.exports = {
  saveImage: ctrlWrapper(saveImage),
};
