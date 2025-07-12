const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  message: String,
  reply: String,
  dispatchManager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" }
}, { timestamps: true });

const Feedback = mongoose.model("Feedback", FeedbackSchema);
module.exports = Feedback;
