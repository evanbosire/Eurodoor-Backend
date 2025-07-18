// models/Feedback.js
const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  message: { type: String, required: true },
  reply: String,
  dispatchManager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
}, { timestamps: true });

const Feedback = mongoose.model("Feedback", FeedbackSchema);
module.exports = Feedback;
