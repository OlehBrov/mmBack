const path = require("path");
const fs = require("fs/promises");
const purPath = path.join(__dirname, "..", "data", "recipeRCpurchase.json");
const transDataPath = path.join(
  __dirname,
  "..",
  "data",
  "RCtransactionData.json"
);

const recipeReqCreator = async (purchase, transactionData) => {
  await fs.writeFile(purPath, JSON.stringify(purchase, null, 2));
  await fs.writeFile(transDataPath, JSON.stringify(transactionData, null, 2));
  try {
    const transactionDate = transactionData.params.date
      .split(".")
      .reverse()
      .join("");
    const transactionTime = transactionData.params.time.split(":").join("");
    const dt = transactionDate.concat(transactionTime);
    const prodRows = purchase.map((prod) => {
      const prPerRow = prod.price * prod.total;
      return {
        code: prod.article || "0", //Артикул товару
        code1: prod.barcode || "0", // ШК товару
        code_a: prod.mark || "0", //Код акцизної марки товару
        name: prod.name,
        cnt: prod.total, //Кількість товару (не більше 3х знаків після коми)
        price: prod.price,
        disc: 0.0, //Знижка на рядок чеку
        cost: parseFloat(prPerRow.toFixed(2)), //Сума по рядку до знижки
        taxgrp: 7, //Код податкової групи
      };
    });

    return {
      dt: dt,
      tag: "",
      cashier: "Касир_00", //Інформація про касира
      fiscal: {
        task: 1,
        receipt: {
          sum: parseFloat(transactionData.params.amount),
          round: 0.0,
          comment_up: "Ваші покупки",
          comment_down: "Дякуємо за покупку",
          rows: prodRows,
          pays: [
            {
              type: 2, //Код виду оплати - card.
              sum: parseFloat(transactionData.params.amount),
              comment: "Коментар на рядок оплати", //Коментар на рядок оплати
              paysys: transactionData.params.paymentSystem,
              rrn: transactionData.params.rrn, //Код транзакції
              cardmask: transactionData.params.pan, //Замаскований номер картки
              term_id: transactionData.params.terminalId, //Ідентифікатор платіжного терміналу
              bank_id: transactionData.params.bankAcquirer, //Ідентифікатор банку
              auth_code: transactionData.params.approvalCode, //Код авторизації
            },
          ],
        },
      },
    };
  } catch (error) {
    return null;
  }
};

module.exports = recipeReqCreator;