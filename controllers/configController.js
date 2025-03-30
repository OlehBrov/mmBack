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
const { IMAGE_EXTENSIONS } = require("../constant/constants");
const { sendGetMerchants } = require("../client");
const { STORE_AUTH_ID } = process.env;
const { MM_HOST } = process.env;
const imagesDir = process.env.CATEGORY_IMAGE_DIR;
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const addCategory = async (req, res, next) => {
  const categoryData = req.body;
  const existingCategories = [];
  const addedCategories = [];
  for (category of categoryData) {
    console.log("category", category);
    const existingCategory = await prisma.Categories.findUnique({
      where: {
        cat_1C_id: category.cat_1C_id,
      },
    });
    console.log("existingCategory", existingCategory);
    if (existingCategory) {
      // res.status(400).json({
      //   message: `Category with ID ${category1C} already exists`,
      // });
      existingCategories.push(existingCategory);
      continue;
    }
    const maxPriorityValue = await prisma.Categories.aggregate({
      _max: {
        category_priority: true,
      },
    });
    const defaultPriority = maxPriorityValue._max.category_priority + 1;

    const addedCategory = await prisma.Categories.create({
      data: {
        category_name: category.category_name,
        category_discount: category.category_discount || null,
        category_image: category.category_image || "",
        cat_1C_id: category.cat_1C_id,
        category_priority: defaultPriority,
      },
    });

    addedCategories.push(addedCategory);
  }

  res.status(200).json({
    message: `${addedCategories.length} categories added, found ${existingCategories.length} already existing categories`,
    addedCategories,
    existingCategories,
  });
};

