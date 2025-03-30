const Joi = require("joi");

const addProductValidation = Joi.array().items(
  Joi.object({
    product_name: Joi.string()
      .trim()
      .required('Field "product_name" should not be empty'),
    barcode: Joi.string()
      .trim()
      .required('Field "Barcode" should not be empty'),
    product_code: Joi.string()
      .trim()
      .required('Field "product_code" should not be empty'),
    measure: Joi.string().trim(),
    product_name_ru: Joi.string().trim().allow("", null),
    product_name_ua: Joi.string().trim(),
    product_description: Joi.string().trim().allow("", null),
    product_image: Joi.string().trim(),
    product_discount: Joi.number().allow(null),
    exposition_term: Joi.number()
      .min(1)
      .required('Field "exposition_term" should not be empty or 0'),
    product_left: Joi.number()
      .min(1)
      .required('Field "product_left" should not be empty or 0'),
    product_price: Joi.number().required(
      'Field "product_price" should not be empty'
    ),
    product_category: Joi.number().required(
      'Field "product_category" should not be empty'
    ),
    product_subcategory: Joi.number().required(
      'Field "product_subcategory" should not be empty'
    ),
    sale_id: Joi.number().required('Field "sale_id" should not be empty'),
    is_VAT_Excise: Joi.bool().required(
      'Field "is_VAT_Excise" must be true or false'
    ),
    child_product_barcode: Joi.string().trim(),
    excise_product: Joi.bool().required(
      'Field "excise_product" should not be empty and only "true" or "false"'
    ),
    is_new_product: Joi.bool(),
    product_division: Joi.number()
  })
);

const updateProductValidation = Joi.array().items(
  Joi.object({
    product_id: Joi.number().required("No product_id provided"),
    product_name: Joi.string()
      .trim()
      .required('Field "Product name" should not be empty'),
    barcode: Joi.string()
      .trim()
      .required('Field "Barcode" should not be empty'),
    image: Joi.string().trim().required('Field "Image" should not be empty'),
    description: Joi.string().trim().allow("", null),
    price: Joi.number().required('Field "Price" should not be empty'),
    total: Joi.number().required('Field "Total" should not be empty'),
    category: Joi.array().min(1).required("Add at least 1 category"),
    is_new_product: Joi.bool(),
    product_division: Joi.number(),
  })
);

const productSchema = Joi.object({
  barcode: Joi.string().required().pattern(/^\d+$/).messages({
    "string.empty": "Barcode is required.",
    "string.pattern.base": "Barcode must contain only numbers.",
  }),
  data: Joi.object({
    product_name: Joi.string().allow(null, "").messages({
      "string.base": "Product name must be a string.",
    }),
    product_code: Joi.string().allow(null, "").messages({
      "string.base": "Product code must be a string.",
    }),
    measure: Joi.string().allow(null, "").messages({
      "string.base": "Measure must be a string.",
    }),
    product_name_ru: Joi.string().allow(null, "").messages({
      "string.base": "Product name (RU) must be a string.",
    }),
    product_name_ua: Joi.string().allow(null, "").messages({
      "string.base": "Product name (UA) must be a string.",
    }),
    product_description: Joi.string().allow(null, "").messages({
      "string.base": "Product description must be a string.",
    }),
    product_image: Joi.string().uri().allow(null).messages({
      "string.base": "Product image must be a string.",
      "string.uri": "Product image must be a valid URI.",
    }),
    product_price: Joi.number().allow(null).messages({
      "number.base": "Product price must be a number.",
    }),
    product_discount: Joi.number().allow(null).messages({
      "number.base": "Product discount must be a number.",
    }),
    exposition_term: Joi.number().integer().allow(null).messages({
      "number.base": "Exposition term must be a number.",
      "number.integer": "Exposition term must be an integer.",
    }),
    sale_id: Joi.number().integer().allow(null).messages({
      "number.base": "Sale ID must be a number.",
      "number.integer": "Sale ID must be an integer.",
    }),
    discount_price_1: Joi.number().allow(null).messages({
      "number.base": "Discount price 1 must be a number.",
    }),
    discount_price_2: Joi.number().allow(null).messages({
      "number.base": "Discount price 2 must be a number.",
    }),
    discount_price_3: Joi.number().allow(null).messages({
      "number.base": "Discount price 3 must be a number.",
    }),
    combo_id: Joi.number().integer().allow(null).messages({
      "number.base": "Combo ID must be a number.",
      "number.integer": "Combo ID must be an integer.",
    }),
    product_category: Joi.number().integer().required().messages({
      "number.base": "Product category must be a number.",
      "number.integer": "Product category must be an integer.",
      "any.required": "Product category is required.",
    }),
    product_subcategory: Joi.number().integer().required().messages({
      "number.base": "Product subcategory must be a number.",
      "number.integer": "Product subcategory must be an integer.",
      "any.required": "Product subcategory is required.",
    }),
    is_VAT_Excise: Joi.boolean().required().messages({
      "boolean.base": "is_VAT_Excise must be a boolean.",
      "any.required": "is_VAT_Excise is required.",
    }),
    excise_product: Joi.boolean().required().messages({
      "boolean.base": "Excise product must be a boolean.",
      "any.required": "Excise product is required.",
    }),
  }).required(),
});

const createNewProductsSchema = Joi.array().items(productSchema);
module.exports = {
  addProductValidation,
  updateProductValidation,
  createNewProductsSchema,
};
