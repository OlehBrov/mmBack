// const { sqlPool } = require("../config/connectSQL");
const path = require("path");
const fs = require("fs/promises");
const { ctrlWrapper } = require("../helpers");
const { json } = require("express");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");
const moment = require("moment");
const { equal, when } = require("joi");

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

// const addProducts = async (req, res, next) => {
//   // const { manager } = req;
//   // if (!manager) return next(httpError(401));
//   const formattedDate = moment().toISOString(true);
//   const products = req.body;

//   try {
//     const existingProducts = await prisma.products.findMany({
//       where: {
//         barcode: { in: products.map((p) => p.barcode) },
//       },
//     });

//     const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));
//     const productsToUpdate = [];
//     const productsToCreate = [];

//     products.forEach((product) => {
//       if (existingBarcodes.has(product.barcode)) {
//         productsToUpdate.push(product);
//       } else {
//         productsToCreate.push(product);
//       }
//     });
//     //Add data about withdraw in RemoveProducts, update LoadProducts to make lot inactive and left products 0
//     const withdrawPromices = productsToUpdate.map(async (product) => {
//       const withdrawProduct = await prisma.products.findUnique({
//         where: {
//           barcode: product.barcode,
//         },
//       });

//       if (withdrawProduct.products_left > 0) {
//         await prisma.RemoveProducts.create({
//           data: {
//             product_id: withdrawProduct.id,
//             remove_date: formattedDate,
//             remove_quantity: withdrawProduct.product_left,
//             remove_type_id: 3,
//             isActive: 0,
//             load_id: withdrawProduct.product_lot || "",
//           },
//         });

//         await prisma.LoadProducts.update({
//           where: {
//             id: withdrawProduct.product_lot,
//           },
//           data: {
//             lotIsActive: false,
//             products_left: 0,
//           },
//         });
//       }
//     });

//     await Promise.all([...withdrawPromices]);

//     //Create not existing products
//     const createPromises = productsToCreate.map((product) =>
//       prisma.products.create({
//         data: {
//           product_name: product.product_name,
//           barcode: product.barcode,
//           measure: product.measure,
//           product_name_ua: product.product_name_ua,
//           product_category: product.product_category,
//           product_subcategory: product.product_subcategory,
//           product_left: product.product_left,
//           image: product.image,
//           product_description: product.product_description || "",
//           exposition_term: product.exposition_term || "",
//           sale_id: product.sale_id || 0,
//           price: product.price,
//         },
//       })
//     );

//     await Promise.all([...createPromises]);

//     //Update data about existing products
//     const updatePromices = productsToUpdate.map((product) => {
//       prisma.products.update({
//         where: { barcode: product.barcode },
//         data: {
//           product_name: product.product_name,

//           measure: product.measure,
//           product_name_ua: product.product_name_ua,
//           product_category: product.product_category,
//           product_subcategory: product.product_subcategory,

//           image: product.image,
//           description: product.description || "",
//           exposition_term: product.exposition_term || "",
//           sale_id: product.sale_id || 0,
//           price: product.price,
//         },
//       });
//     });
//     await Promise.all([...updatePromices]);

//     //Update data about loading new products and quantity
//     const updateLoadData = products.map(async (product) => {
//       const updateProduct = await prisma.products.findUnique({
//         where: {
//           barcode: product.barcode,
//         },
//       });
//       await prisma.LoadProducts.create({
//         data: {
//           product_id: updateProduct.id,
//           load_date: formattedDate,
//           load_quantity: product.load_quantity,
//           lotIsActive: true,
//           products_left: product.load_quantity,
//           sale_id: product.sale_id || 0,
//           child_product_barcode: product.child_product_barcode || null,
//         },
//       });
//       if (product.sale_id !== 0) {
//         const childProduct = await prisma.products.findUnique({
//           where: {
//             barcode: product.child_product_barcode,
//           },
//         });

//         await prisma.ComboProducts.update({
//           where: {
//             AND: [
//               {
//                 main_product_id: {
//                   equals: updateProduct.id,
//                 },
//               },
//               {
//                 isActive: {
//                   equals: 1,
//                 },
//               },
//             ],
//           },
//           data: {
//             isActive: 0,
//           },
//         });

//         await prisma.ComboProducts.create({
//           data: {
//             main_product_id: updateProduct.id,
//             child_product_id: childProduct.id,
//             isActive: 1,
//           },
//         });
//       }
//     });
//     await Promise.all([...updateLoadData]);

//     //Final product update with lot_id
//     const finalUpdate = products.map(async (product) => {
//       const finalProduct = await prisma.products.findUnique({
//         where: {
//           barcode: product.barcode,
//         },
//       });

//       const loadData = await prisma.LoadProducts.findUnique({
//         where: {
//           AND: [
//             {
//               product_id: {
//                 equals: finalProduct.id,
//               },
//             },
//             {
//               lotIsActive: {
//                 equals: true,
//               },
//             },
//           ],
//         },
//       });

