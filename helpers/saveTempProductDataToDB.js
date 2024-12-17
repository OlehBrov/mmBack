const { prisma } = require("../config/db/dbConfig");
const { wsServer } = require("../socket/heartbeat");
const path = require("path");
const fs = require("fs/promises");
const productsTempUpdatesPath = path.join(
  __dirname,
  "..",
  "data",
  "tempProductUpdateData.json"
);
const saveTempProductDataToDB = async () => {
  console.log("inside saveTempProductDataToDB invoke");
  try {
    const tempFileData = JSON.parse(
      await fs.readFile(productsTempUpdatesPath, "utf-8")
    );
    console.log("tempFileData", tempFileData);

    const updateProducts = tempFileData.map((product) => {
      return prisma.products.update({
        where: { barcode: product.barcode },
        data: product.data,
      });
    });

    await prisma.$transaction(updateProducts);
    const clearArray = [];
    await fs.writeFile(
      productsTempUpdatesPath,
      JSON.stringify(clearArray, null, 2)
    );
  } catch (error) {
    console.log("saveTempProductDataToDB error", error);
  }

  // socket.on("screen-status", (status) => {
  //   console.log("on status", status);
  // });
};

module.exports = saveTempProductDataToDB;
