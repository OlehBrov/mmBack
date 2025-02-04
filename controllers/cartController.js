const path = require("path");
const fs = require("fs/promises");
const { prisma } = require("../config/db/dbConfig");
const {
  ctrlWrapper,
  recipeReqCreator,
  preparePurchase,
  withResolvers,
  purchaseDbHandler,
  addProductTaxGroup,
} = require("../helpers");
const { json } = require("express");

const fiscalPath = path.join(__dirname, "..", "data", "fiscalResponse.json");
const fiscalDataPath = path.join(__dirname, "..", "data", "fiscalData.json");
const { writer, setupPurchaseHandlers, interruptMsg } = require("../client");
const saleCheck = require("../api/fisclalApi");
const fakePurchaseProducts = require("../data/recipeRCpurchase.json");
const fakeBankResponse = require("../data/fakeTerminalResponse.json");
const { STORE_AUTH_ID } = process.env;
let cancelRequested = require("../client");

const { eventEmitter } = require("../client");

const Promise = require("bluebird");
const { wsServer } = require("../socket/heartbeat");
const { stat } = require("fs");

Promise.config({
  cancellation: true,
});

const createFakeTerminalResponce = async (purchData, key) => {
  const dateObj = new Date();
  const date = dateObj.getDate().toString().padStart(2, "0");
  const month = dateObj.getMonth();
  const corMonth = String(month + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  const seconds = dateObj.getSeconds().toString().padStart(2, "0");

  const resp = {
    ...fakeBankResponse,
    params: {
      ...fakeBankResponse.params, // Spread the existing `params` object
      amount: purchData.params.amount,
      date: `${date}.${corMonth}.${year}`,
      time: `${hours}:${minutes}:${seconds}`,
      merchantId: purchData.params.merchantId,
    },
    error: false,
    errorDescription: "",
  };
  const respError = {
    method: "Purchase",
    step: 0,
    params: {
      responseCode: 1001,
    },
    error: true,
    errorDescription: "Transaction canceled by user",
  };
  if (!key) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(respError);
      }, 10000); 
    });
  } else {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(resp);
      }, 10000);
    });
  }
};

