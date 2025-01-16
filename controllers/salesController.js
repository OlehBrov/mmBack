const { ctrlWrapper } = require("../helpers");
const { json } = require("express");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

const getSalesList = async (req, res, next) => {
  const salesList = await prisma.Sales.findMany();
  if (salesList.length === 0) {
    res.status(200).json({
      message: "No sales available",
    });
    return;
  }
  res.status(200).json({
    message: "success",
    data: salesList,
  });
};

const addSale = async (req, res, next) => {
  const saleData = req.body;

  const saleExist = await prisma.Sales.findUnique({
    where: {
      sale_custom_id: saleData.sale_custom_id,
    },
  });
  if (saleExist) {
    res.status(409).json({
      message: `Sale with id ${saleData.saleId} already exists`,
    });
  }
  const newSale = await prisma.Sales.create({
    data: {
      sale_name: saleData.sale_name,
      sale_discount_1: saleData.sale_discount_1,
      sale_discount_2: saleData?.sale_discount_2 || null,
      sale_discount_3: saleData?.sale_discount_3 || null,
      sale_description: saleData?.sale_description || "No description provided",
      sale_custom_id: saleData.sale_custom_id,
    },
  });

  res.status(200).json({
    message: "Sale added",
    sale: newSale,
  });
};

const editSale = async (req, res, next) => {
  const updateData = req.body;
  if (!updateData.sale_custom_id || updateData.sale_custom_id === "") {
    res.status(400).json({
      message: "Field 'sale_custom_id' must be provided",
    });
  }
  const { sale_custom_id, ...newData } = updateData;
  const saleId = parseInt(sale_custom_id);
  const sale = await prisma.Sales.findUnique({
    where: {
      sale_custom_id: saleId,
    },
  });
  if (!sale) {
    res.status(400).json({
      message: `No such sale with id ${saleId}`,
    });
  }
  const { id, ...oldData } = sale;
  const mergedData = {
    ...oldData,
    ...newData,
  };
  console.log("mergedData", mergedData);
  const updatedSale = await prisma.Sales.update({
    where: {
      sale_custom_id: saleId,
    },
    data: mergedData,
  });

  res.status(200).json({
    message: `Sale with id ${id}, custom_sale_id ${saleId} updated`,
    data: updatedSale,
  });
};

const removeSale = async (req, res, next) => {
  const { sale_custom_id } = req.body;
  if (!sale_custom_id || sale_custom_id === "") {
    res.status(400).json({
      message: "Field 'sale_custom_id' must be provided",
    });
  }
  const saleId = parseInt(sale_custom_id);
  const sale = await prisma.Sales.findUnique({
    where: {
      sale_custom_id: saleId,
    },
  });
  if (!sale) {
    res.status(400).json({
      message: `No such sale with id ${saleId}`,
    });
  }
  const deleted = await prisma.Sales.delete({
    where: {
      sale_custom_id: saleId,
    },
  });
  res.status(200).json({
    message: `Sale custom_sale_id ${saleId} deleted`,
    data: deleted,
  });
};
module.exports = {
  getSalesList: ctrlWrapper(getSalesList),
  addSale: ctrlWrapper(addSale),
  editSale: ctrlWrapper(editSale),
  removeSale: ctrlWrapper(removeSale),
};
