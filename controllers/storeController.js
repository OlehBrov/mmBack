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

const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

const moment = require("moment");

const { wsServer, checkIdleFrontStatus } = require("../socket/heartbeat");

const { createNewProductsSchema } = require("../validation/validation");
const { IMAGE_EXTENSIONS } = require("../constant/constants");
const { equal } = require("joi");
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
  const { filter, subcategory, division = 0 } = req.query;
  const useDivisionFilter = parseInt(division) !== 0;
  console.log("division", division);
  const getNewProducts = filter === "9999";
  const categoryFilter = filter === "9999" ? 0 : parseInt(filter);
  let useSubcategoryFilter = false;

  const createSubcatArray = (array) => {
    if (array.length === 1 && array[0] === 0) {
      return [0];
    } else useSubcategoryFilter = true;
  };

  // Convert subcategory to an array of integers if it's a string
  let subcategoryFilter = [];
  if (typeof subcategory === "string") {
    subcategoryFilter = subcategory.split(",").map(Number);
  } else if (Array.isArray(subcategory)) {
    subcategoryFilter = subcategory.map(Number);
  }

  createSubcatArray(subcategoryFilter);

  try {
    const { is_single_merchant, use_VAT_by_default } = store;
    const makeBasicClause = () => {
      let baseClause = {
        product_left: {
          not: null,
          gt: 0,
        },
      };
      if (getNewProducts) {
        baseClause = {
          ...baseClause,
          is_new_product: true,
        };
      }
      if (is_single_merchant && !use_VAT_by_default) {
        return {
          ...baseClause,
          OR: [{ excise_product: { not: true } }, { excise_product: null }],
        };
      }
      if (useDivisionFilter) {
        baseClause.product_division = {
          equals: parseInt(division),
        };
      }
      return {
        ...baseClause,
      };
    };
    const whereClause = makeBasicClause();

    if (categoryFilter !== 0) {
      whereClause.product_category = categoryFilter;
    }

    if (useSubcategoryFilter) {
      whereClause.product_subcategory = { in: subcategoryFilter };
    }

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
        Subcategories_Products_cat_subcat_idToSubcategories: {
          include: {
            Categories_Subcategories_category_ref_1CToCategories: true,
          },
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
        ProductsDivisions: true,
      },
    });

    if (is_single_merchant && !use_VAT_by_default) {
      for (const product of filteredProducts) {
        if (product.sale_id === 7) {
          const childProduct = await prisma.products.findUnique({
            where: {
              id: product.ComboProducts_Products_combo_idToComboProducts
                .child_product_id,
            },
          });
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

    const distinctSubcategories = await prisma.Products.findMany({
      where: whereClause,
      select: {
        product_subcategory: true,
        Subcategories: true,
      },
      distinct: ["product_subcategory"],
    });

    let distinctCategories = [];

    // Fetch distinct categories only if subcategory === 0
    if (!useSubcategoryFilter) {
      distinctCategories = await prisma.Products.findMany({
        where: {
          product_left: {
            not: null,
            gt: 0,
          },
          product_category: categoryFilter !== 0 ? categoryFilter : undefined,
        },
        select: {
          product_category: true,
          Categories: true,
        },
        distinct: ["product_category"],
      });
    }

    if (distinctCategories.length) {
      distinctCategories = await Promise.all(
        distinctCategories.map(async (category) => {
          const divisionData = await prisma.Products.findMany({
            where: {
              product_category: category.product_category,
            },
            select: {
              product_division: true,
              ProductsDivisions: {
                select: {
                  division_custom_id: true,
                  division_name: true,
                },
              },
            },
            distinct: ["product_division"],
          });

          return {
            ...category,
            divisionData,
          };
        })
      );
    }
    console.log("filteredProducts.length", filteredProducts.length);
    if (!filteredProducts.length) {
      // If no products found, return a message
      return res.status(401).json({
        message: `No products found for the provided filters.`,
        status: "none",
      });
    }

    const newProdsIdx = filteredProducts.findIndex((el) => el.sale_id === 4);
    let hasNewProducts = false;
    if (newProdsIdx !== -1) hasNewProducts = true;
    return res.status(200).json({
      status: "ok",
      products: filteredProducts,
      totalProducts: productsCount,
      subcategories: distinctSubcategories,
      categories: categoryFilter !== 0 ? [] : distinctCategories,
      hasNewProducts,
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
  //  const product = await prisma.Products.findUnique({
  //    where: {
  //      barcode,
  //    },
  //  });
  const product = await prisma.products.findFirst({
    where: {
      OR: [
        { barcode }, // Search directly in the Products table
        {
          AdditionalBarcodes_Products_additional_barcodesToAdditionalBarcodes: {
            OR: [
              { additional_barcode_1: barcode },
              { additional_barcode_2: barcode },
              { additional_barcode_3: barcode },
              { additional_barcode_4: barcode },
              { additional_barcode_5: barcode },
            ],
          },
        },
      ],
      product_left: {
        not: null,
        gt: 0,
      },
    },
    include: {
      AdditionalBarcodes_Products_additional_barcodesToAdditionalBarcodes: true, // Include additional barcodes if found
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
};
const addProducts = async (req, res, next) => {
  const formattedDate = moment().toISOString(true);
  const validDateTime = moment(formattedDate).format("YYYY-MM-DDTHH:mm:ss.SSS");

  const dateTime = moment().toISOString(true);
  const { validProducts: products, invalidProducts, abNormalProducts } = req;
  console.log("validProducts", products);
  console.log("invalidProducts", invalidProducts);
  console.log("abNormalProducts", abNormalProducts);
  try {
    const productsWithValidCombo = await checkComboProducts(products);

    const existingProducts = await checkIfProductExist(productsWithValidCombo);

    const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));
    const productsToUpdate = productsWithValidCombo.filter((product) =>
      existingBarcodes.has(product.barcode)
    );
    const productsToCreate = productsWithValidCombo.filter(
      (product) => !existingBarcodes.has(product.barcode)
    );
    const createdAndUpdatedValidProducts = [];
    if (productsToCreate.length) {
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
      const created = await prisma.$transaction(
        productsWithImagePath.map((product) => {
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
              excise_product: product.excise_product || false,
              product_category: product.product_category,
              product_subcategory: product.product_subcategory,
              cat_subcat_id: product.catSubcatId.id,
              sale_id: product.sale_id || 0,
              combo_id: product.combo_id || null,
              is_new_product: product?.is_new_product || false,
            },
          });
        })
      );
      createdAndUpdatedValidProducts.push(...created);
    }
    // Update existing products

    const updates = await Promise.all(
      productsToUpdate.map(async (product) => {
        const updated = await prisma.Products.update({
          where: { barcode: product.barcode },
          data: {
            product_name: product.product_name,
            measure: product.measure,
            product_code: product.product_code,
            product_name_ua: product.product_name_ua,
            product_category: product.product_category,
            product_subcategory: product.product_subcategory,
            product_left: product.product_left,
            product_image: product.product_image,
            product_description: product.product_description || null,
            exposition_term: product.exposition_term || null,
            sale_id: product.sale_id || 0,
            product_price: product.product_price,
            combo_id: null,
            is_VAT_Excise: product.is_VAT_Excise || false,
            excise_product: product.excise_product || false,
            is_new_product: product?.is_new_product || false,
            cat_subcat_id: product.catSubcatId.id,
          },
        });

        return {
          ...product,
          ...updated,
        };
      })
    );

    createdAndUpdatedValidProducts.push(...updates);
    // Add load entries and create combo products
    await prisma.$transaction(
      createdAndUpdatedValidProducts.map((productWithId) => {
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

    const productsWithComboBarcode = createdAndUpdatedValidProducts.filter(
      (product) => {
        return product.sale_id === 7;
      }
    );

    if (productsWithComboBarcode.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const productWCombo of productsWithComboBarcode) {
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
      for (const product of createdAndUpdatedValidProducts) {
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
    const existingProducts = await checkIfProductExist(products);
    if (!existingProducts.length) {
      return res.status(200).json({
        message: "No matching products found in the database",
      });
    }
    console.log("existingProducts", existingProducts);
    const proceedProducts = existingProducts.map((prod) => {
      const decrementValue = products.find((p) => {
        return p.barcode === prod.barcode;
      });
      console.log("decrementValue", decrementValue);
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
      return res.status(204).json({
        message: "All provided products have zero quantity left",
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const { dbProduct, ...product } of productsWithQuantity) {
        const withdrawProductLots = await tx.LoadProducts.findMany({
          where: {
            product_id: dbProduct.id,
            lotIsActive: true,
          },
          orderBy: {
            load_date_time: "asc",
          },
        });

        const lotsUpdateData = updateProductLoadLots(
          product,
          withdrawProductLots
        );
        if (!lotsUpdateData.length) continue;

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

        const activeLots = await tx.LoadProducts.findMany({
          where: { product_id: dbProduct.id, lotIsActive: true },
          orderBy: { load_date_time: "desc" },
        });

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

const inventarizationWithdraw = async (req, res, next) => {
  const formattedDate = moment().toISOString(true);
  const validDateTime = moment(formattedDate).format(
    "YYYY-MM-DDTHH:mm:ss.SSS+00:00"
  );
  const availableProducts = await prisma.Products.findMany({
    where: {
      product_left: {
        not: null,
        gt: 0,
      },
    },
  });
  console.log("availableProducts[0]", availableProducts[0]);
  await prisma.$transaction(async (tx) => {
    const inventarizationResult = {
      withdrawedProducts: 0,
    };
    for (const product of availableProducts) {
      console.log("product", product);
      const withdrawProductLots = await tx.LoadProducts.findMany({
        where: {
          product_id: product.id,
          lotIsActive: true,
        },
        orderBy: {
          load_date_time: "asc",
        },
      });

      const lotsUpdateData = updateProductLoadLots(
        { ...product, decrement: "inventarization" },
        withdrawProductLots
      );
      if (!lotsUpdateData.length) continue;

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

      const removePromises = lotsUpdateData.map((lot) =>
        tx.RemoveProducts.create({
          data: {
            product_id: product.id,
            remove_date: validDateTime,
            remove_quantity: lot.withdrawQuantity,
            remove_type_id: 3,
            isActive: false,
            load_id: lot.id || null,
            remove_cost: product.product_price * lot.withdrawQuantity,
          },
        })
      );
      await Promise.all(removePromises);

      if (product.combo_id) {
        await tx.Products.update({
          where: { id: product.id },
          data: { combo_id: null },
        });
        await tx.ComboProducts.deleteMany({
          where: { main_product_id: product.id },
        });

        await tx.ComboProducts.deleteMany({
          where: { main_product_id: product.id },
        });
      }
      const sumData = await tx.LoadProducts.aggregate({
        where: { product_id: product.id, lotIsActive: true },
        _sum: { products_left: true },
      });

      const activeLots = await tx.LoadProducts.findMany({
        where: { product_id: product.id, lotIsActive: true },
        orderBy: { load_date_time: "desc" },
      });

      await tx.Products.update({
        where: { id: product.id },
        data: {
          product_left: sumData._sum.products_left || 0,
          product_lot: activeLots[0]?.id || null,
        },
      });
    }
  });
  wsServer.emit("product-updated");
  res.status(200).json({ message: "All products removed" });
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
    "excise_product",
    "is_new_product",
    "product_division",
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

      if (
        !Object.hasOwn(parcedProduct.data, "product_category") &&
        !Object.hasOwn(parcedProduct.data, "product_subcategory") &&
        !Object.hasOwn(parcedProduct.data, "product_division")
      ) {
        approved.push(parcedProduct);
        continue;
      }

      console.log("parcedProduct", parcedProduct);
      const ifDevisionExist = await prisma.ProductsDivisions.findUnique({
        where: {
          division_custom_id: parcedProduct.data.product_division,
        },
      });
      if (!ifDevisionExist) {
        parcedProduct.data.product_division = 0;
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
      const productsWithCatSubcatId = {
        ...parcedProduct,
        catSubcatId: {
          ...categoryAndSubcategoryExist,
        },
      };
      approved.push(productsWithCatSubcatId);
      console.log("approved parcedProduct", productsWithCatSubcatId);
    }

    console.log("rejected parcedProduct", rejected);
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
      const categoryInt = parcedNewProduct.data.product_category;
      const subcategoryInt = parcedNewProduct.data.product_subcategory;
      const categoryAndSubcategoryExist = await checkExistingCategory(
        categoryInt,
        subcategoryInt
      );

      if (!categoryAndSubcategoryExist) {
        rejected.push({
          ...parcedNewProduct,
          reason: `No such category with id ${categoryInt} and subcategory with id ${subcategoryInt} combination. 
          Add category and / or subcategory before adding product with those category and subcategory`,
        });
        continue;
      }
      const productsWithCatSubcatId = {
        ...parcedNewProduct,
        catSubcatId: {
          ...categoryAndSubcategoryExist,
        },
      };
      const verifiedKeysNewProduct = await checkNewProductKeys(
        productsWithCatSubcatId,
        possibleUpdateKeys
      );
      console.log("verifiedKeysNewProduct", verifiedKeysNewProduct);
      const ifDevisionExist = await prisma.ProductsDivisions.findUnique({
        where: {
          division_custom_id: verifiedKeysNewProduct.data.product_division,
        },
      });
      if (!ifDevisionExist) {
        verifiedKeysNewProduct.data.product_division = 0;
      }

      approved.push(verifiedKeysNewProduct);
    }

    if (approved.length > 0) {
      await saveTempFileProductsData(approved);
    }
    console.log("final approved", approved);
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
  inventarizationWithdraw: ctrlWrapper(inventarizationWithdraw),
};
