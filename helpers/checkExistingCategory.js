const { prisma } = require("../config/db/dbConfig");

const checkExistingCategory = async (categoryId, subcategoryId) => {

  const exists = await prisma.Subcategories.findFirst({
    where: {
      AND: [
        {
          subcat_1C_id: {
            equals: subcategoryId,
          },
        },
        {
          category_ref_1C: {
            equals: categoryId,
          },
        },
      ],
    },
  });

  return exists;
};
module.exports = checkExistingCategory;
