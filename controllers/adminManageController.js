const { ctrlWrapper } = require("../helpers");
const { json } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { AUTH_TOKEN_SECRET_KEY, STORE_AUTH_ID } = process.env;
// const Product = require("../models/product");
// const Store = require("../models/store");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");
const { equal } = require("joi");
const { Prisma } = require("@prisma/client");
const requiredKeys = {
  product_name: "string",
  barcode: "string",
  image: "string",
  description: "string",
  price: "number",
  total: "number",
  category: "array",
};
const getAllProducts = async (req, res, next) => {
  // const { manager } = req;
  // const { page, limit = 10 } = req.body;

  // if (!manager) {
  //   return next(httpError(401));
  // }

  // const skip = (page - 1) * limit;
  try {
    const [allProducts, productsCount] = await prisma.$transaction([
      prisma.products.findMany({
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
      }),
      prisma.products.count(),
    ]);

    if (allProducts && productsCount) {
      console.log("allProducts", allProducts);
      res.status(200).json({
        data: allProducts,
        qty: productsCount,
      });
    } else {
      console.log("error 01");
      return next(httpError(401));
    }
  } catch (error) {
    console.log("error 02", error);
    return next(httpError(401));
  }
};

const addProducts = async (req, res, next) => {
  const { manager } = req;
  if (!manager) return next(httpError(401));

  const products = req.body;

  try {
    const existingProducts = await prisma.products.findMany({
      where: {
        barcode: { in: products.map((p) => p.barcode) },
      },
    });

    const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));
    const productsToUpdate = [];
    const productsToCreate = [];

    products.forEach((product) => {
      if (existingBarcodes.has(product.barcode)) {
        productsToUpdate.push(product);
      } else {
        productsToCreate.push(product);
      }
    });

    // Create new products
    const createPromises = productsToCreate.map((product) =>
      prisma.products.create({
        data: {
          product_name: product.product_name,
          barcode: product.barcode,
          image: product.image,
          description: product.description,
          price: product.price,
          total: product.total,
        },
      })
    );

    await Promise.all([...createPromises]);
    productsToCreate.forEach(async (p) => {
      const newProduct = await prisma.products.findUnique({
        where: {
          barcode: p.barcode,
        },
      });

      const catsToAdd = p.category.map((cat) => {
        return {
          product_id: newProduct.product_id,
          category_id: cat,
        };
      });

      await prisma.ProductCategories.createMany({
        data: catsToAdd,
      });
    });

    res.json({
      message: "Products processed successfully",
      existing: {
        message: `Found ${productsToUpdate.length} already existing products, not added`,
        data: productsToUpdate,
      },
      created: {
        message: `Added ${productsToCreate.length} products`,
      },
    });
  } catch (error) {
    console.error("Error processing products:", error);
    next(httpError(500, "An error occurred while processing products"));
  }
};

const updateProducts = async (req, res, next) => {
  const { manager } = req;
  if (!manager) return next(httpError(401));
  const productsToUpdate = [];

  const products = req.body;

  const updatePromises = products.map(async (product) => {
    prisma.products.update({
      where: { product_id: product.product_id },
      data: {
        product_name: product.product_name,
        image: product.image,
        barcode: product.barcode,
        description: product.description,
        price: product.price,
        total: product.total,
      },
    });
    const existingCategories = await prisma.ProductCategories.findMany({
      where: { product_id: product.product_id },
      select: { category_id: true },
    });
    const existingCategoryIds = existingCategories.map(
      (cat) => cat.category_id
    );
    const categoriesToAdd = product.category.filter(
      (cat) => !existingCategoryIds.includes(cat)
    );
    const categoriesToRemove = existingCategoryIds.filter(
      (cat) => !product.category.includes(cat)
    );

    // Add new categories
    if (categoriesToAdd.length > 0) {
      const catsToAdd = categoriesToAdd.map((cat) => ({
        product_id: product.product_id,
        category_id: cat,
      }));

      await prisma.ProductCategories.createMany({
        data: catsToAdd,
      });
    }

    // Remove obsolete categories
    if (categoriesToRemove.length > 0) {
      await prisma.ProductCategories.deleteMany({
        where: {
          product_id: product.product_id,
          category_id: { in: categoriesToRemove },
        },
      });
    }
  });
  await Promise.all([...updatePromises]);
  res.status(200).json({ message: "Products updated successfully" });
};

