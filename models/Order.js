const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      quantity: Number,
      title: String,
      description: String,
      imageUrl: String,
      price: Number
    }
  ],
  total: Number,
  status: {
    type: String,
    enum: ["placed", "released", "shipped", "delivered"],
    default: "placed" 
  },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" }
}, { timestamps: true });

const Order = mongoose.model("Order", OrderSchema);
module.exports = Order;