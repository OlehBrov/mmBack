const { prisma } = require("../config/db/dbConfig");
const { wsServer } = require("../socket/heartbeat");
const path = require("path");
const fs = require("fs/promises");
const { formatISO } = require("date-fns");
const httpError = require("./httpError");
const { connect } = require("http2");
const productsTempUpdatesPath = path.join(
  __dirname,
  "..",
  "data",
  "tempProductUpdateData.json"
);

const saveTempProductDataToDB = async () => {
  console.log("inside saveTempProductDataToDB invoke");

  try {
    const tempFileData = JSON.parse(
      await fs.readFile(productsTempUpdatesPath, "utf-8")
    );
    console.log("tempFileData", tempFileData);
    // await prisma.$transaction(async (tx) => {
    //   for (const product of tempFileData) {
    //     const dateResult = new Date().toISOString(); // Use standard ISO format
    //     product.data.updatedAt = dateResult;

    //     if (product.data.sale_id === "") {
    //       product.data.sale_id = 0; // Set default sale_id if empty
    //     }

    //     // Flatten the data
    //     const flatData = {
    //       barcode: product.barcode,
    //       ...product.data,
    //       product_left: 0,
    //     };

    //     console.log("flatData", flatData);

    //     // Use upsert to create or update the product
    //     await tx.products.upsert({
    //       where: {
    //         barcode: product.barcode,
    //       },
    //       update: {
    //         ...product.data, // Update existing product
    //       },
    //       create: {
    //         ...flatData, // Create new product
    //       },
    //     });
    //   }
    // });

    // Clear the temp file after processing
    await prisma.$transaction(async (tx) => {
      for (const product of tempFileData) {
        console.log("saveTempProductDataToDB product", product);

        const dateResult = new Date().toISOString();
        product.data.updatedAt = dateResult;

        if (product.data.sale_id === "") {
          product.data.sale_id = 0;
        }

        const saleId = product.data.sale_id ? product.data.sale_id : 0;
        // Use upsert with nested relations

        const existingProduct = await prisma.products.findUnique({
          omit: {
            id: true,
          },
          where: {
            barcode: product.barcode,
          },
        });

        const updateData = {
          ...existingProduct,
          ...product.data,
        };
        console.log("existingProduct", existingProduct);
        console.log("updateData", updateData);
        await tx.products.upsert({
          where: {
            barcode: product.barcode, // Unique identifier for upsert
          },
          update: {
            product_name: product.data?.product_name,
            product_code: product.data?.product_code,
            measure: product.data?.measure,
            product_name_ru: product.data?.product_name_ru,
            product_name_ua: product.data?.product_name_ua,
            product_description: product.data?.product_description,
            product_image: product.data?.product_image,
            product_price: product.data?.product_price,
            product_discount: product.data?.product_discount,
            exposition_term: product.data?.exposition_term,
            // sale_id: product.data.sale_id || 0,
            discount_price_1: product.data?.discount_price_1,
            discount_price_2: product.data?.discount_price_2,
            discount_price_3: product.data?.discount_price_3,
            is_VAT_Excise: product.data?.is_VAT_Excise,
            excise_product: product.data?.excise_product,
            updatedAt: product.data?.updatedAt,
            product_left: product.data?.product_left,
            is_new_product: product.data?.is_new_product,
            // cat_subcat_id: product.catSubcatId.id,
            Subcategories_Products_cat_subcat_idToSubcategories: {
              connect: {
                id: product.catSubcatId.id,
              },
            },
            Categories: {
              connect: {
                cat_1C_id: product.data.product_category,
              },
            },
            Subcategories: {
              connect: {
                subcat_1C_id: product.data.product_subcategory,
              },
            },
            Sales: {
              connect: {
                sale_custom_id: saleId,
              },
            },
            ProductsDivisions: {
              connect: {
                division_custom_id: product.data.product_division,
              },
            },
          },
          create: {
            barcode: product.barcode,
            product_name: product.data.product_name,
            product_code: product.data.product_code,
            measure: product.data.measure || "шт",
            product_name_ru: product.data.product_name_ru || null,
            product_name_ua: product.data.product_name_ua,
            product_description: product.data.product_description || null,
            product_image: product.data.product_image,
            product_price: product.data.product_price,
            product_discount: product.data.product_discount || null,
            exposition_term: product.data.exposition_term || null,
            // sale_id: product.data.sale_id || 0,
            discount_price_1: product.data.discount_price_1 || null,
            discount_price_2: product.data.discount_price_2 || null,
            discount_price_3: product.data.discount_price_3 || null,
            is_VAT_Excise: product.data.is_VAT_Excise,
            excise_product: product.data.excise_product || false,
            updatedAt: product.data.updatedAt,
            product_left: product.data.product_left || 0,
            // cat_subcat_id: product.catSubcatId.id,
            Subcategories_Products_cat_subcat_idToSubcategories: {
              connect: {
                id: product.catSubcatId.id,
              },
            },
            Categories: {
              connect: {
                cat_1C_id: product.data.product_category, // Use the foreign key here
              },
            },
            Subcategories: {
              connect: {
                subcat_1C_id: product.data.product_subcategory, // Use the foreign key here
              },
            },
            Sales: {
              connect: {
                sale_custom_id: saleId,
              },
            },
            ProductsDivisions: {
              connect: {
                division_custom_id: product.data.product_division,
              },
            },
          },
        });
      }
    });

    const clearArray = [];
    await fs.writeFile(
      productsTempUpdatesPath,
      JSON.stringify(clearArray, null, 2)
    );
  } catch (error) {
    console.log("saveTempProductDataToDB error", error);
    httpError(500);
  }
};

module.exports = saveTempProductDataToDB;
