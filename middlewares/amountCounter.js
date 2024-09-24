const httpError = require('../helpers')

const amountCounter = async (req, res, next) => {
  try {
    const totalAmount = req.body?.reduce((acc, item) => {
      return acc + item.price * item.total;
    }, 0);

   
    req.body.totalAmount = totalAmount;
    next();
  } catch {
    next(httpError(401, "Not authorized"));
  }
};

module.exports = amountCounter;