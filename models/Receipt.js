const mongoose = require("mongoose");

const ReceiptSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
  amountPaid: { type: Number, required: true },
  code: { type: String },
  generatedAt: { type: Date, default: Date.now }
});

const Receipt = mongoose.model("Receipt", ReceiptSchema);
module.exports = Receipt;
