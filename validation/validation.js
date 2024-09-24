const Joi = require("joi");

const addProductValidation = Joi.array().items(
  Joi.object({
    product_name: Joi.string()
      .trim()
      .required('Field "Product name" should not be empty'),
    barcode: Joi.string()
      .trim()
      .required('Field "Barcode" should not be empty'),
    image: Joi.string().trim().required('Field "Image" should not be empty'),
    description: Joi.string()
      .trim()
      .required('Field "description" should not be empty'),
    price: Joi.number().required('Field "Price" should not be empty'),
    total: Joi.number().required('Field "Total" should not be empty'),
    category: Joi.array().min(1).required("Add at least 1 category"),
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
    description: Joi.string()
      .trim()
      .required('Field "description" should not be empty'),
    price: Joi.number().required('Field "Price" should not be empty'),
    total: Joi.number().required('Field "Total" should not be empty'),
    category: Joi.array().min(1).required("Add at least 1 category"),
  })
);

module.exports = {
  addProductValidation,
  updateProductValidation,
};
