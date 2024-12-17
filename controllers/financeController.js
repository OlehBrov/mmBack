const { ctrlWrapper } = require("../helpers");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

const getPaymentsByPeriod = async (req, res, next) => {

    const { start, end, type = 1 } = req.query;
    console.log('req.query start', start)
    console.log('req.query end', end)
    console.log('req.query type', type)
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
  });
    res.status(200).json({
        message: 'ok',
        result,
        qty: result.length
    })

};

module.exports = {
  getPaymentsByPeriod: ctrlWrapper(getPaymentsByPeriod),
};
