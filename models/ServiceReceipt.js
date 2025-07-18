const mongoose = require("mongoose");

const serviceReceiptSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceBooking",
    required: true,
  },
  amountPaid: {
    type: Number,
    required: true,
  },
  code: {
    type: String, // e.g., M-PESA code
    required: true,
  },
  receiptUrl: {
    type: String, // path to the generated PDF
    required: true,
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ServiceReceipt", serviceReceiptSchema);
