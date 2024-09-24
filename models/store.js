const { Schema, model } = require("mongoose");

const storeShema = new Schema({
  name: String,
  auth_id: Number,
  password: String,
  role: { type: String, default: "store" },
  token: {
    type: String,
    default: "",
  },
  adress: { type: String, default: "Kyiv" },
  availableProductsOnUnit: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "micromarkets-product",
      },

      quantity: Number,
    },
  ],
  soldProductsOnUnit: [
    {
      date: Date,
      soldProducts: [
        {
          product: {
            type: Schema.Types.ObjectId,
            ref: "micromarkets-product",
          },
          quantity: Number,
        },
      ],
    },
  ],

  cart: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "micromarkets-product",
      },
      quantity: Number,
    },
  ],
});

const Store = model("micromarkets-store", storeShema);
module.exports = Store;
