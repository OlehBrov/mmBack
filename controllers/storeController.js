// const { sqlPool } = require("../config/connectSQL");
const path = require("path");
const fs = require("fs/promises");
const {
  ctrlWrapper,
  updateProductLoadLots,
  parceProduct,
  checkExistingCategory,
  checkNewProductKeys,
  setProductImgUrl,
  checkIfProductExist,
  checkComboProducts,
} = require("../helpers");
const { json } = require("express");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");
const { MM_HOST, STORE_AUTH_ID } = process.env;
const moment = require("moment");
const { equal, when } = require("joi");
const { wsServer, checkIdleFrontStatus } = require("../socket/heartbeat");
const { some } = require("bluebird");
const { createNewProductsSchema } = require("../validation/validation");
const { IMAGE_EXTENSIONS } = require("../constant/constants");
const imagesDir = process.env.IMAGE_DIR;
const dataPath = path.join(__dirname, "..", "data", "faker.json");
const productsTempUpdatesPath = path.join(
  __dirname,
  "..",
  "data",
  "tempProductUpdateData.json"
);

const getAllStoreProducts = async (req, res, next) => {
  const { store } = req;
  console.log("STORE", store);
  const { filter, subcategory } = req.query;

  // const limit = parseInt(size);
  // const skip = (parseInt(page) - 1) * limit;

  const categoryFilter = parseInt(filter);
  const subcategoryFilter = parseInt(subcategory);

  try {
    const { is_single_merchant, use_VAT_by_default } = store;
    const makeBasicClause = () => {
      if (is_single_merchant && !use_VAT_by_default) {
        return {
          product_left: {
            not: null,
            gt: 0,
          },
          OR: [{ excise_product: { not: true } }, { excise_product: null }],
        };
      }
      return {
        product_left: {
          not: null,
          gt: 0,
        },
      };
    };
    const whereClause = makeBasicClause();

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

    if (is_single_merchant && !use_VAT_by_default) {
      for (const product of filteredProducts) {
        if (product.sale_id === 7) {
          console.log("product", product);
          const childProduct = await prisma.products.findUnique({
            where: {
              id: product.ComboProducts_Products_combo_idToComboProducts
                .child_product_id,
            },
          });
          console.log("childProduct", childProduct);
          if (childProduct.excise_product) {
            product.sale_id = 0;
          }
        }
      }
    }
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

  const dateTime = moment().toISOString(true);
  const { validProducts: products, invalidProducts, abNormalProducts } = req;

  try {
    const existingProducts = await checkIfProductExist(products);
    console.log('existingProducts', existingProducts)
    const comboProducts = existingProducts.filter(product => product.sale_id === 7)
    console.log('comboProducts', comboProducts)
    const validComboProducts = await checkComboProducts(comboProducts);
console.log('validComboProducts', validComboProducts)
    const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));
    const productsToUpdate = products.filter((product) =>
      existingBarcodes.has(product.barcode)
    );
    const productsToCreate = products.filter(
      (product) => !existingBarcodes.has(product.barcode)
    );
    if (productsToCreate.length) {
    

      //`${MM_HOST}/api/product-image/${fileName}`

      const productsWithImagePath = await Promise.all(
        productsToCreate.map(async (product) => {
          if (product.product_image && product.product_image !== "") {
            return product;
          }

          const imageUrl = await setProductImgUrl(product);
          return {
            ...product,
            product_image: imageUrl,
          };
        })
      );

      // Create new products
      await prisma.$transaction(
        productsWithImagePath.map((product) => {
          // console.log("productsWithImagePath product", product);
          return prisma.products.create({
            data: {
              product_name: product.product_name,
              barcode: product.barcode,
              measure: product.measure,
              product_code: product.product_code,
              product_name_ua: product.product_name_ua,
              // product_category: product.product_category,
              // product_subcategory: product.product_subcategory,
              product_left: product.product_left,
              product_image: product.product_image,
              product_description: product.product_description || "",
              exposition_term: product.exposition_term || "",
              // sale_id: product.sale_id || 0,
              product_price: product.product_price,
              // combo_id: null,
              is_VAT_Excise: product.is_VAT_Excise || false,
              product_price_no_VAT: product.product_price_no_VAT || 0,
              VAT_value: product.VAT_value || 0,
              excise_value: product.excise_value || 0,
              excise_product: product.excise_product || false,
              product_category: product.product_category, // Use the foreign key directly
              product_subcategory: product.product_subcategory, // Use the foreign key directly
              sale_id: product.sale_id || null, // Use the foreign key directly
              combo_id: product.combo_id || null, // Use the foreign key directly
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
            is_VAT_Excise: product.is_VAT_Excise || false,
            product_price_no_VAT: product.product_price_no_VAT || 0,
            VAT_value: product.VAT_value || 0,
            excise_value: product.excise_value || 0,
            excise_product: product.excise_product || false,
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
          if (!productsWithComboProducts || productsWithComboProducts.length) {
            res.status(400).json({
              message:
                "When provided sale_id 7 - must be provided child_product_barcode",
            });
            return;
          }

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
          // console.log("sumData in update if", sumData);
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

  if (!products.length) {
    res.status(204).json({
      message: "No products provided",
    });
  }
  try {
    // const existingProducts = await prisma.products.findMany({
    //   where: { barcode: { in: products.map((p) => p.barcode) } },
    // });
    const existingProducts = await checkIfProductExist(products);
    if (!existingProducts.length) {
      return res.status(200).json({
        message: "No matching products found in the database",
      });
    }
    // if (
    //   existingProducts.length === 1 &&
    //   products[0].limit === "not-last"
    // ) {

    //   return res.status(200).json({
    //     message:
    //       "All provided products, exept last, have zero quantity left. With 'not-last' limit - last lot not withdraw",
    //   });
    // }
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
    const productsWithQuantity = [];
    // console.log("productsToWithdraw", productsToWithdraw);

    // for (const prod of productsToWithdraw) {
    //   prod.product_left > 0
    //     ? productsWithQuantity.push(prod)
    //     : productsNoQuantity.push(prod);
    // }

    // Prepare products with and without available quantity
    for (const prod of productsToWithdraw) {
      const dbProduct = existingProducts.find(
        (p) => p.barcode === prod.barcode
      );
      if (dbProduct.product_left > 0) {
        productsWithQuantity.push({ ...prod, dbProduct });
      } else {
        productsNoQuantity.push(prod);
      }
    }

    if (!productsWithQuantity.length) {
      console.log("productsWithQuantity.length", productsWithQuantity.length);
      return res.status(204).json({
        message: "All provided products have zero quantity left",
      });
    }

    // console.log("productsWithQuantity", productsWithQuantity);
    await prisma.$transaction(async (tx) => {
      for (const { dbProduct, ...product } of productsWithQuantity) {
        // const withdrawProduct = await tx.products.findUnique({
        //   where: { barcode: product.barcode },
        // });
        const withdrawProductLots = await tx.LoadProducts.findMany({
          where: {
            product_id: dbProduct.id,
            lotIsActive: true,
          },
          orderBy: {
            load_date_time: "asc",
          },
        });
        // const withdrawProductLots = await tx.LoadProducts.findMany({
        //   where: {
        //     AND: [
        //       {
        //         product_id: { equals: product.id },
        //       },
        //       {
        //         lotIsActive: {
        //           equals: true,
        //         },
        //       },
        //     ],
        //   },
        //   orderBy: {
        //     load_date_time: {
        //       sort: "asc",
        //       nulls: "first",
        //     },
        //   },
        // });

        const lotsUpdateData = updateProductLoadLots(
          product,
          withdrawProductLots
        );
        if (!lotsUpdateData.length) continue;

        console.log("withdrawProductLots", withdrawProductLots);
        console.log("lotsUpdateData", lotsUpdateData);
        // console.log("lotsUpdateData", lotsUpdateData);
        // Update lots in batch
        const updatePromises = lotsUpdateData.map((lot) =>
          tx.LoadProducts.update({
            where: { id: lot.id },
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
          })
        );
        await Promise.all(updatePromises);

        // Log removals for auditing
        const removePromises = lotsUpdateData.map((lot) =>
          tx.RemoveProducts.create({
            data: {
              product_id: dbProduct.id,
              remove_date: validDateTime,
              remove_quantity: lot.withdrawQuantity,
              remove_type_id: 3,
              isActive: false,
              load_id: lot.id || null,
              remove_cost: dbProduct.product_price * lot.withdrawQuantity,
            },
          })
        );
        await Promise.all(removePromises);

        // if (lotsUpdateData.length) {
        //   for (const lot of lotsUpdateData) {
        //     console.log("const lot of lotsUpdateData", lot);
        //     await tx.LoadProducts.update({
        //       where: {
        //         id: lot.id,
        //       },
        //       data: {
        //         product_id: lot.product_id,
        //         load_date: lot.load_date,
        //         load_quantity: lot.load_quantity,
        //         lotIsActive: lot.lotIsActive ? true : false,
        //         products_left: lot.products_left,
        //         sale_id: lot.sale_id,
        //         child_product_barcode: lot.child_product_barcode,
        //         load_date_time: lot.load_date_time,
        //       },
        //     });
        //     const removeProductPrice =
        //       withdrawProduct.product_price * lot.withdrawQuantity;
        //     console.log("removeProductPrice", removeProductPrice);

        //     await tx.RemoveProducts.create({
        //       data: {
        //         product_id: withdrawProduct.id,
        //         remove_date: validDateTime,
        //         remove_quantity: lot.withdrawQuantity,
        //         remove_type_id: 3,
        //         isActive: false,
        //         load_id: lot.id || null,
        //         remove_cost: removeProductPrice,
        //       },
        //     });
        //   }
        // }

        // await tx.Products.update({
        //   where: {
        //     id: withdrawProduct.id,
        //   },
        //   data: {
        //     combo_id: null,
        //   },
        // });

        // await tx.ComboProducts.deleteMany({
        //   where: {
        //     main_product_id: withdrawProduct.id,
        //   },
        // });
        // }

        if (dbProduct.combo_id) {
          await tx.Products.update({
            where: { id: dbProduct.id },
            data: { combo_id: null },
          });
          await tx.ComboProducts.deleteMany({
            where: { main_product_id: dbProduct.id },
          });

          await tx.ComboProducts.deleteMany({
            where: { main_product_id: dbProduct.id },
          });
        }
        const sumData = await tx.LoadProducts.aggregate({
          where: { product_id: dbProduct.id, lotIsActive: true },
          _sum: { products_left: true },
        });
        // const sumData = await tx.LoadProducts.aggregate({
        //   where: { product_id: product.id, lotIsActive: true },
        //   _sum: {
        //     products_left: true,
        //   },
        // });
        console.log("sumData", sumData);
        const activeLots = await tx.LoadProducts.findMany({
          where: { product_id: dbProduct.id, lotIsActive: true },
          orderBy: { load_date_time: "desc" },
        });
        // const activeLots = await tx.LoadProducts.findMany({
        //   where: {
        //     AND: [
        //       {
        //         product_id: {
        //           equals: withdrawProduct.id,
        //         },
        //       },
        //       {
        //         lotIsActive: {
        //           equals: true,
        //         },
        //       },
        //     ],
        //   },
        //   orderBy: {
        //     load_date_time: {
        //       sort: "desc",
        //       nulls: "last",
        //     },
        //   },
        // });
        console.log("activeLots", activeLots);
        // await tx.Products.update({
        //   where: {
        //     id: withdrawProduct.id,
        //   },
        //   data: {
        //     product_left: sumData._sum.products_left
        //       ? sumData._sum.products_left
        //       : 0,
        //     product_lot: activeLots[0]?.id || null,
        //   },
        // });
        await tx.Products.update({
          where: { id: dbProduct.id },
          data: {
            product_left: sumData._sum.products_left || 0,
            product_lot: activeLots[0]?.id || null,
          },
        });
      }
    });
    wsServer.emit("product-updated");
    res.json({
      // message: "Products deleted successfully",
      // updated: `Deleted ${productsToWithdraw.length} products`,
      // noExist: `Not deleted ${productsNotExist.length} products, as products not exist`,
      // nonExistingProducts: productsNotExist,
      message: "Products processed successfully",
      updated: `Processed ${productsWithQuantity.length} products`,
      notFound: `Skipped ${productsNotExist.length} products (not found)`,
      zeroQuantity: `Skipped ${productsNoQuantity.length} products (no quantity)`,
      nonExistingProducts: productsNotExist,
    });
  } catch (error) {
    console.error("Error processing products:", error);
    next(httpError(500, "An error occurred while processing products"));
  }
};
const updateProducts = async (req, res) => {
  const possibleUpdateKeys = [
    "barcode",
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
    "is_VAT_Excise",
    "product_price_no_VAT",
    "VAT_value",
    "excise_value",
    "excise_product",
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

    // const existingProducts = await prisma.products.findMany({
    //   where: { barcode: { in: productsData.map((p) => p.barcode) } },
    // });
    const existingProducts = await checkIfProductExist(productsData);

    const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));

    const formattedUpdateData = productsData.map((product) => {
      const { barcode, ...rest } = product;
      const keysNumber = Object.keys(rest).length;
      const filtered = Object.keys(rest).filter((key) =>
        possibleUpdateKeys.includes(key)
      );
      const forbiddenKeys = Object.keys(rest).filter(
        (key) => !possibleUpdateKeys.includes(key)
      );

      if (keysNumber !== filtered.length)
        throw Error(
          `Not valid keys passed. Possible keys to update: ${possibleUpdateKeys}. Provided fail keys: ${forbiddenKeys}`
        );
      return {
        barcode,
        data: rest,
      };
    });

    const productsToUpdate = formattedUpdateData.filter((product) =>
      existingBarcodes.has(product.barcode)
    );
    const newProducts = formattedUpdateData.filter(
      (product) => !existingBarcodes.has(product.barcode)
    );

    const approved = [];
    const rejected = [];

    for (const updateData of productsToUpdate) {
      const parcedProduct = parceProduct(updateData);
      console.log("parcedProduct", parcedProduct);
      if (
        !Object.hasOwn(parcedProduct.data, "product_category") &&
        !Object.hasOwn(parcedProduct.data, "product_subcategory")
      ) {
        approved.push(parcedProduct);
        continue;
      }

      const categoryInt = parcedProduct.data.product_category;
      const subcategoryInt = parcedProduct.data.product_subcategory;
      const isVATExcise = parcedProduct.data?.is_VAT_Excise || false;
      if (isVATExcise !== undefined) {
        parcedProduct.data.is_VAT_Excise = isVATExcise;
      }
      const exciseProduct = parcedProduct.data?.excise_product || false;
      if (exciseProduct !== undefined) {
        parcedProduct.data.excise_product = exciseProduct;
      }

      const categoryAndSubcategoryExist = await checkExistingCategory(
        categoryInt,
        subcategoryInt
      );

      if (!categoryAndSubcategoryExist) {
        rejected.push({
          ...parcedProduct,
          reason: `No such category with id ${categoryInt} and subcategory with id ${subcategoryInt} combination. 
          Add category and / or subcategory before adding product with those category and subcategory`,
        });
        continue;
      }

      approved.push(parcedProduct);
    }

    for (const newProductData of newProducts) {
      const parcedNewProduct = parceProduct(newProductData);
      console.log("on start newProductData parcedNewProduct", parcedNewProduct);
      if (
        !Object.hasOwn(parcedNewProduct.data, "product_category") &&
        !Object.hasOwn(parcedNewProduct.data, "product_subcategory")
      ) {
        const rejectReason =
          "No 'product_category' or 'product_subcategory' provided";
        rejected.push({
          rejectReason,
          parcedNewProduct,
        });
        continue;
      }

      const verifiedKeysNewProduct = await checkNewProductKeys(
        parcedNewProduct,
        possibleUpdateKeys
      );

      approved.push(verifiedKeysNewProduct);
    }
    // const validationResult = createNewProductsSchema.validate(newProducts, {
    //   abortEarly: false, // Show all validation errors
    // });
    // if (validationResult.error) {
    //   console.error("Validation failed:", validationResult.error.details);
    //   throw Error(validationResult.error);
    // } else {
    //   console.log("Validation succeeded:", validationResult.value);
    // }
    if (approved.length > 0) {
      await saveTempFileProductsData(approved);
    }

    res.status(201).json({
      message: "Approved data will be sent to db",
      approved,
      rejected,
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

module.exports = {
  getAllStoreProducts: ctrlWrapper(getAllStoreProducts),
  searchProducts: ctrlWrapper(searchProducts),
  getProductById: ctrlWrapper(getProductById),
  addProducts: ctrlWrapper(addProducts),
  withdrawProducts: ctrlWrapper(withdrawProducts),
  getSingleProduct: ctrlWrapper(getSingleProduct),
  updateProducts: ctrlWrapper(updateProducts),
};
