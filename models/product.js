const { Schema, model } = require("mongoose");

const productSchema = new Schema({
  name: String,
  barcode: Number,

  image: String,
  category: [String],
  description: String,
  price: Number,
  discount: [Number],
});

productSchema.virtual("totalQuantity").get(async function () {
  const result_1 = await this.model("micromarkets-stores")
        .aggregate([
            { $unwind: "$availableProductsOnUnit" },
            { $match: { "availableProductsOnUnit.product": this._id } },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$availableProductsOnUnit.quantity" },
                },
            },
        ]);
    return (result_1[0] && result_1[0].total) || 0;
});

const Product = model("micromarkets-product", productSchema);
module.exports = Product;
// async function updateProductQuantities() {
//   const products = await Product.find();
//   for (const product of products) {
//     const totalQuantity = await product.totalQuantity;
//     product.quantity = totalQuantity;
//     await product.save();
//   }
// }

// // Update product quantities
// updateProductQuantities()
//   .then(() => console.log('Product quantities updated'))
//   .catch(err => console.error('Error updating product quantities:', err));
