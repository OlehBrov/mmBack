// const { sqlPool } = require("../config/connectSQL");
const path = require("path");
const fs = require("fs/promises");
const { ctrlWrapper, updateProductLoadLots } = require("../helpers");
const { json } = require("express");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");
const { MM_HOST } = process.env;
const moment = require("moment");
const { equal, when } = require("joi");
const { wsServer, checkIdleFrontStatus } = require("../socket/heartbeat");
const { some } = require("bluebird");
const imagesDir = process.env.IMAGE_DIR;
const dataPath = path.join(__dirname, "..", "data", "faker.json");
const productsTempUpdatesPath = path.join(
  __dirname,
  "..",
  "data",
  "tempProductUpdateData.json"
);

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
        LoadProducts_LoadProducts_product_idToProducts: {
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
const getSingleProduct = async (req, res, next) => {
  const { barcode } = req.query;

  const product = await prisma.Products.findUnique({
    where: {
      barcode,
    },
  });

  if (!product) {
    return res.status(404).json({
      message: "No such product found",
      errStatus: 404,
    });
  }
  return res.status(200).json({
    product,
  });
};
const searchProducts = async (req, res, next) => {
  const { auth_id } = req.store;
  const { searchQuery } = req.query;
  // console.log("searchQuery", searchQuery);
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

const addProducts = async (req, res, next) => {
  const formattedDate = moment().toISOString(true);
  const validDateTime = moment(formattedDate).format("YYYY-MM-DDTHH:mm:ss.SSS");
  console.log("validDateTime", validDateTime);
  const dateTime = moment().toISOString(true);
  const { validProducts: products, invalidProducts, abNormalProducts } = req;

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
    if (productsToCreate.length) {
      const imageExtensions = [".jpg", ".jpeg", ".webp", ".png"]; // Supported image extensions

      //`${MM_HOST}/api/product-image/${fileName}`

      const productsWithImagePath = await Promise.all(
        productsToCreate.map(async (product) => {
          if (product.product_image && product.product_image !== "") {
            return product;
          }
          let imagePath = `${MM_HOST}/api/product-image/default-product.jpg`;
          for (const ext of imageExtensions) {
            const fullPath = path.join(imagesDir, `${product.barcode}${ext}`);
            console.log("fullPath", fullPath);
            try {
              await fs.access(fullPath); // If file exists, fs.access will not throw an error
              imagePath = `${MM_HOST}/api/product-image/${product.barcode}${ext}`;
              console.log("imagePath in loop", imagePath);
              break; // Exit the loop if image is found
            } catch (err) {
              // Do nothing, try next extension
              console.log('fs.access err', err)
            }
          }
          console.log("imagePath after loop", imagePath);
          return {
            ...product,
            product_image: imagePath,
          };
        })
      );
      console.log("productsWithImagePath", productsWithImagePath);
      // Create new products
      await prisma.$transaction(
        productsWithImagePath.map((product) => {
          console.log("productsWithImagePath product", product);
          return prisma.products.create({
            data: {
              product_name: product.product_name,
              barcode: product.barcode,
              measure: product.measure,
              product_code: product.product_code,
              product_name_ua: product.product_name_ua,
              product_category: product.product_category,
              product_subcategory: product.product_subcategory,
              product_left: product.product_left,
              product_image: product.product_image,
              product_description: product.product_description || "",
              exposition_term: product.exposition_term || "",
              sale_id: product.sale_id || 0,
              product_price: product.product_price,
              combo_id: null,
            },
          });
        })
      );
    }
    // Update existing products

    await prisma.$transaction(
      productsToUpdate.map((product) => {
        return prisma.Products.update({
          where: { barcode: product.barcode },
          data: {
            product_name: product?.product_name,
            measure: product?.measure,
            product_code: product?.product_code,
            product_name_ua: product?.product_name_ua,
            product_category: product?.product_category,
            product_subcategory: product?.product_subcategory,
            product_left: product.product_left,
            product_image: product?.product_image,
            product_description: product?.product_description || null,
            exposition_term: product?.exposition_term || null,
            sale_id: product?.sale_id || 0,
            product_price: product?.product_price,
            combo_id: null,
          },
        });
      })
    );

    const productsWithId = await Promise.all(
      products.map(async (product) => {
        const updateProduct = await prisma.products.findUnique({
          where: { barcode: product.barcode },
        });

        return {
          ...product,
          id: updateProduct.id, // add the `id` from the database to the product
        };
      })
    );
    // Add load entries and create combo products
    await prisma.$transaction(
      productsWithId.map((productWithId) => {
        return prisma.LoadProducts.create({
          data: {
            product_id: productWithId.id,
            load_date: formattedDate,
            load_quantity: productWithId.product_left,
            lotIsActive: true,
            products_left: productWithId.product_left,
            sale_id: productWithId.sale_id || 0,
            child_product_barcode: productWithId.child_product_barcode || null,
            load_date_time: `${validDateTime}+00:00`,
          },
        });
      })
    );
    const productsWithComboBarcode = productsWithId.filter((product) => {
      return product.sale_id === 7;
    });

    if (productsWithComboBarcode.length > 0) {
      const productsWithComboProducts = await Promise.all(
        productsWithComboBarcode.map(async (product) => {
          const childProduct = await prisma.products.findUnique({
            where: { barcode: product.child_product_barcode },
          });

          return {
            ...product,
            child_id: childProduct.id, // add the `id` from the database to the product
          };
        })
      );

      await prisma.$transaction(async (tx) => {
        for (const productWCombo of productsWithComboProducts) {
          await tx.ComboProducts.updateMany({
            where: {
              main_product_id: productWCombo.id,
              isActive: true,
            },
            data: { isActive: false },
          });
          const combo = await tx.ComboProducts.create({
            data: {
              main_product_id: productWCombo.id,
              child_product_id: productWCombo.child_id,
              isActive: true,
            },
          });
          await tx.products.update({
            where: {
              id: productWCombo.id,
            },
            data: {
              combo_id: combo.id,
            },
          });
        }
      });
    }
    //

    // Final product update with lot_id
    await prisma.$transaction(async (tx) => {
      for (const product of productsWithId) {
        const loadData = await tx.LoadProducts.findMany({
          where: { product_id: product.id, lotIsActive: true },
          orderBy: {
            load_date_time: {
              sort: "desc",
              nulls: "last",
            },
          },
        });
        const sumData = await tx.LoadProducts.aggregate({
          where: { product_id: product.id, lotIsActive: true },
          _sum: {
            products_left: true,
          },
        });

        if (loadData) {
          console.log("sumData in update if", sumData);
          await tx.products.update({
            where: { id: product.id },
            data: {
              product_lot: loadData[0].id,
              product_left: sumData._sum.products_left,
            },
          });
        }
      }
    });
    wsServer.emit("product-updated");
    res.json({
      message: "Products processed successfully",
      existing: `Found ${productsToUpdate.length} already existing products, updated`,
      created: `Added ${productsToCreate.length} new products`,
      invalidCategory: invalidProducts,
      notAdded: `Not added ${invalidProducts.length} products due to invalid category or subcatefory (category or subcatefory not exist)`,
      failedToConvert: abNormalProducts,
    });
  } catch (error) {
    console.error("Error processing products:", error);
    next(httpError(500, "An error occurred while processing products"));
  }
};
const withdrawProducts = async (req, res, next) => {
  const formattedDate = moment().toISOString(true);
  const validDateTime = moment(formattedDate).format(
    "YYYY-MM-DDTHH:mm:ss.SSS+00:00"
  );
  const products = req.body;
  console.log("products", products);
  if (!products.length) {
    res.status(204).json({
      message: "No products provided",
    });
  }
  try {
    const existingProducts = await prisma.products.findMany({
      where: { barcode: { in: products.map((p) => p.barcode) } },
    });

    const proceedProducts = existingProducts.map((prod) => {
      const decrementValue = products.find((p) => {
        return p.barcode === prod.barcode;
      });
      return {
        ...prod,
        decrement: decrementValue.quantity,
        limit: decrementValue.limit,
      };
    });

    const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));
    const productsToWithdraw = proceedProducts.filter((product) =>
      existingBarcodes.has(product.barcode)
    );
    const productsNotExist = products.filter(
      (product) => !existingBarcodes.has(product.barcode)
    );
    const productsNoQuantity = [];
    const productsHasQuantity = [];
    // console.log("productsToWithdraw", productsToWithdraw);

    for (const prod of productsToWithdraw) {
      prod.product_left > 0
        ? productsHasQuantity.push(prod)
        : productsNoQuantity.push(prod);
    }

    if (!productsHasQuantity.length) {
      res.status(204).json({
        message: "Provided products already left 0",
      });
    }
    // console.log("productsHasQuantity", productsHasQuantity);
    await prisma.$transaction(async (tx) => {
      for (const product of productsHasQuantity) {
        const withdrawProduct = await tx.products.findUnique({
          where: { barcode: product.barcode },
        });

        const withdrawProductLots = await tx.LoadProducts.findMany({
          where: {
            AND: [
              {
                product_id: { equals: product.id },
              },
              {
                lotIsActive: {
                  equals: true,
                },
              },
            ],
          },
          orderBy: {
            load_date_time: {
              sort: "asc",
              nulls: "first",
            },
          },
        });

        const lotsUpdateData = updateProductLoadLots(
          product,
          withdrawProductLots
        );
        // console.log("lotsUpdateData", lotsUpdateData);
        if (lotsUpdateData.length) {
          for (const lot of lotsUpdateData) {
            console.log("const lot of lotsUpdateData", lot);
            await tx.LoadProducts.update({
              where: {
                id: lot.id,
              },
              data: {
                product_id: lot.product_id,
                load_date: lot.load_date,
                load_quantity: lot.load_quantity,
                lotIsActive: lot.lotIsActive ? true : false,
                products_left: lot.products_left,
                sale_id: lot.sale_id,
                child_product_barcode: lot.child_product_barcode,
                load_date_time: lot.load_date_time,
              },
            });

            await tx.RemoveProducts.create({
              data: {
                product_id: withdrawProduct.id,
                remove_date: validDateTime,
                remove_quantity: lot.decrementAmount,
                remove_type_id: 3,
                isActive: false,
                load_id: lot.id || null,
              },
            });
          }
        }
        if (withdrawProduct && withdrawProduct.product_left > 0) {
          // await tx.RemoveProducts.create({
          //   data: {
          //     product_id: withdrawProduct.id,
          //     remove_date: validDateTime,
          //     remove_quantity: withdrawQuantity,
          //     remove_type_id: 3,
          //     isActive: false,
          //     load_id: withdrawProduct.product_lot || "",
          //   },
          // });
          // if (withdrawProduct.product_lot) {
          //   await tx.LoadProducts.update({
          //     where: { id: withdrawProduct.product_lot },
          //     data: { lotIsActive: false, products_left: 0 },
          //   });
          // }
        }

        if (withdrawProduct.combo_id) {
          await tx.Products.update({
            where: {
              id: withdrawProduct.id,
            },
            data: {
              combo_id: null,
            },
          });
          await tx.ComboProducts.deleteMany({
            where: {
              main_product_id: withdrawProduct.id,
            },
          });
        }
        const sumData = await tx.LoadProducts.aggregate({
          where: { product_id: product.id, lotIsActive: true },
          _sum: {
            products_left: true,
          },
        });

        const activeLots = await tx.LoadProducts.findMany({
          where: {
            AND: [
              {
                product_id: {
                  equals: withdrawProduct.id,
                },
              },
              {
                lotIsActive: {
                  equals: true,
                },
              },
            ],
          },
          orderBy: {
            load_date_time: {
              sort: "desc",
              nulls: "last",
            },
          },
        });
        console.log("activeLots", activeLots);
        await tx.Products.update({
          where: {
            id: withdrawProduct.id,
          },
          data: {
            product_left: sumData._sum.products_left
              ? sumData._sum.products_left
              : 0,
            product_lot: activeLots[0]?.id || null,
          },
        });
      }
    });
    wsServer.emit("product-updated");
    res.json({
      message: "Products deleted successfully",
      updated: `Deleted ${productsToWithdraw.length} products`,
      noExist: `Not deleted ${productsNotExist.length} products, as products not exist`,
      nonExistingProducts: productsNotExist,
    });
  } catch (error) {
    console.error("Error processing products:", error);
    next(httpError(500, "An error occurred while processing products"));
  }
};

