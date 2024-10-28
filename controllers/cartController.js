const path = require("path");
const fs = require("fs/promises");
const {
  ctrlWrapper,
  recipeReqCreator,
  preparePurchase,
  withResolvers,
  purchaseDbHandler,
} = require("../helpers");
const { json } = require("express");

const fiscalPath = path.join(__dirname, "..", "data", "fiscalResponse.json");
const fiscalDataPath = path.join(__dirname, "..", "data", "fiscalData.json");
const { writer, setupPurchaseHandlers, interruptMsg } = require("../client");
const saleCheck = require("../api/fisclalApi");
const fakePurchaseProducts = require("../data/recipeRCpurchase.json");
const fakeBankResponse = require("../data/fakeTerminalResponse.json");

let cancelRequested = require("../client");

const { eventEmitter } = require("../client");

const Promise = require("bluebird");

Promise.config({
  cancellation: true,
});

const createFakeTerminalResponce = (purchData) => {
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
    },
    error: false,
    errorDescription: "",
  };

  return resp;
};

const productsSell = async (req, res) => {
  console.log()
  if (!req.body || !req.body.cartProducts.length) {
    return res.status(400).json({
      message: "Failed to process the purchase",
      description: "No products to buy",
    });
  }

  const purchaseProducts = req.body;
  console.log("purchaseProducts", purchaseProducts);
  const purchase = preparePurchase(purchaseProducts);

  if (!purchase) {
    return res.status(400).json({
      message: "Failed to process the purchase",
      description: "Invalid sum",
    });
  }
  console.log("purchase 1", purchase);
  /*
to terminal
  const {
    promise: transactionPromise,
    resolve,
    reject,
    cancel,
  } = withResolvers();
  setupPurchaseHandlers(resolve, reject);
  writer(purchase).catch(reject);

  eventEmitter.on("cancelPurchase", () => {
    console.log("Cancellation success requested");
    cancel({
      error: true,
      errorDescription: "Purchase cancelled by user",
    });
    
  });
 */

  const response = createFakeTerminalResponce(purchase);
  
  //REAL transaction
  // const response = await transactionPromise;

  console.log("Transaction completed:", response);
  if (response.error) {
    // throw new Error(response.errorDescription);
    return res.status(403).json({errorDescription:response.errorDescription})

  }
  if (!response.error && response.method === "Purchase") {
  purchaseDbHandler(purchaseProducts, response)
}
  const fiscalData = await recipeReqCreator(purchaseProducts, response);
  const fiscalResponse = await saleCheck(fiscalData);

  res.status(200).send(fiscalResponse);

  // } catch (error) {
  //   console.log("Transaction error:", error);
  //   res.status(400).json({
  //     message: "Failed to process the purchase",
  //     description: error.message || "Unknown error",
  //   });
  // }
};

// const productsSell = async (req, res) => {
//   if (!req.body || !req.body.length) {
//     res.status(400).json({
//       message: "Failed to process the purchase",
//       description: "No products to buy",
//     });
//     return; // Return here to stop further execution
//   }
//   const purchaseProducts = req.body;

//   const purchase = preparePurchase(purchaseProducts);
//   console.log("purchase", purchase);
//   if (!purchase) {
//     // Check if purchase preparation failed
//     return res.status(400).json({
//       message: "Failed to process the purchase",
//       description: "Invalid sum",
//     });
//   }
//   try {
//     const response = await new Promise((resolve, reject) => {
//       setupPurchaseHandlers(resolve, reject); // Pass resolve and reject to setup handlers
//       writer(purchase).catch(reject); // Call writer and pass reject to handle errors
//     });
//     console.log("productsSell response", response);
//     if (response.error) {
//       res.status(400).json({
//         message: "Failed to process the purchase",
//         description: response.errorDescription,
//       });
//       return; // Return here to stop further execution
//     }
//     //   // const fiscalData = await recipeReqCreator(purchaseProducts, response);

//     //   const fiscalData = await recipeReqCreator(
//     //     fakePurchaseProducts,
//     //     fakeBankResponse
//     //   );
//     //  if (!fiscalData) {
//     //     return res.status(400).json({
//     //       message: "Failed to process the purchase",
//     //       description: "Invalid recipe create",
//     //     });
//     //   }
//     //   await fs.writeFile(fiscalDataPath, JSON.stringify(fiscalData, null, 2)); // For debug

//     //   const fiscalResponse = await saleCheck(fiscalData);
//     //   console.log("fiscalResponse", fiscalResponse);
//     //   await fs.writeFile(fiscalPath, JSON.stringify(fiscalResponse, null, 2)); // For debug
//     //   setTimeout(() => {
//     //     res.status(200).send(fiscalResponse);
//     //   }, 5000);
//   } catch (error) {
//     console.log("error in productsSell catch", error);
//     res.status(400).json({
//       message: "Failed to process the purchase",
//       description: error.response.errorDescription,
//     });
//   }
//   finalizeTransaction()
// };
// const cancelSell = async (req, res, next) => {
//   cancelRequested = true;
//   const response = await new Promise((resolve, reject) => {
//     setupPurchaseHandlers(resolve, reject); // Pass resolve and reject to setup handlers
//     writer(interruptMsg).catch(reject); // Call writer and pass reject to handle errors
//   });
//   console.log("response cancelSell", response);
//   if (response.error) {
//     res.status(400).json({
//       message: "Failed to process the purchase",
//       description: response.errorDescription,
//     });
//     return; // Return here to stop further execution
//   }
//   res.status(200).json({
//     message: "Оплата відмінена  покупцем",
//   });
// };
const cancelSell = async (req, res) => {
  cancelRequested = true; // Set cancellation flag
  const response = await new Promise((resolve, reject) => {
    setupPurchaseHandlers(resolve, reject);
    writer(interruptMsg).catch(reject);
  }).catch((error) => {
    console.log("Promise was rejected due to:", error.message);
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
