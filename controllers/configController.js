const { json } = require("express");
const fs = require("fs");
const path = require("path");
const { ctrlWrapper } = require("../helpers");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");
const modeCfb = require("crypto-js/mode-cfb");
const { wsServer } = require("../socket/heartbeat");
const { error } = require("console");
const { date, when } = require("joi");
const { connect } = require("http2");
const { STORE_AUTH_ID } = process.env;
const { MM_HOST } = process.env;
const imagesDir = process.env.IMAGE_DIR;
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const addCategory = async (req, res, next) => {
  const categoryData = req.body;
  console.log("categoryData", categoryData);
  try {
    const existingCategory = await prisma.Categories.findUnique({
      where: {
        cat_1C_id: categoryData.cat_1C_id,
      },
    });

    if (existingCategory) {
      res.status(400).json({
        message: `Category with ID ${categoryData.cat1Cid} already exists`,
      });
    }
    const maxPriorityValue = await prisma.Categories.aggregate({
      _max: {
        category_priority: true,
      },
    });
    const defaultPriority = maxPriorityValue._max.category_priority + 1;

    const addedCategory = await prisma.Categories.create({
      data: {
        category_name: categoryData.category_name,
        category_discount: categoryData.category_discount || null,
        category_image: categoryData.category_image || "",
        cat_1C_id: categoryData.cat_1C_id,
        category_priority: defaultPriority,
      },
    });

    res.status(200).json({
      message: "Category added",
      addedCategory,
    });
  } catch (error) {
    httpError(500, "Error in addCategory");
  }
};

const editCategory = async (req, res, next) => {
  const categoryEditData = req.body;

  if (!categoryEditData.cat_1C_id || categoryEditData.cat_1C_id === 0) {
    res.status(400).json({
      error: "Provide cat_1C_id value",
    });
  }

  try {
    const existingCategory = await prisma.Categories.findUnique({
      where: {
        cat_1C_id: categoryEditData.cat_1C_id,
      },
    });

    if (!existingCategory) {
      res.status(400).json({
        message: `Category with ID ${categoryEditData.cat_1C_id} not exists`,
      });
    }

    const { cat_1C_id, category_priority, ...rest } = categoryEditData;
    if (Object.keys(rest).length > 0) {
      await prisma.Categories.update({
        where: {
          cat_1C_id: cat_1C_id,
        },
        data: rest,
      });
    }
    console.log("category_priority", category_priority);
    console.log(
      "existingCategory.category_priority",
      existingCategory.category_priority
    );
    if (
      category_priority &&
      category_priority !== existingCategory.category_priority
    ) {
      console.log("inside if");
      await prisma.$transaction(async (tx) => {
        const existingPriorityCategory = await tx.Categories.findUnique({
          where: {
            category_priority: category_priority,
          },
        });

        const neededCategory = existingPriorityCategory.category_priority; //9
        const oldPriority = existingCategory.category_priority; //10
        const existingPriorityCategoryId = existingPriorityCategory.cat_1C_id;
        console.log("existingPriorityCategory", existingPriorityCategory);
        console.log("neededCategory", neededCategory);
        console.log("oldPriority", oldPriority);
        console.log("existingPriorityCategoryId", existingPriorityCategoryId);

        await tx.Categories.update({
          where: {
            cat_1C_id: existingPriorityCategoryId,
          },
          data: {
            category_priority: 9999,
          },
        });

        await tx.Categories.update({
          where: {
            cat_1C_id: existingCategory.cat_1C_id,
          },
          data: {
            category_priority: neededCategory,
          },
        });

        await tx.Categories.update({
          where: {
            cat_1C_id: existingPriorityCategoryId,
          },
          data: {
            category_priority: oldPriority,
          },
        });
      });
    }

    res.status(200).json({
      message: "Categories updated",
    });
  } catch (error) {}
};