//       await prisma.products.update({
//         where: {
//           id: finalProduct,
//         },
//         data: {
//           product_lot: loadData.id,
//         },
//       });
//     });
//     await Promise.all([...finalUpdate]);
//     res.json({
//       message: "Products processed successfully",
//       existing: {
//         message: `Found ${productsToUpdate.length} already existing products, not added`,
//         data: productsToUpdate,
//       },
//       created: {
//         message: `Added ${productsToCreate.length} products`,
//       },
//     });
//   } catch (error) {
//     console.error("Error processing products:", error);
//     next(httpError(500, "An error occurred while processing products"));
//   }
// };
const addProducts = async (req, res, next) => {
  const formattedDate = moment().toISOString(true);
  const products = req.body;

  try {
    const existingProducts = await prisma.products.findMany({
      where: { barcode: { in: products.map((p) => p.barcode) } },
    });

    const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));
    const productsToUpdate = products.filter((product) =>
      existingBarcodes.has(product.barcode)
    );
    const productsToCreate = products.filter(
      (product) => !existingBarcodes.has(product.barcode)
    );

    // Withdraw existing products
    await Promise.all(
      productsToUpdate.map(async (product) => {
        const withdrawProduct = await prisma.products.findUnique({
          where: { barcode: product.barcode },
        });

        if (withdrawProduct.product_left > 0) {
          await prisma.$transaction([
            prisma.RemoveProducts.create({
              data: {
                product_id: withdrawProduct.id,
                remove_date: formattedDate,
                remove_quantity: withdrawProduct.product_left,
                remove_type_id: 3,
                isActive: false,
                load_id: withdrawProduct.product_lot || "",
              },
            }),
            prisma.LoadProducts.update({
              where: { id: withdrawProduct.product_lot },
              data: { lotIsActive: false, products_left: 0 },
            }),
          ]);
        }
      })
    );

    // Create new products
    await prisma.$transaction(
      productsToCreate.map((product) =>
        prisma.products.create({
          data: {
            product_name: product.product_name,
            barcode: product.barcode,
            measure: product.measure,
            product_name_ua: product.product_name_ua,
            product_category: product.product_category,
            product_subcategory: product.product_subcategory,
            product_left: product.product_left,
            image: product.image,
            product_description: product.product_description || "",
            exposition_term: product.exposition_term || "",
            sale_id: product.sale_id || 0,
            price: product.price,
          },
        })
      )
    );

    // Update existing products
    await prisma.$transaction(
      productsToUpdate.map((product) =>
        prisma.products.update({
          where: { barcode: product.barcode },
          data: {
            product_name: product.product_name,
            measure: product.measure,
            product_name_ua: product.product_name_ua,
            product_category: product.product_category || null,
            product_subcategory: product.product_subcategory,
            image: product.image,
            description: product.description || "",
            exposition_term: product.exposition_term || "",
            sale_id: product.sale_id || 0,
            price: product.price,
          },
        })
      )
    );

    // Add load entries and create combo products
    await prisma.$transaction(
      products.map(async (product) => {
        const updateProduct = await prisma.products.findUnique({
          where: { barcode: product.barcode },
        });

        await prisma.LoadProducts.create({
          data: {
            product_id: updateProduct.id,
            load_date: formattedDate,
            load_quantity: product.load_quantity,
            lotIsActive: true,
            products_left: product.load_quantity,
            sale_id: product.sale_id || 0,
            child_product_barcode: product.child_product_barcode || null,
          },
        });

        if (product.sale_id !== 0) {
          const childProduct = await prisma.products.findUnique({
            where: { barcode: product.child_product_barcode },
          });

          await prisma.$transaction([
            prisma.ComboProducts.updateMany({
              where: {
                main_product_id: updateProduct.id,
                isActive: true,
              },
              data: { isActive: false },
            }),
            prisma.ComboProducts.create({
              data: {
                main_product_id: updateProduct.id,
                child_product_id: childProduct.id,
                isActive: true,
              },
            }),
          ]);
        }
      })
    );

    // Final product update with lot_id
    await prisma.$transaction(
      products.map(async (product) => {
        const finalProduct = await prisma.products.findUnique({
          where: { barcode: product.barcode },
        });

        const loadData = await prisma.LoadProducts.findFirst({
          where: { product_id: finalProduct.id, lotIsActive: true },
        });

        if (loadData) {
          await prisma.products.update({
            where: { id: finalProduct.id },
            data: { product_lot: loadData.id },
          });
        }
      })
    );

    res.json({
      message: "Products processed successfully",
      existing: `Found ${productsToUpdate.length} already existing products, not added`,
      created: `Added ${productsToCreate.length} products`,
    });
  } catch (error) {
    console.error("Error processing products:", error);
    next(httpError(500, "An error occurred while processing products"));
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
  searchProducts: ctrlWrapper(searchProducts),
  getProductById: ctrlWrapper(getProductById),
  addProducts: ctrlWrapper(addProducts),
};
