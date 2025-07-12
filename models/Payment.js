const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  code: {
    type: String,
    match: /^[A-Z0-9]{6,10}$/, // Alphanumeric code max 10 characters
    required: true,
  },
  amountPaid: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "approved"],
    default: "pending",
  },
}, { timestamps: true });

const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;
