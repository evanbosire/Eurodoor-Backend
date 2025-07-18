// models/ServiceBooking.js
const mongoose = require("mongoose");

const ServiceBookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

  doorType: { type: String, required: true }, // e.g., "Glass Panel Door"

  locationDetails: {
    address: String,
    city: String,
    county: String,
    postalCode: String,
    instructions: String,
  },

  price: { type: Number, required: true },

  paymentCode: {
    type: String,
    required: true,
    validate: {
      validator: function (code) {
        return (
          /^[A-Z0-9]{10}$/.test(code) &&      // Ensure 10 characters (uppercase letters & digits only)
          (code.match(/\d/g) || []).length >= 2 // At least 2 digits
        );
      },
      message: "Payment code must be 10 characters long, include uppercase letters and at least 2 digits (e.g., MPE1JF2CTD)."
    }
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "confirmed"],
    default: "pending"
  },

  serviceStatus: {
    type: String,
    enum: [
      "requested",
      "payment_confirmed",
      "allocated_to_supervisor",
      "technician_assigned",
      "in_progress",
      "rendered",
      "supervisor_approved",
      "service_manager_confirmed",
      "completed"
    ],
    default: "requested"
  },

  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },

}, { timestamps: true });

module.exports = mongoose.model("ServiceBooking", ServiceBookingSchema);