const editCategory = async (req, res, next) => {
  const categoryEditData = req.body;
  const errorCategory = [];
  for (const updateData of categoryEditData) {
    if (!updateData.cat_1C_id || updateData.cat_1C_id === 0) {
      errorCategory.push(updateData);
      continue;
    }

    const existingCategory = await prisma.Categories.findUnique({
      where: {
        cat_1C_id: updateData.cat_1C_id,
      },
    });

    if (!existingCategory) {
      res.status(400).json({
        message: `Category with ID ${updateData.cat_1C_id} not exists`,
      });
    }

    const { cat_1C_id, category_priority, ...rest } = updateData;
    if (Object.keys(rest).length > 0) {
      await prisma.Categories.update({
        where: {
          cat_1C_id: cat_1C_id,
        },
        data: rest,
      });
    }

    if (
      category_priority &&
      category_priority !== existingCategory.category_priority
    ) {
      await prisma.$transaction(async (tx) => {
        const existingPriorityCategory = await tx.Categories.findUnique({
          where: {
            category_priority: category_priority,
          },
        });

        const neededCategory = existingPriorityCategory.category_priority; //9
        const oldPriority = existingCategory.category_priority; //10
        const existingPriorityCategoryId = existingPriorityCategory.cat_1C_id;

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
  }

  const updatedCount = categoryEditData.length - errorCategory.length;
  res.status(200).json({
    message: `${updatedCount} categories updated`,
    errorCategory,
  });
};

const addCategoryImage = async (req, res, next) => {
  try {
    const imageData = req.body; // Expecting an array of objects
    const imagesUrls = [];
    const failedExtensionFiles = [];

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
      const approvedExtension = IMAGE_EXTENSIONS.includes(extension);

      if (!approvedExtension) {
        failedExtensionFiles.push(imageDataItem);
        continue;
      }
      const categoryFileName = `category_image_${categoryId}${extension}`;

      const filePath = path.join(imagesDir, categoryFileName);

      await prisma.Categories.update({
        where: {
          cat_1C_id: categoryId,
        },
        data: {
          category_image: `${MM_HOST}/api/category-image/${categoryFileName}`,
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
    let errorMsg = "";
    if (failedExtensionFiles.length) {
      errorMsg = "Files should be .jpg, .jpeg, .webp, .png";
    }
    res.send({
      message: "Images managed",
      imageUrl: imagesUrls,
      failedExtensionFiles,
      error: errorMsg,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};
const addSubCategory = async (req, res, next) => {
  const subcategoryData = req.body;
  const categoriesNotExist = [];
  const existingSubcategories = [];
  const addedSubCategories = [];

  try {
    for (const subcategoryUpdate of subcategoryData) {
      const existingCategory = await prisma.Categories.findUnique({
        where: {
          cat_1C_id: subcategoryUpdate.cat_1C_id,
        },
      });

      if (!existingCategory) {
        categoriesNotExist.push(subcategoryUpdate);
        continue;
      }

      const existingSubCategory = await prisma.Subcategories.findUnique({
        where: {
          subcat_1C_id: subcategoryUpdate.subcat_1C_id,
        },
      });
      if (existingSubCategory) {
        existingSubcategories.push(existingSubCategory);
        continue;
      }

      const addedSubCategory = await prisma.Subcategories.create({
        data: {
          subcategory_name: subcategoryUpdate.subcategory_name,
          subcategory_discount: subcategoryUpdate.subcategory_discount || null,
          subcat_1C_id: subcategoryUpdate.subcat_1C_id,
          // category_ref_1C: existingCategory.cat_1C_id,
          Categories_Subcategories_category_ref_1CToCategories: {
            connect: {
              cat_1C_id: existingCategory.cat_1C_id,
            },
          },
          Categories: {
            connect: {
              id: existingCategory.id,
            },
          },
        },
      });
      addedSubCategories.push(addedSubCategory);
    }

    res.status(200).json({
      message: `${addedSubCategories.length} subcategories added`,
      addedSubCategories,
      categoriesNotExist,
      existingSubcategories,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "An error occurred while adding the subcategory",
      error: error.message,
    });
  }
};
const editSubCategory = async (req, res, next) => {
  const subcategoryData = req.body;
  const categoriesNotExist = [];
  const notExistingSubcategories = [];
  const editedSubCategories = [];

  try {
    for (const subcategoryUpdate of subcategoryData) {
      const existingCategory = await prisma.Categories.findUnique({
        where: {
          cat_1C_id: subcategoryUpdate.cat_1C_id,
        },
      });

      if (!existingCategory) {
        categoriesNotExist.push(subcategoryUpdate);
        continue;
      }

      const existingSubCategory = await prisma.Subcategories.findUnique({
        where: {
          subcat_1C_id: subcategoryUpdate.subcat_1C_id,
        },
      });
      if (!existingSubCategory) {
        notExistingSubcategories.push(existingSubCategory);
        continue;
      }

      const editedSubCategory = await prisma.Subcategories.update({
        where: {
          subcat_1C_id: existingSubCategory.subcat_1C_id,
        },
        data: {
          subcategory_name: subcategoryUpdate.subcategory_name,
          subcategory_discount: subcategoryUpdate.subcategory_discount || null,
          // subcat_1C_id: subcategoryUpdate.subcat_1C_id,
          // category_ref_1C: existingCategory.cat_1C_id,
          Categories_Subcategories_category_ref_1CToCategories: {
            connect: {
              cat_1C_id: existingCategory.cat_1C_id,
            },
          },
          Categories: {
            connect: {
              id: existingCategory.id,
            },
          },
        },
      });
      editedSubCategories.push(editedSubCategory);
    }

    res.status(200).json({
      message: `${editedSubCategories.length} subcategories updated`,
      editedSubCategories,
      categoriesNotExist,
      notExistingSubcategories,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "An error occurred while adding the subcategory",
      error: error.message,
    });
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

  try {
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

    if (!existingCategoryAndSubcategory) {
      next(httpError(404, "Product category or subcategory not found"));
    }

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
  console.log("getMerchantData invoke");
  /*DEFAULT MERCHANTS, MUST BE UPDATED*/
  const merchants = {
    noVAT: "1", //default value
    VAT: "11", //default value
  };
  console.log("merchants first", merchants);
  try {
    const merchantsResponse = await sendGetMerchants();

    if (
      merchantsResponse.success &&
      merchantsResponse.response.params.msgType === "getMerchantList"
    ) {
      const rawMerchantsList = merchantsResponse.response.params;

      for (const merchantItem of Object.entries(rawMerchantsList)) {
        console.log("merchantItem", merchantItem);
        if (merchantItem[1] === "То Є Iжа Оплата") {
          merchants.noVAT = merchantItem[0];
        }
        if (merchantItem[1] === "БРМГРУП Оплата") {
          merchants.VAT = merchantItem[0];
        }
      }
    }
    console.log("merchants second", merchants);
    const store = await prisma.Store.update({
      where: {
        auth_id: STORE_AUTH_ID,
      },
      data: {
        default_merchant: merchants.noVAT,
        VAT_excise_merchant: merchants.VAT,
      },
    });
    console.log("store after update", store);
    res.status(200).json({
      status: "success",
      defaultMerchant: store.default_merchant,
      vatExciseMerchant: store.VAT_excise_merchant,
      useVATbyDefault: store.use_VAT_by_default,
      isSingleMerchant: store.is_single_merchant,
      noVATTaxGroup: store.default_merchant_taxgrp,
      VATTaxGroup: store.VAT_merchant_taxgrp,
      VATExciseTaxGroup: store.VAT_excise_taxgrp,
    });
  } catch (error) {
    console.log('error', error)
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
  editSubCategory: ctrlWrapper(editSubCategory),
};
