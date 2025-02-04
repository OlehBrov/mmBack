const moment = require("moment");
const { prisma } = require("../config/db/dbConfig");

const purchaseDbHandler = async (
  cartProductsObject,
  bankResponse,
  fiscalData
) => {
  const { params } = bankResponse;
  const {
    fiscal,
    fiscal: {
      data: { items: fiscalProducts },
    },
    fiscal: {
      data: { taxes },
    },
  } = fiscalData;
  const products = cartProductsObject.cartProducts;

  const fiscalNumber = fiscal.fiscal_number;
  const companyName = fiscal.company_name;
  const companyCode = fiscal.company_edrpou;
  const rroNumber = fiscal.rro_fiscal_number;
  const isoDateCreated = fiscal.date_created;
  const checkUrl = fiscal.check_url;
  const targetUrl = fiscal.target_url;

  const productsFiscalsCombined = products.map((product) => {
    const { barcode } = product;
    const fiscalProduct = fiscalProducts.find((p) => p.code1 === barcode);
    return {
      ...product,
      fiscalProduct,
    };
  });
  const productsFiscalsTaxesCombined = productsFiscalsCombined.map(
    (fiscalProduct) => {
      const fiscalProductTaxGrp = fiscalProduct.fiscalProduct.tg_print;
      const itemTaxes = taxes.find(
        (tax) => tax.tg_print === fiscalProductTaxGrp
      );
      return {
        ...fiscalProduct,
        itemTaxes,
      };
    }
  );
  const removeProductsData = productsFiscalsTaxesCombined.map((product) => {
    const [day, month, year] = params.date.split(".");
    const isoDate = `${year}-${month}-${day}`;
    const isoDateTime = `${isoDate}T${params.time}`;
    const dateObject = moment(isoDateTime).toISOString(true);
    const validDateTime = moment(dateObject).format("YYYY-MM-DDTHH:mm:ss.SSS");
    // console.log('dateObject', dateObject)
    const {fiscalProduct, itemTaxes } = product;
    const taxPercent = parseFloat(itemTaxes.tax_percent);
    const taxSum = parseFloat(itemTaxes.tax_sum);
    const additionalTaxPercent = parseFloat(itemTaxes.dt_percent);
    const additionalTaxSum = parseFloat(itemTaxes.dt_sum);
    const productDiscount = parseFloat(fiscalProduct.discount?.sum) || 0
    return {
      product_id: product.id,
      remove_date: `${validDateTime}+00:00`,
      remove_quantity: product.inCartQuantity,
      remove_type_id: 1,
      remove_cost: product.product_price * product.inCartQuantity,
      load_id: product.product_lot,
      method: bankResponse.method,
      amount: params.amount,
      approvalCode: params.approvalCode,
      date: params.date,
      time: params.time,
      discount: productDiscount,
      pan: params.pan,
      responseCode: params.responseCode,
      rrn: params.rrn,
      rrnExt: params.rrnExt,
      bankAcquirer: params.bankAcquirer,
      paymentSystem: params.paymentSystem,
      subMerchant: params.subMerchant,
      product_sale_id: product.sale_id,
      fisc_fiscal_number: fiscalNumber,
      fisc_company_name: companyName,
      fisc_company_edrpou: companyCode,
      fisc_rro_fiscal_number: rroNumber,
      fisc_iso_date_created: isoDateCreated,
      fisc_check_url: checkUrl,
      fics_target_url: targetUrl,
      fisc_check_tax_name: itemTaxes.tg_name,
      fisc_check_tax_print: itemTaxes.tg_print,
      fisc_check_tax_percent: taxPercent,
      fisch_check_tax_sum: taxSum,
      fisc_tax_additional_tax_caption: itemTaxes.dt_caption,
      fisc_additional_tax_percent: additionalTaxPercent,
      fisc_additional_tax_sum: additionalTaxSum,
      internal_store_check_id: product.internalCheckId,
    };
  });

  // Enable in production
  // await prisma.RemoveProducts.createMany({
  //   data: removeProductsData,
  // });

  const updateProducts = async (productsToUpdate) => {
    await prisma.$transaction(async (tx) => {
      for (const product of productsToUpdate) {
        await prisma.LoadProducts.update({
          where: {
            id: product.load_id,
          },
          data: {
            products_left: {
              decrement: parseFloat(product.remove_quantity),
            },
          },
        });

        await tx.Products.update({
          where: {
            id: product.product_id,
          },
          data: {
            product_left: {
              decrement: parseFloat(product.remove_quantity),
            },
          },
        });
      }
    });
  };
  // Enable in production
  // await updateProducts(removeProductsData);
};

module.exports = purchaseDbHandler;
