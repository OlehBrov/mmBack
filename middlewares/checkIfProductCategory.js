const { prisma } = require("../config/db/dbConfig");
const { httpError } = require("../helpers");

const checkIfProductCategory = async (req, res, next) => {
  try {
    const productsArray = req.normalizedProducts;

    const validProducts = [];
    const invalidProducts = [];

      for (const product of productsArray) {
          const catId = parseInt(product.product_category)
          const subcatId = parseInt(product.product_subcategory)
      try {
        const categoryExists = await prisma.Categories.findUnique({
          where: { cat_1C_id: catId },
        });
        const subcategoryExists = await prisma.Subcategories.findUnique({
          where: { subcat_1C_id: subcatId },
        });

        if (categoryExists && subcategoryExists) {
          validProducts.push(product);
        } else {
          invalidProducts.push(product);
        }
      } catch (error) {
        return res
          .status(500)
          .json({ error: "Error checking product categories", details: error });
      }
    }

    // Attach the arrays to req for use in the controller
    req.validProducts = validProducts;
    req.invalidProducts = invalidProducts;

    next(); // Pass control to the next middleware or controller
  } catch (error) {
    httpError(409, "Error with checkIfProductCategory middleware");
  }
};
module.exports = checkIfProductCategory;
