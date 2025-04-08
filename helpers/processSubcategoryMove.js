const { prisma } = require("../config/db/dbConfig");
const fs = require("fs/promises");
const path = require("path");

const subcatsTempUpdatesPath = path.join(
  __dirname,
  "..",
  "data",
  "tempSubcatMoveData.json"
);
const processSubcategoryMove = async () => {
  const tempFileData = JSON.parse(
    await fs.readFile(subcatsTempUpdatesPath, "utf-8")
  );
  console.log("processSubcategoryMove");
  console.log("tempFileData processSubcategoryMove", tempFileData);
  if (tempFileData.length === 0) {
    return;
  }
  for (const tempItem of tempFileData) {
    const { cat_1C_id, subcat_1C_id, new_cat_1C_id, subcat_name } = tempItem;
    const existingSubcategory = await prisma.Subcategories.findFirst({
      where: {
        subcat_1C_id: subcat_1C_id,
        category_ref_1C: cat_1C_id,
      },
    });
    const newSubcatName = subcat_name.trim()
      ? subcat.subcat_name.trim()
      : existingSubcategory.subcategory_name;

    await prisma.Subcategories.update({
      where: {
        subcat_1C_id: subcat_1C_id,
      },
      data: {
        Categories_Subcategories_category_ref_1CToCategories: {
          connect: { cat_1C_id: new_cat_1C_id },
        },
        subcategory_name: newSubcatName,
      },
    });
  }
  const clearArray = [];
  await fs.writeFile(
    subcatsTempUpdatesPath,
    JSON.stringify(clearArray, null, 2)
  );
};

module.exports = processSubcategoryMove;