const addCategoryImage = async (req, res, next) => {
  try {
    const imageData = req.body; // Expecting an array of objects
    const imagesUrls = [];

    // const { categoryImage, fileName } = imageData;
    for (const imageDataItem of imageData) {
      const { categoryImage, fileName, categoryId } = imageDataItem;
      if (!categoryImage || !fileName || !categoryId) {
        throw new Error(
          "Invalid request: Missing image data or file name or category ID."
        );
      }

      // Decode base64 and save as a file
      const buffer = Buffer.from(categoryImage, "base64");
      const extension = getFileExtension(fileName);
      if (!extension.length) {
        res.status(401).json({
          message: "Bad file name, should be with extension",
        });
      }
      const categoryFileName = `category_image_${categoryId}${extension}`;

      const filePath = path.join(imagesDir, categoryFileName);

      await prisma.Categories.update({
        where: {
          cat_1C_id: categoryId,
        },
        data: {
          category_image: `${MM_HOST}/api/product-image/${categoryFileName}`,
        },
      });

      fs.writeFile(filePath, buffer, (err) => {
        if (err) throw err;
        console.log("The file has been saved!");
      });
      console.log(`Image saved as ${filePath}`);
      imagesUrls.push(categoryFileName);
    }

    wsServer.emit("product-updated");

    res.send({
      message: "File uploaded successfully",
      imageUrl: imagesUrls,
    });
    // res.status(200).json({ message: "Images uploaded successfully!" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};
const addSubCategory = async (req, res, next) => {
  const subcategoryData = req.body;
  console.log("subcategoryData", subcategoryData);
  try {
    const existingCategory = await prisma.Categories.findUnique({
      where: {
        cat_1C_id: subcategoryData.cat_1C_id,
      },
    });
    console.log("existingCategory", existingCategory);
    if (!existingCategory) {
      console.log("!existingCategory");
      return res.status(400).json({
        message: `Parent category with ID ${subcategoryData.cat_1C_id} not exists`,
      });
    }

    const addedSubCategory = await prisma.Subcategories.create({
      data: {
        subcategory_name: subcategoryData.subcategory_name,
        subcategory_discount: subcategoryData.subcategory_discount || null,
        subcat_1C_id: subcategoryData.subcat_1C_id,
        // category_ref_1C: existingCategory.cat_1C_id,
        Categories_Subcategories_category_ref_1CToCategories: {
          connect: {
            cat_1C_id: existingCategory.cat_1C_id,
          }, // Connect to the existing category by its ID
        },
        Categories: {
          connect: {
            id: existingCategory.id,
          },
        },
      },
    });
    console.log("addedSubCategory", addedSubCategory);
    res.status(200).json({
      message: "SubCategory added",
      addedSubCategory,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "An error occurred while adding the subcategory",
      error: error.message,
    }); // Send error response
  }
};

const addStoreSale = async (req, res, next) => {
  const {
    store_sale_product_category,
    store_sale_product_subcategory,
    store_sale_name,
    store_sale_title,
    store_sale_discount,
  } = req.body;

  console.log("req.body", req.body);
  try {
    console.log("store_sale_product_category", store_sale_product_category);
    console.log(
      "store_sale_product_subcategory",
      store_sale_product_subcategory
    );
    const existingCategoryAndSubcategory = await prisma.Subcategories.findFirst(
      {
        where: {
          AND: [
            {
              subcat_1C_id: {
                equals: store_sale_product_subcategory,
              },
            },
            {
              category_ref_1C: {
                equals: store_sale_product_category,
              },
            },
          ],
        },
      }
    );
    console.log(
      "existingCategoryAndSubcategory",
      existingCategoryAndSubcategory
    );
    if (!existingCategoryAndSubcategory) {
      next(httpError(404, "Product category or subcategory not found"));
    }
    console.log(
      "existingCategoryAndSubcategory",
      existingCategoryAndSubcategory
    );
    const [updatedStore, updatedSales, updatedProducts] =
      await prisma.$transaction([
        prisma.Store.update({
          where: {
            auth_id: STORE_AUTH_ID,
          },
          data: {
            store_sale_name: store_sale_name,
            store_sale_title: store_sale_title,
            store_sale_discount: store_sale_discount,
            store_sale_product_category: store_sale_product_category,
            store_sale_product_subcategory: store_sale_product_subcategory,
          },
        }),
        prisma.Sales.update({
          where: {
            sale_custom_id: 9,
          },
          data: {
            sale_name: store_sale_name,
            sale_discount_1: store_sale_discount,
          },
        }),
        prisma.Products.updateMany({
          where: {
            AND: [
              {
                product_category: {
                  equals: store_sale_product_category,
                },
              },
              {
                product_subcategory: {
                  equals: store_sale_product_subcategory,
                },
              },
            ],
          },
          data: {
            sale_id: 9,
            combo_id: null,
          },
        }),
      ]);

    res.status(201).json({
      message: `Знижка ${store_sale_title} додана`,
      productsWithStoreSale: updatedProducts,
      storeSaleData: updatedStore,
    });
  } catch (error) {
    console.log("error", error);
    httpError(500, "Error with store sale config");
  }
};

const getStoreSale = async (req, res, next) => {
  try {
    const store = await prisma.Store.findUnique({
      where: {
        auth_id: STORE_AUTH_ID,
      },
    });
    console.log("store", store);
    if (
      !store.store_sale_product_category ||
      !store.store_sale_product_subcategory
    ) {
      const [storeSaleProducts, saleData] = await prisma.$transaction([
        prisma.Products.findMany({
          where: {
            AND: [
              {
                sale_id: 4,
              },
              {
                product_left: {
                  gte: 1,
                },
              },
            ],
          },
          include: {
            Sales: true,
          },
        }),
        prisma.Sales.findUnique({
          where: {
            sale_custom_id: 4,
          },
        }),
      ]);
      console.log("No default sale");
      res.status(200).json({
        message: "No default sale",
        products: storeSaleProducts,
        saleData,
        discount: store.store_sale_discount,
        store_sale_title: store.store_sale_title,
      });
    }

    const [storeSaleProducts, saleData] = await prisma.$transaction([
      prisma.Products.findMany({
        where: {
          AND: [
            {
              sale_id: 9,
            },
            {
              product_left: {
                gte: 1,
              },
            },
          ],
        },
        include: {
          Sales: true,
        },
      }),
      prisma.Sales.findUnique({
        where: {
          sale_custom_id: 9,
        },
      }),
    ]);
    console.log("With default sale");
    res.status(200).json({
      message: "With default sale",
      // products: [],
      products: storeSaleProducts,
      saleData,
      discount: store.store_sale_discount,
      store_sale_title: store.store_sale_title,
    });
  } catch (error) {
    httpError(404, error);
  }
};

const getFileExtension = (string) => {
  return string.slice(string.lastIndexOf("."));
};

const getMerchantData = async (req, res) => {
  try {
    const store = await prisma.Store.findUnique({
      where: {
        auth_id: STORE_AUTH_ID,
      },
    });

    res.status(200).json({
      status: "success",
      defaultMerchant: store.default_merchant,
      vatExciseMerchant: store.VAT_excise_merchant,
      useVATbyDefault: store.use_VAT_by_default,
      isSingleMerchant: store.is_single_merchant,
    });
  } catch (error) {
    httpError(500, "Error in getMerchantData");
  }
};

const setMerchantData = async (req, res) => {
  const merchantData = req.body;

  const possibleStoreKeys = [
    "defaultMerchant",
    "vatExciseMerchant",
    "useVATbyDefault",
    "isSingleMerchant",
    "defaultMerchantTaxgrp",
    "vatExciseMerchantTaxgrp",
  ];

  if (merchantData.length !== possibleStoreKeys.length) {
    res.status(400).json({
      message: "Invalid data provided",
    });
  }
  const filteredKeys = Object.keys(merchantData).filter((key) =>
    possibleStoreKeys.includes(key)
  );
  if (filteredKeys.length !== possibleStoreKeys.length) {
    res.status(400).json({
      message: "Invalid data provided",
    });
  }
  try {
    const store = await prisma.Store.findUnique({
      where: {
        auth_id: STORE_AUTH_ID,
      },
    });

    if (!store) {
      httpError(404, "Store not found");
    }
    if (!merchantData.isSingleMerchant && merchantData.useVATbyDefault) {
      res.status(400).json({
        message: "You can't use VAT by default with multiple merchants",
      });
    }
    const updatedStore = await prisma.Store.update({
      where: {
        auth_id: STORE_AUTH_ID,
      },
      data: {
        default_merchant: merchantData.defaultMerchant,
        VAT_excise_merchant: merchantData.vatExciseMerchant,
        use_VAT_by_default: merchantData.useVATbyDefault,
        is_single_merchant: merchantData.isSingleMerchant,
        default_merchant_taxgrp: merchantData.defaultMerchantTaxgrp || 7,
        VAT_excise_merchant_taxgrp: merchantData.vatExciseMerchantTaxgrp || 3,
      },
    });

    res.status(200).json({
      message: "Merchant data updated",
      updatedStore,
    });
  } catch (error) {
    httpError(500, "Error in setMerchantData");
  }
};

module.exports = {
  addCategory: ctrlWrapper(addCategory),
  addStoreSale: ctrlWrapper(addStoreSale),
  getStoreSale: ctrlWrapper(getStoreSale),
  addSubCategory: ctrlWrapper(addSubCategory),
  addCategoryImage: ctrlWrapper(addCategoryImage),
  editCategory: ctrlWrapper(editCategory),
  getMerchantData: ctrlWrapper(getMerchantData),
  setMerchantData: ctrlWrapper(setMerchantData),
};