const updateProducts = async (req, res) => {
  const possibleUpdateKeys = [
    "product_name",
    "product_code",
    "measure",
    "product_name_ru",
    "product_name_ua",
    "product_description",
    "product_image",
    "product_price",
    "product_discount",
    "exposition_term",
    "sale_id",
    "discount_price_1",
    "discount_price_2",
    "discount_price_3",
    "combo_id",
    "product_category",
    "product_subcategory",
  ];
  try {
    const productsData = req.body;

    const noBarcode = productsData.filter(
      (prod) => prod.barcode === "" || !prod.barcode
    );

    if (noBarcode.length > 0) {
      res.status(400).json({
        message: "Barcode must be provided to each product",
      });
    }

    const formattedUpdateData = productsData.map((product) => {
      const { barcode, ...rest } = product;
      const keysNumber = Object.keys(rest).length;
      const filtered = Object.keys(rest).filter((key) =>
        possibleUpdateKeys.includes(key)
      );
      if (keysNumber !== filtered.length)
        throw Error(
          `Not valid keys passed. Possible keys to update: ${possibleUpdateKeys}`
        );
      return {
        barcode,
        data: rest,
      };
    });

    await saveTempFileProductsData(formattedUpdateData);

    res.status(201).json({
      message: "Data will be sent to db",
    });
  } catch (error) {
    console.log("updateProducts error", error);
    res.status(400).json({ error: error.message });
  }
};

