const mongoose = require("mongoose");

const InventoryLogSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  type: { type: String, enum: ["add", "release"], required: true },
  quantity: Number,
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }
}, { timestamps: true });

const InventoryLog = mongoose.model("InventoryLog", InventoryLogSchema);
module.exports = InventoryLog;
