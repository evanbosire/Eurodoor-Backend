// models/ServiceFeedback.js
const mongoose = require("mongoose");



const ServiceFeedbackSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceBooking" },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  message: String,
  reply: String,
  serviceManager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" }
}, { timestamps: true });

module.exports = mongoose.model("ServiceFeedback", ServiceFeedbackSchema);

