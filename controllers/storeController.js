// const { sqlPool } = require("../config/connectSQL");
const path = require("path");
const fs = require("fs/promises");
const { ctrlWrapper } = require("../helpers");
const { json } = require("express");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

const dataPath = path.join(__dirname, "..", "data", "faker.json");
// console.log("index --- js");
// console.log(dataPath);
// fs.readFile('./data/test.json').then(data=> console.log(data.toString()))

// const getAllStoreProducts = async (req, res, next) => {
//   const { store_id } = req.store;
//   const { page, filter = 0 } = req.query;
//   const limit = 10;
//   const skip = (page - 1) * limit;
//   try {
//     let productWhereClause = {
//       store_id: store_id,
//     };

//     // If filter is provided (filter !== 0), update the where clause to filter by category
//     if (filter !== 0) {
//       productWhereClause.Products = {
//         ProductCategories: {
//           some: {
//             category_id: parseInt(filter), // Filter by the provided category_id
//           },
//         },
//       };
//     }
//     console.log('Filter:', filter, 'Store ID:', store_id);
//     const [allProducts, productsCount, distinctCategories] =
//       await prisma.$transaction([
//         prisma.ProductsOnStore.findMany({
//           where: productWhereClause,
//           skip: skip,
//           take: limit,
//           include: {
//             Products: {
//               include: {
//                 ProductCategories: {
//                   include: { Categories: true },
//                 },
//               },
//             },
//           },
//         }),
//         prisma.ProductsOnStore.count({
//           where: productWhereClause, // Apply the same filter to count the filtered products
//         }),
//         // prisma.products.count(),
//         prisma.ProductCategories.findMany({
//           where: {
//             product_id: {
//               in: await prisma.ProductsOnStore.findMany({
//                 where: { store_id: store_id },
//                 select: { product_id: true }, // Only fetch product IDs for this store
//               }).then((products) => products.map((p) => p.product_id)),
//             },
//           },
//           select: {
//             category_id: true,
//             Categories: true, // Include category details (like category name)
//           },
//           distinct: ["category_id"], // Ensure distinct categories
//         }),
//       ]);
//     if (!allProducts.length) {
//       return res.status(200).json({
//         message: `No products for store ID ${store_id} `,
//       });
//     }
//     if (allProducts && productsCount) {
//       console.log("allProducts && productsCount");
//       return res.status(200).json({
//         message: `Producs for store ID ${store_id} `,
//         data: allProducts,
//         categories: distinctCategories,
//         qty: productsCount,
//       });
//     } else {
//       console.log("error 01");
//       return next(httpError(401));
//     }
//   } catch (error) {
//     console.log("error 02", error);
//     return next(httpError(401));
//   }
// };
const getAllStoreProducts = async (req, res, next) => {
  const { store_id } = req.store;
  const { page, filter } = req.query;
  const limit = 10

  const skip = (parseInt(page) - 1) * limit;

  const categoryFilter = parseInt(filter)

  try {
    // Log the incoming filter and store ID for debugging
    console.log('categoryFilter:', categoryFilter, 'Store ID:', store_id);

    // Base query to find products in the store
    let productWhereClause = {
      store_id: store_id,
    };
console.log('categoryFilter !== 0', categoryFilter !== 0)
    // If filter is provided (filter !== 0), update the where clause to filter by category
    if (categoryFilter !== 0) {
      // First, find all product_ids that belong to the given category_id (filter)
      const productIdsInCategory = await prisma.ProductCategories.findMany({
        where: {
          category_id: categoryFilter, // Filter by the provided category_id
        },
        select: {
          product_id: true, // Only select product_id
        },
      }).then((result) => result.map((r) => r.product_id)); // Get list of product_ids

      // Log the filtered product IDs for debugging
     

      // If there are no products in the category, return an empty response
      if (productIdsInCategory.length === 0) {
        return res.status(200).json({
          message: `No products found for category ${filter}`,
          products: [],
          totalProducts: 0,
          categories: [],
        });
      }

      // Add the product_id filter to the query
      productWhereClause.product_id = { in: productIdsInCategory };
    }

    // Fetch products from the store
    const allProducts = await prisma.ProductsOnStore.findMany({
      where: productWhereClause, // Apply the filter condition dynamically
      skip: skip,
      take: limit,
      include: {
        Products: {
          include: {
            ProductCategories: {
              include: { Categories: true }, // Fetch related categories
            },
          },
        },
      },
    });

    // Count total products with the filter
    const productsCount = await prisma.ProductsOnStore.count({
      where: productWhereClause, // Apply the same filter to count the filtered products
    });

    // Fetch distinct categories for the products
    const distinctCategories = await prisma.ProductCategories.findMany({
      where: {
        product_id: {
          in: allProducts.map((p) => p.product_id),
        },
      },
      select: {
        category_id: true,
        Categories: true, // Include category details like category_name
      },
      distinct: ['category_id'], // Ensure distinct categories
    });

    // If no products found
    if (!allProducts.length) {
      return res.status(200).json({
        message: `No products for store ID ${store_id}`,
      });
    }

    // Return response
    res.status(200).json({
      products: allProducts,
      totalProducts: productsCount,
      categories: distinctCategories,
    });
  } catch (error) {
    console.error('Error fetching store products:', error);
    next(error);
  }
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
};
