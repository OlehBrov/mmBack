// const { sqlPool } = require("../config/connectSQL");
const path = require("path");
const fs = require("fs/promises");
const { ctrlWrapper } = require("../helpers");
const { json } = require("express");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

const dataPath = path.join(__dirname, "..", "data", "faker.json");

const getAllStoreProducts = async (req, res, next) => {
  const { auth_id } = req.store;
  const { filter, subcategory } = req.query;

  // const limit = parseInt(size);
  // const skip = (parseInt(page) - 1) * limit;

  const categoryFilter = parseInt(filter);
  const subcategoryFilter = parseInt(subcategory);

  try {
    // Base where clause, ensuring products with quantity greater than 0
    let whereClause = {
      product_left: {
        not: null,
        gt: 0,
      },
    };

    // Apply category filter if provided
    if (categoryFilter !== 0) {
      whereClause.product_category = categoryFilter;
    }

    // Apply subcategory filter if provided and not equal to 0
    if (subcategoryFilter !== 0) {
      whereClause.product_subcategory = subcategoryFilter;
    }

    // Fetch filtered products
    const filteredProducts = await prisma.Products.findMany({
      where: whereClause,
      // skip: skip,
      // take: limit,
      include: {
        Categories: true,
        Subcategories: true,
        Sales: true,
        LoadProducts: {
          select: { load_date: true },
        },

        ComboProducts_Products_combo_idToComboProducts: {
          include: {
            Products_ComboProducts_child_product_idToProducts: {
              select: {
                product_left: true, // Include only the 'product_left' column for the child product
              },
            },
          },
        },
      },
    });

    // Count total filtered products
    const productsCount = await prisma.Products.count({
      where: whereClause,
    });

    // Fetch distinct subcategories for the selected category (or all categories if none specified)
    const distinctSubcategories = await prisma.Products.findMany({
      where: whereClause,
      select: {
        product_subcategory: true,
        Subcategories: true, // Include subcategory details
      },
      distinct: ["product_subcategory"], // Ensure distinct subcategories
    });

    let distinctCategories = [];

    // Fetch distinct categories only if subcategory === 0
    if (subcategoryFilter === 0) {
      distinctCategories = await prisma.Products.findMany({
        where: {
          product_left: {
            not: null,
            gt: 0,
          },
          product_category: categoryFilter !== 0 ? categoryFilter : undefined, // Optionally apply category filter
        },
        select: {
          product_category: true,
          Categories: true, // Include category details like category_name
        },
        distinct: ["product_category"], // Ensure distinct categories
      });
    }

    // If no products found, return a message
    if (!filteredProducts.length) {
      return res.status(200).json({
        message: `No products found for the provided filters.`,
      });
    }

    // Return the filtered products, total count, and distinct subcategories and categories
    return res.status(200).json({
      products: filteredProducts,
      totalProducts: productsCount,
      subcategories: distinctSubcategories,
      categories: categoryFilter !== 0 ? [] : distinctCategories, // Return distinct categories if subcategory === 0
    });
  } catch (error) {
    console.error("Error fetching store products:", error);
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  const { comboId } = req.query;

  const normalizedComboId = parseInt(comboId);
  const comboProduct = await prisma.ComboProducts.findUnique({
    where: {
      combo_id: normalizedComboId,
    },
    include: {
      Products_ComboProducts_child_product_idToProducts: true,
    },
  });

  console.log("getProductById", comboProduct);

  if (!comboProduct) {
    return res.status(200).json({
      message: "No child product found",
    });
  }

  return res.status(200).json({
    childProduct:
      comboProduct.Products_ComboProducts_child_product_idToProducts, // Access child product relation
  });
};

const searchProducts = async (req, res, next) => {
  const { auth_id } = req.store;
  const { searchQuery } = req.query;
  console.log("searchQuery", searchQuery);
  if (searchQuery.length < 3) {
    console.log("short request");
    return null;
  }
  const searchResults = await prisma.Products.findMany({
    where: {
      AND: [
        {
          product_name: {
            contains: searchQuery,
          },
        },
        {
          product_left: {
            not: null,
            gt: 0,
          },
        },
      ],
    },
  });
  res.status(200).json({
    searchResults,
  });
  console.log("searchResults", searchResults);
};

async function updateProductQuantities() {
  const products = await Product.find();
  for (const product of products) {
    const totalQuantity = await product.totalQuantity;
    product.quantity = totalQuantity;
    await product.save();
  }
}
const readFileData = async (req, res, next) => {
  try {
    // await updateProductQuantities()
    const results = await Product.find();
    // const readFile = await fs.readFile(dataPath, "utf-8");
    // const data = JSON.parse(readFile);
    res.json({ data: results });
  } catch (error) {
    console.log(error.message);
  }
};

const createFileData = async (filepath, data) => {
  try {
    return await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(error.message);
  }
};

const updateFileData = async (path, data) => {
  try {
    const fileData = JSON.parse(await fs.readFile(dataPath, "utf-8"));
    const updatedData = [...fileData, data];
    return await createFileData(dataPath, updatedData);
  } catch (error) {}
};

module.exports = {
  readFileData: ctrlWrapper(readFileData),
  updateFileData: ctrlWrapper(updateFileData),
  getAllStoreProducts: ctrlWrapper(getAllStoreProducts),
  searchProducts: ctrlWrapper(searchProducts),
  getProductById: ctrlWrapper(getProductById),
};
