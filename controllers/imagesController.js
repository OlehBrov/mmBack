const { prisma } = require("../config/db/dbConfig");
const { ctrlWrapper } = require("../helpers");

const { MM_HOST } = process.env;

const saveImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    await prisma.Products.update({
      where: {
        barcode: req.body.fileName,
      },
      data: {
        product_image: `${MM_HOST}/api/product-image/${req.file.filename}`,
      },
    });
    res.send({
      message: "File uploaded successfully",
      filename: req.file.filename,
    });
  } catch (error) {
    res.status(500).send("Error uploading file.");
  }
};

module.exports = {
  saveImage: ctrlWrapper(saveImage),
};