const productsSell = async (req, res) => {
  
  if (!req.body || !req.body.cartProducts.length) {
    return res.status(400).json({
      message: "Failed to process the purchase",
      description: "No products to buy",
    });
  }

  const purchaseProducts = req.body;
  const store = await prisma.Store.findFirst({
    where: { auth_id: STORE_AUTH_ID },
  });
  const withVATProducts = {
    ...purchaseProducts,
    cartProducts: [],
  };
  const noVATProducts = {
    ...purchaseProducts,
    cartProducts: [],
  };

  addProductTaxGroup(
    purchaseProducts.cartProducts,
    store,
    noVATProducts,
    withVATProducts
  );

  // for (const product of purchaseProducts.cartProducts) {

  //   console.log("purchaseProducts.cartProducts product", product);
  //   if (product.merchant === "both") {
  //     if (product.is_VAT_Excise) {
  //       console.log('merchant === "both" product.is_VAT_Excise', product);
  //       withVATProducts.cartProducts.push(product);
  //     } else {
  //       noVATProducts.cartProducts.push(product);
  //     }
  //   } else if (product.merchant === "VAT") {
  //     withVATProducts.cartProducts.push(product);
  //   } else {
  //     // if (product.merchant === "noVAT")
  //     noVATProducts.cartProducts.push(product);
  //   }
  // }

  if (
    !withVATProducts.cartProducts.length &&
    !noVATProducts.cartProducts.length
  ) {
    return res.status(400).json({
      message: "Failed to process the purchase",
      description: "No products to buy",
    });
  }

  let purchaseNoVAT, purchaseWithVAT;

  if (noVATProducts.cartProducts.length) {
    purchaseNoVAT = preparePurchase(
      noVATProducts,
      store.default_merchant,
      "noVat"
    );
  }

  if (withVATProducts.cartProducts.length && store.VAT_excise_merchant) {
    purchaseWithVAT = preparePurchase(
      withVATProducts,
      store.VAT_excise_merchant,
      "vat"
    );
  }

  if (!purchaseNoVAT && !purchaseWithVAT) {
    return res.status(400).json({
      message: "Failed to process the purchase",
      description: "Invalid sum",
    });
  }

  // if (!purchase) {
  //   return res.status(400).json({
  //     message: "Failed to process the purchase",
  //     description: "Invalid sum",
  //   });
  // }
  // console.log("purchase 1", purchase);
  /*
to terminal
*/
  // const {
  //   promise: transactionPromise,
  //   resolve,
  //   reject,
  //   cancel,
  // } = withResolvers();
  // setupPurchaseHandlers(resolve, reject);

  eventEmitter.once("cancelPurchase", () => {
    console.log("Cancellation success requested");
    cancel({
      error: true,
      errorDescription: "Purchase cancelled by user",
    });
  });

  // const response = await createFakeTerminalResponce(purchase);
  try {
    let responseNoVAT, responseWithVAT;
    if (
      withVATProducts.cartProducts.length &&
      noVATProducts.cartProducts.length
    ) {
      wsServer.emit("twoPurchases");
    }
    const fiscalData = {
      noVAT: null,
      withVAT: null,
    };
    const fiscalResponse = {
      fiscalNoVAT: null,
      fiscalWithVAT: null,
    };
    if (purchaseNoVAT) {
      // await writer(purchaseNoVAT).catch(reject);
      // responseNoVAT = await transactionPromise;
      console.log("purchaseNoVAT", purchaseNoVAT);
      responseNoVAT = await createFakeTerminalResponce(purchaseNoVAT, true);

      if (responseNoVAT.error) {
        console.log("responseNoVAT.error", responseNoVAT.error);
        return res
          .status(403)
          .json({ errorDescription: responseNoVAT.errorDescription });
      }
      fiscalData.noVAT = await recipeReqCreator(noVATProducts, responseNoVAT);
      const toFiscalisationData = { ...fiscalData.noVAT, withVat: false };
      fiscalResponse.fiscalNoVAT = await saleCheck(toFiscalisationData);
      // fiscalResponse.fiscalNoVAT = await saleCheck(fiscalData.noVAT);

      if (!responseNoVAT.error && responseNoVAT.method === "Purchase") {
        await purchaseDbHandler(noVATProducts, responseNoVAT, fiscalResponse.fiscalNoVAT);
      }
    }

    if (purchaseWithVAT) {
      if (purchaseNoVAT) {
        wsServer.emit("secondPayment");
      }
      // await writer(purchaseWithVAT).catch(reject);
      // responseWithVAT = await transactionPromise;
      console.log("purchaseWithVAT", purchaseWithVAT);
      responseWithVAT = await createFakeTerminalResponce(purchaseWithVAT, true);

      if (responseWithVAT.error) {
        console.log(
          "Error in purchaseWithVAT:",
          responseWithVAT.errorDescription
        );
        return res.status(200).json({
          status: "part-success",
          fiscalResponse: {
            fiscalNoVAT: fiscalResponse.fiscalNoVAT,
          },
          error: {
            target: "withVATProducts",
            description: responseWithVAT.errorDescription,
          },
        });
      }
      fiscalData.withVAT = await recipeReqCreator(
        withVATProducts,
        responseWithVAT
      );

      const toFiscalisationData = { ...fiscalData.withVAT, withVat: true };
      // fiscalResponse.fiscalWithVAT = await saleCheck(fiscalData.withVAT);

      fiscalResponse.fiscalWithVAT = await saleCheck(toFiscalisationData);
     
      if (!responseWithVAT.error && responseWithVAT.method === "Purchase") {
        await purchaseDbHandler(withVATProducts, responseWithVAT, fiscalResponse.fiscalWithVAT);
      }
    }

   
    console.log("fiscalResponse", fiscalResponse);
    res.status(200).send({
      status: "success",
      fiscalResponse,
    });
  } catch (error) {
  
    if (
      error.error &&
      error.errorDescription === "Purchase cancelled by user"
    ) {
      return res.status(403).json({ errorDescription: error.errorDescription });
    }
    console.error("Unexpected error during purchase:", error);
    res.status(500).json({ errorDescription: "An unexpected error occurred" });
  }
};

const cancelSell = async (req, res) => {
  cancelRequested = true; 
  const response = await new Promise((resolve, reject) => {
    setupPurchaseHandlers(resolve, reject);
    writer(interruptMsg).catch(reject);
  }).catch((error) => {
    console.error("Promise was rejected due to:", error.message);
    res
      .status(500)
      .json({ message: "Cancellation failed", description: error.message });
    return;
  });

  if (response && !response.error) {
    res.status(200).json({ message: "Оплата відмінена покупцем" });
  } else {
    res.status(400).json({
      message: "Failed to cancel the purchase",
      description: response ? response.errorDescription : "No response",
    });
  }
};

module.exports = {
  productsSell: ctrlWrapper(productsSell),
  cancelSell: ctrlWrapper(cancelSell),
};
