const mongoose = require("mongoose");

const materialReleaseRequestSchema = new mongoose.Schema({
  materialName: { type: String, required: true },
  quantity: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "released","approved","rejected"],
    default: "pending"
  },
  requestedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MaterialReleaseRequest", materialReleaseRequestSchema);
