const mongoose = require("mongoose");

const productionRequestSchema = new mongoose.Schema({
  doorName: { type: String, required: true },
  quantity: { type: Number, required: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: [
      "pending",
      "door-requested",
      "door-approved",
      "door-assigned",
      "in-production",
      "completed",
      "approved"
    ],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ProductionRequest", productionRequestSchema);
