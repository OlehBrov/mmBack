const { prisma } = require("../config/db/dbConfig");

const checkIfProductExist = async (products) => {
   return await prisma.products.findMany({
      where: { barcode: { in: products.map((p) => p.barcode) } },
    });
}

module.exports = checkIfProductExist