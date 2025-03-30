const { ctrlWrapper } = require("../helpers");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

const getPaymentsByPeriod = async (req, res, next) => {
  const { start, end, type = 1 } = req.body;
  console.log("req.query start", start);
  console.log("req.query end", end);
  console.log("req.query type", type);
  if (!start || !end) {
    res.status(400).json({
      message: `Invalid provided start (${start}) or end (${end}) dates`,
    });
  }
  const result = await prisma.RemoveProducts.findMany({
    where: {
      AND: [
        {
          remove_date: {
            gte: new Date(start),
          },
        },
        {
          remove_date: {
            lte: new Date(end),
          },
        },
        {
          remove_type_id: {
            equals: parseInt(type),
          },
        },
      ],
    },
    include: {
      Products: {
        select: {
          barcode: true,
        },
      },
    },
  });
  res.status(200).json({
    message: "ok",
    result,
    qty: result.length,
  });
};

const getProductSales = async (req, res, next) => {
  const requestData = req.body;
  if (
    requestData.products.length === 0 ||
    !requestData.products.length ||
    !requestData.period ||
    !requestData.period.start ||
    !requestData.period.end
  ) {
    res.status(400).json({
      message: "Query data must be provided",
    });
    return;
  }
};

module.exports = {
  getPaymentsByPeriod: ctrlWrapper(getPaymentsByPeriod),
};
