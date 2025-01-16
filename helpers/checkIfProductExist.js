const { prisma } = require("../config/db/dbConfig");

const checkIfProductExist = async (products) => {
    console.log('CHECKIFPRODUCTSEXIST invoke')
   return await prisma.products.findMany({
      where: { barcode: { in: products.map((p) => p.barcode) } },
    });
}

module.exports = checkIfProductExist