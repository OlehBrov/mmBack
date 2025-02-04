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
// const saveTempProductDataToDB = async () => {
//   console.log("inside saveTempProductDataToDB invoke");

//   try {
//     const tempFileData = JSON.parse(
//       await fs.readFile(productsTempUpdatesPath, "utf-8")
//     );

//     await prisma.$transaction(async (tx) => {
//       for (const product of tempFileData) {
//         const dateResult = formatISO(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

//         const localedDate = dateResult.replace("+02", "+00");
//         product.data.updatedAt = localedDate;

//         if (product.data.sale_id === "") {
//           product.data.sale_id = 0; // Update sale_id in the product object
//         }
//         const exist = await tx.Products.findUnique({
//           where: {
//             barcode: product.barcode,
//           },
//         });

//         if (!exist) {
//           const flatData = {
//             barcode: product.barcode,
//             ...product.data,
//             product_left: 0,
//           };
//         console.log('flatData', flatData)
//           await tx.products.create({
//             data: flatData,
//           });

//           continue;
//         }
//         console.log('tempFileData product exist', exist)
//         console.log('tempFileData product', product)
//         console.log('tempFileData product data', product.data)

//         await tx.products.update({
//           where: { barcode: product.barcode },
//           data: product.data,
//         });
//       }
//     });
//     const clearArray = [];
//     await fs.writeFile(
//       productsTempUpdatesPath,
//       JSON.stringify(clearArray, null, 2)
//     );
//   } catch (error) {
//     console.log("saveTempProductDataToDB error", error);
//     httpError(500);
//     // res.status(500).json({
//     //   message: "Error in saveTempProductDataToDB",
//     //   error,
//     // });
//   }

//   // socket.on("screen-status", (status) => {
//   //   console.log("on status", status);
//   // });
// };
const saveTempProductDataToDB = async () => {
  console.log("inside saveTempProductDataToDB invoke");

  try {
    const tempFileData = JSON.parse(
      await fs.readFile(productsTempUpdatesPath, "utf-8")
    );

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
        const dateResult = new Date().toISOString();
        product.data.updatedAt = dateResult;

        if (product.data.sale_id === "") {
          product.data.sale_id = 0;
        }

        const flatData = {
          ...product.data,
          product_left: 0,
        };

        // Use upsert with nested relations
        await tx.products.upsert({
          where: {
            barcode: product.barcode, // Unique identifier for upsert
          },
          update: {
            product_name: product.data.product_name,
            product_code: product.data.product_code,
            measure: product.data.measure,
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
            product_price_no_VAT: product.data.product_price_no_VAT,
            VAT_value: product.data.VAT_value,
            excise_value: product.data.excise_value,
            excise_product: product.data.excise_product || false,
            updatedAt: product.data.updatedAt,
            product_left: product.data.product_left || 0,
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
                sale_custom_id: product.data.sale_id,
              },
            },
          },
          create: {
            barcode: product.barcode,
            product_name: product.data.product_name,
            product_code: product.data.product_code,
            measure: product.data.measure,
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
            product_price_no_VAT: product.data.product_price_no_VAT,
            VAT_value: product.data.VAT_value,
            excise_value: product.data.excise_value,
            excise_product: product.data.excise_product || false,
            updatedAt: product.data.updatedAt,
            product_left: product.data.product_left || 0,
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
                sale_custom_id: product.data.sale_id,
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

module.exports = saveTempProductDataToDB;
