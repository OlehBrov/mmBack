const { ctrlWrapper } = require("../helpers");
const { json } = require("express");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");
const modeCfb = require("crypto-js/mode-cfb");
const { STORE_AUTH_ID } = process.env;

const addCategory = async (req, res, next) => {
  const  categoryData  = req.body;
  console.log('categoryData', categoryData)
  try {
    const existingCategory = await prisma.Categories.findUnique({
      where: {
        cat_1C_id: categoryData.cat_1C_id,
      },
    });

    if (existingCategory) {
      res.status().json({
        message: `Category with ID ${categoryData.cat1Cid} already exists`,
      });
    }

    const addedCategory = await prisma.Categories.create({
      data: {
        category_name: categoryData.category_name,
        category_discount: categoryData.category_discount || null,
        category_image: categoryData.category_image || "",
        cat_1C_id: categoryData.cat_1C_id,
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
const addSubCategory = async (req, res, next) => {
  const { subcategoryData } = req.body;
  try {
    const existingCategory = await prisma.Categories.findUnique({
      where: {
        cat_1C_id: subcategoryData.cat_1C_id,
      },
    });

    if (!existingCategory) {
      res.status().json({
        message: `Parent category with ID ${categoryData.cat1Cid} not exists`,
      });
    }

    const addedSubCategory = await prisma.Subcategories.create({
      data: {
        subcategory_name: subcategoryData.subcategory_name,
        subcategory_ref: existingCategory.id,
        subcategory_discount: subcategoryData.subcategory_discount || null,
        subcat_1C_id: subcategoryData.subcat_1C_id,
        category_ref_1C: existingCategory.cat_1C_id,
      },
    });

    res.status(200).json({
      message: "SubCategory added",
      addedSubCategory,
    });
  } catch (error) {
    httpError(500, "Error in addCategory");
  }
};

const addStoreSale = async (req, res, next) => {
  const {
    auth_id,
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
            auth_id: auth_id,
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
module.exports = {
  addCategory: ctrlWrapper(addCategory),
  addStoreSale: ctrlWrapper(addStoreSale),
  getStoreSale: ctrlWrapper(getStoreSale),
  addSubCategory: ctrlWrapper(addSubCategory)
};
