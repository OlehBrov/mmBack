const { prisma } = require("../config/db/dbConfig");
const fs = require("fs/promises");
const path = require("path");
const { checkIdleFrontStatus } = require("../socket/heartbeat");
const subcatsTempUpdatesPath = path.join(
  __dirname,
  "..",
  "data",
  "tempSubcatMoveData.json"
);

const saveTempFileSubcategoryMoveData = async (tempData) => {
  console.log("saveTempFileProductsData invoke");
  try {
    const tempFileData = JSON.parse(
      await fs.readFile(subcatsTempUpdatesPath, "utf-8")
    );
    const updatedFile = [...tempFileData, ...tempData];
    await fs.writeFile(
      subcatsTempUpdatesPath,
      JSON.stringify(updatedFile, null, 2)
    );
    checkIdleFrontStatus();
    return true;
  } catch (error) {
    console.log("saveTempFileProductsData error", error);
    return error;
  }
};
module.exports = saveTempFileSubcategoryMoveData;
