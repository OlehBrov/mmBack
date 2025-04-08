const { json } = require("express");
const fs = require("fs");
const path = require("path");
const { ctrlWrapper, saveTempFileSubcategoryMoveData } = require("../helpers");
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

const checkIfManyCategoriesExist = async (oldId, newId) => {
  return await prisma.Categories.findMany({
    where: {
      cat_1C_id: {
        in: [oldId, newId],
      },
    },
  });
};

const checkIfCatAndSubcatExist = async (cat1C, subcat1C) => {
  const existingCategory = await prisma.Categories.findUnique({
    where: {
      cat_1C_id: cat1C,
    },
  });
  if (!existingCategory) {
    return {
      status: false,
      message: "Provided category not exist",
    };
  }
  const existingSubCategory = await prisma.Subcategories.findUnique({
    where: {
      subcat_1C_id: subcat1C,
    },
  });
  if (!existingSubCategory) {
    return {
      status: false,
      message: "Provided subcategory not exist",
    };
  } else
    return {
      status: true,
      existingCategory,
      existingSubCategory,
    };
};

const editNewCatAndSubcat = async (updateData) => {
  const existingCategories = await checkIfManyCategoriesExist(
    updateData.cat_1C_id,
    updateData.new_cat_1C_id
  );

  const hasOldCategory = existingCategories.some(
    (cat) => cat.cat_1C_id === updateData.cat_1C_id
  );
  const hasNewCategory = existingCategories.some(
    (cat) => cat.cat_1C_id === updateData.new_cat_1C_id
  );
  if (!hasOldCategory || !hasNewCategory) {
    return {
      status: false,
      categoriesNotExist: updateData,
      message: "Old or new category not exist",
    };
  }

  const existingSubCategory = await prisma.Subcategories.findFirst({
    where: {
      AND: [
        {
          category_ref_1C: updateData.cat_1C_id,
        },
        {
          subcat_1C_id: updateData.subcat_1C_id,
        },
      ],
    },
  });
  if (!existingSubCategory) {
    return {
      status: false,
      categoriesNotExist: updateData,
      message: "Old subcategory not exists",
    };
  }
  const isNewSubcategoryTaken = await prisma.Subcategories.findUnique({
    where: {
      subcat_1C_id: updateData.new_subcat_1C_id,
    },
  });
  if (isNewSubcategoryTaken) {
    return {
      status: false,
      categoriesNotExist: updateData,
      message: "New subcategory ID is already in use",
    };
  }

  const newSubcategory1C = updateData.new_subcat_1C_id;
  const newCategory1C = updateData.new_cat_1C_id;
  const subcatDiscount = updateData?.subcategory_discount
    ? updateData.subcategory_discount
    : null;
  const subCatName = updateData?.subcategory_name.trim()
    ? updateData?.subcategory_name.trim()
    : existingSubCategory.subcategory_name;
  try {
    const newSubcategory = await prisma.Subcategories.create({
      data: {
        subcategory_name: subCatName,
        subcategory_discount: subcatDiscount,
        subcat_1C_id: newSubcategory1C,

        Categories: {
          connect: {
            id: hasNewCategory.id, // ← use category.id, not cat_1C_id
          },
        },
        Categories_Subcategories_category_ref_1CToCategories: {
          connect: {
            cat_1C_id: newCategory1C, // 👈 this assumes 12 is the correct cat_1C_id to match
          },
        },
      },
    });

    const updatedProducts = await prisma.Products.updateMany({
      where: {
        cat_subcat_id: existingSubCategory.id,
      },
      data: {
        cat_subcat_id: newSubcategory.id,
        product_category: newSubcategory.category_ref_1C,
        product_subcategory: newSubcategory.subcat_1C_id,
      },
    });

    await prisma.Subcategories.delete({
      where: { id: existingSubCategory.id },
    });

    return {
      status: true,
      updatedProductsCount: updatedProducts.count,
      newSubcategory,
    };
  } catch (error) {
    return {
      status: "error",
      error,
    };
  }
};