const getOneProduct = async (req, res) => {
  const results = await Product.find({ _id: req.body._id });
  res.json({ data: results });
};

const getAllStores = async (req, res) => {
  const results = await prisma.stores.findMany();
  res.json({ data: results });
};

const getSingleStore = async (req, res, next) => {
  const store = await prisma.Store.findFirst({
    where: { auth_id: STORE_AUTH_ID },
  });
  const products = await prisma.Products.findMany({
    include: {
      Categories: true,
      Subcategories: true,
    },
  });
  // console.log("store", store);
  res.status(200).json({
    message: "Store found",
    store,
    products,
  });
};

const getWithdraws = async (req, res, next) => {
  console.log("getWithdraws", getWithdraws);
  const withdrawData = await prisma.RemoveProducts.findMany({});
  res.status(200).json({
    message: "Store found",
    withdrawData,
  });
};

const putProductsInStore = async (req, res, next) => {
  // store_id: int, productsToAdd = [product_id, store_id, quantity]
  const { store_id, productsToAdd } = req.body;

  const storeProducts = await prisma.productsOnStore.findMany({
    where: {
      store_id: store_id,
    },
  });

  const existingProductsIds = storeProducts.map((prod) => prod.product_id);
  const toAddProduct = productsToAdd.filter(
    (product) => !existingProductsIds.includes(product.product_id)
  );
  const toUpdateProduct = productsToAdd.filter((product) =>
    existingProductsIds.includes(product.product_id)
  );
  const toCreateData = toAddProduct.map((d) => {
    return {
      store_id: store_id,
      product_id: d.product_id,
      quantity: d.quantity,
      discount: d.discount || 0,
    };
  });
  const toUpdateData = toUpdateProduct.map((d) => {
    return {
      store_id: store_id,
      product_id: d.product_id,
      quantity: d.quantity,
      discount: d.discount || 0,
    };
  });
  try {
    const addedProducts = await prisma.productsOnStore.createMany({
      data: toCreateData,
    });

    // Update existing products with Promise.all to handle async operations
    await Promise.all(
      toUpdateData.map(async (upd) => {
        await prisma.productsOnStore.update({
          where: {
            store_id_product_id: {
              store_id: store_id,
              product_id: upd.product_id,
            },
          },
          data: {
            quantity: upd.quantity,
            discount: upd.discount,
          },
        });
      })
    );

    return res.status(200).json({
      message: "Products added/updated in store successfully",
      toAddProduct,
      toUpdateProduct,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return next(
        httpError(400, "Cannot add more products than available stock.")
      );
    }

    return next(httpError(500, "An unexpected error occurred."));
  }
};

const createStore = async (req, res, next) => {
  const { name, location, auth_id, password } = req.body;
  const store = await prisma.Store.findUnique({
    where: {
      auth_id: auth_id,
    },
  });
  if (store) {
    return res.status(409).json({
      status: "error",
      code: 409,
      message: "auth_id is already in use",
      data: "Conflict",
    });
  }
  const hashPassword = await bcrypt.hash(password, 10);
  try {
    const newStore = await prisma.Store.create({
      data: {
        store_name: name,
        location: location,
        auth_id: auth_id,
        password: hashPassword,
      },
      select: {
        auth_id: true,
        store_id: true,
      },
    });
    const { store_id } = newStore;
    const payload = { store_id: newStore.store_id };
    const token = jwt.sign(payload, AUTH_TOKEN_SECRET_KEY, {
      expiresIn: "23h",
    });
    await prisma.Store.update({
      where: {
        store_id: store_id,
      },
      data: {
        token: token,
      },
    });

    res.status(201).json({
      status: "success",
      code: 201,
      data: {
        message: "Registration successful",
        name: newStore.name,
        auth_id: newStore.auth_id,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllStores: ctrlWrapper(getAllStores),
  getSingleStore: ctrlWrapper(getSingleStore),
  putProductsInStore: ctrlWrapper(putProductsInStore),
  createStore: ctrlWrapper(createStore),
  getAllProducts: ctrlWrapper(getAllProducts),
  addProducts: ctrlWrapper(addProducts),
  updateProducts: ctrlWrapper(updateProducts),
  getWithdraws: ctrlWrapper(getWithdraws),
};