const saveTempFileProductsData = async (tempData) => {
  console.log("saveTempFileProductsData invoke");
  try {
    const tempFileData = JSON.parse(
      await fs.readFile(productsTempUpdatesPath, "utf-8")
    );
    const updatedFile = [...tempFileData, ...tempData];
    await fs.writeFile(
      productsTempUpdatesPath,
      JSON.stringify(updatedFile, null, 2)
    );
    checkIdleFrontStatus();
    return true;
  } catch (error) {
    console.log("saveTempFileProductsData error", error);
    return error;
  }
};

const sendTempDataToDB = async () => {
  try {
  } catch (error) {}
};

// const updateFileData = async (path, data) => {
//   try {
//     const fileData = JSON.parse(await fs.readFile(dataPath, "utf-8"));
//     const updatedData = [...fileData, data];
//     return await createFileData(dataPath, updatedData);
//   } catch (error) {}
// };

module.exports = {
  // readFileData: ctrlWrapper(readFileData),
  // updateFileData: ctrlWrapper(updateFileData),
  getAllStoreProducts: ctrlWrapper(getAllStoreProducts),
  searchProducts: ctrlWrapper(searchProducts),
  getProductById: ctrlWrapper(getProductById),
  addProducts: ctrlWrapper(addProducts),
  withdrawProducts: ctrlWrapper(withdrawProducts),
  getSingleProduct: ctrlWrapper(getSingleProduct),
  updateProducts: ctrlWrapper(updateProducts),
};
