const { ctrlWrapper } = require("../helpers");
const { json } = require("express");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

const addSale = async (req, res, next) => {
  const saleData = req.body;
  const saleExist = await prisma.Sales.findUnique({
    where: {
      sale_custom_id: saleData.saleId,
    },
  });
  if (saleExist) {
    res.status(409).json({
      message: `Sale with id ${saleData.saleId} already exists`,
    });
  }
  const newSale = await prisma.Sales.create({
    data: {
      sale_name: saleData.saleName,
      sale_discount_1: saleData.saleDiscount1,
      sale_discount_2: saleData?.saleDiscount2 || null,
      sale_discount_3: saleData?.saleDiscount3 || null,
      sale_description: saleData?.saleDescription || "No description provided",
      sale_custom_id: saleData.saleId,
    },
  });

  res.status(200).json({
    message: "Sale added",
    sale: newSale,
  });
};

module.exports = {
  addSale: ctrlWrapper(addSale),
};
