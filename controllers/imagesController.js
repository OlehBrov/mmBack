const { prisma } = require("../config/db/dbConfig");
const { ctrlWrapper } = require("../helpers");
const fs = require("fs");
const path = require("path");
const { wsServer } = require("../socket/heartbeat");
const { MM_HOST } = process.env;
const imagesDir = process.env.IMAGE_DIR;
// const saveImage = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).send("No file uploaded.");
//     }

//     await prisma.Products.update({
//       where: {
//         barcode: req.body.fileName,
//       },
//       data: {
//         product_image: `${MM_HOST}/api/product-image/${req.file.filename}`,
//       },
//     });
//     res.send({
//       message: "File uploaded successfully",
//       filename: req.file.filename,
//     });
//   } catch (error) {
//     res.status(500).send("Error uploading file.");
//   }
// };
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
const barcodeFromFilename = (string) => {
  return string.slice(0, string.lastIndexOf("."));
};

const saveImage = async (req, res) => {
  try {
    const imageData = req.body; // Expecting an array of objects

    // const { productImage, fileName } = imageData;
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

      await prisma.Products.update({
        where: {
          barcode: barcode,
        },
        data: {
          product_image: `${MM_HOST}/api/product-image/${fileName}`,
        },
      });
    }

    wsServer.emit("product-updated");

    res.send({
      message: "File uploaded successfully",
      filename: fileName,
    });
    // res.status(200).json({ message: "Images uploaded successfully!" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};
module.exports = {
  saveImage: ctrlWrapper(saveImage),
};
