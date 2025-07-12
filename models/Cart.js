const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: Number
  }]
}, { timestamps: true });

const Cart = mongoose.model("Cart", CartSchema);
module.exports = Cart;
