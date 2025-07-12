const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: Number
  }],
  total: Number,
  status: {
    type: String,
    enum: ["pending", "approved", "paid", "released", "dispatched", "delivered"],
    default: "pending"
  }
}, { timestamps: true });

const Order = mongoose.model("Order", OrderSchema);
module.exports = Order;