const editNewSubcat = async (updateData) => {
  const resultIfCatAndSubcatExist = await checkIfCatAndSubcatExist(
    updateData.cat_1C_id,
    updateData.subcat_1C_id
  );

  if (!resultIfCatAndSubcatExist.status) {
    return {
      status: false,
      categoriesNotExist: updateData,
      message: resultIfCatAndSubcatExist.message,
    };
  }

  const isNewSubcategoryTaken = await prisma.Subcategories.findUnique({
    where: {
      subcat_1C_id: updateData.new_subcat_1C_id,
    },
  });
  if (isNewSubcategoryTaken) {
    return {
      status: false,
      categoriesNotExist: updateData,
      message: "New subcategory ID is already in use",
    };
  }

  const currentSubcat = await prisma.Subcategories.findFirst({
    where: {
      AND: [
        {
          category_ref_1C: updateData.cat_1C_id,
        },
        {
          subcat_1C_id: updateData.subcat_1C_id,
        },
      ],
    },
  });
  const newSubcategory1C = updateData.new_subcat_1C_id;
  const prevCategory1C = updateData.cat_1C_id;
  const subcatDiscount = updateData?.subcategory_discount
    ? updateData.subcategory_discount
    : null;

  const subCatName = updateData?.subcategory_name.trim()
    ? updateData?.subcategory_name.trim()
    : currentSubcat.subcategory_name;
  try {
    const newSubcategory = await prisma.Subcategories.create({
      data: {
        subcategory_name: subCatName,
        subcategory_discount: subcatDiscount,
        subcat_1C_id: newSubcategory1C,

        Categories: {
          connect: {
            id: resultIfCatAndSubcatExist.existingCategory.id, // ← use category.id, not cat_1C_id
          },
        },
        Categories_Subcategories_category_ref_1CToCategories: {
          connect: {
            cat_1C_id: prevCategory1C, // 👈 this assumes 12 is the correct cat_1C_id to match
          },
        },
      },
    });

    const updatedProducts = await prisma.Products.updateMany({
      where: {
        cat_subcat_id: currentSubcat.id,
      },
      data: {
        cat_subcat_id: newSubcategory.id,
        product_category: newSubcategory.category_ref_1C,
        product_subcategory: newSubcategory.subcat_1C_id,
      },
    });

    await prisma.Subcategories.delete({
      where: { id: currentSubcat.id },
    });
    return {
      status: true,
      updatedProductsCount: updatedProducts.count,
      newSubcategory,
    };
  } catch (error) {
    return {
      status: "error",
      error,
    };
  }
};
const editSubCategory = async (req, res, next) => {
  const subcategoryData = req.body;
  let categoriesNotExist = [];
  let newCategoryError = [];
  let notExistingSubcategories = [];
  let editedSubCategories = [];

  let subcatNameError = [];
  try {
    for (const subcategoryUpdate of subcategoryData) {
      if (
        subcategoryUpdate.new_subcat_1C_id &&
        subcategoryUpdate.new_cat_1C_id
      ) {
        const result = await editNewCatAndSubcat(subcategoryUpdate);
        if (result.status) {
          editedSubCategories = [...editedSubCategories, result.newSubcategory];
        }
      } else if (
        (subcategoryUpdate.new_subcat_1C_id &&
          !subcategoryUpdate.new_cat_1C_id) ||
        subcategoryUpdate.new_cat_1C_id === 0
      ) {
        const result = await editNewSubcat(subcategoryUpdate);
        if (result.status && result.status !== "error") {
          editedSubCategories = [...editedSubCategories, result.newSubcategory];
        } else {
          console.log("result.error", result.error);
        }
      } else {
        const resultIfCatAndSubcatExist = await checkIfCatAndSubcatExist(
          subcategoryUpdate.cat_1C_id,
          subcategoryUpdate.subcat_1C_id
        );

        if (!resultIfCatAndSubcatExist.status) {
          categoriesNotExist = [...categoriesNotExist, subcategoryUpdate];
          continue;
        }
        const subcategoryUpdateName = subcategoryUpdate.subcategory_name.trim();

        if (!subcategoryUpdateName || !subcategoryUpdateName.length < 1) {
          subcatNameError = [...subcatNameError, subcategoryUpdate];

          continue;
        }

        const subcatDiscount = subcategoryUpdate.discount
          ? subcategoryUpdate.discount
          : null;
        const updatedSubcategory = await prisma.Subcategories.update({
          where: {
            subcat_1C_id: subcategoryUpdate.subcat_1C_id,
          },
          data: {
            subcategory_name: subcategoryUpdateName,
            subcategory_discount: subcatDiscount,
          },
        });
      }
    }

    res.status(200).json({
      message: `${editedSubCategories.length} subcategories updated`,
      editedSubCategories,
      categoriesNotExist,
      notExistingSubcategories,
      newCategoryError,
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
    console.log("error", error);
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
const moveSubCategory = async (req, res, next) => {
  try {
    const response = {
      willProcess: [],
      error: [],
    };
    for (const updateSubcatData of req.body) {
      const { cat_1C_id, subcat_1C_id, new_cat_1C_id, subcat_name } =
        updateSubcatData;
      const existingCategory = await prisma.Categories.findFirst({
        where: {
          cat_1C_id: cat_1C_id,
        },
      });
      if (!existingCategory) {
        response.error.push(
          `Category with ID ${cat_1C_id} not found`,
          updateSubcatData
        );
        continue;
      }

      const existingSubcategory = await prisma.Subcategories.findFirst({
        where: {
          subcat_1C_id: subcat_1C_id,
          category_ref_1C: cat_1C_id,
        },
      });

      if (!existingSubcategory) {
        response.error.push(
          `Subcategory with ID ${subcat_1C_id} not found in category ${cat_1C_id}`,
          updateSubcatData
        );
        continue;
      }

      const newCategory = await prisma.Categories.findFirst({
        where: {
          cat_1C_id: new_cat_1C_id,
        },
      });
      if (!newCategory) {
        response.error.push(
          `New category with ID ${new_cat_1C_id} not found`,
          updateSubcatData
        );
        continue;
      }
      response.willProcess.push(updateSubcatData);
    }
    await saveTempFileSubcategoryMoveData(response.willProcess);
    res.status(200).json({
      message: response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const checkCategories = async (req, res, next) => {
  const groupedSubcategories = await prisma.subcategories.findMany({
    include: {
      Categories_Subcategories_category_ref_1CToCategories: {
        select: {
          category_name: true,
          cat_1C_id: true,
        },
      },
    },
  });

  // Group by category_ref_1C
  const result = Object.values(
    groupedSubcategories.reduce((acc, subcat) => {
      const catId = subcat.category_ref_1C;
      if (!acc[catId]) {
        acc[catId] = {
          categoryName:
            subcat.Categories_Subcategories_category_ref_1CToCategories
              ?.category_name || "Unknown",
          category_ref_1C: catId,
          subcategories: [],
        };
      }

      acc[catId].subcategories.push(subcat);
      return acc;
    }, {})
  );

 
  res.status(200).json({
    message: "Categories checked",
    categories: result,
  });
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
  moveSubCategory: ctrlWrapper(moveSubCategory),
  checkCategories: ctrlWrapper(checkCategories),
};
