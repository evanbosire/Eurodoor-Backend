const mongoose = require("mongoose");
const PaymentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  code: {
    type: String,
    match: /^[A-Z0-9]{6,10}$/,
    required: true
  },
  amountPaid: { type: Number, required: true },
  status: {
    type: String,
    enum: ["paid", "confirmed"], // ✅ paid by customer, confirmed by finance
    default: "paid"
  }
}, { timestamps: true });
const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;