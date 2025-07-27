// models/ToolRequest.js
const mongoose = require("mongoose");

const toolRequestSchema = new mongoose.Schema({
  technicianEmail: { type: String, required: true }, // referencing technician email
  tools: [
    {
      toolId: { type: mongoose.Schema.Types.ObjectId, ref: "Tool" },
      quantityRequested: { type: Number },
      quantityApproved: { type: Number, default: 0 },
      quantityReturned: { type: Number, default: 0 },
      returnStatus: {
        type: String,
        enum: ["Pending", "Partially Returned", "Fully Returned", "Not Returned", "Returned"],
        default: "Not Returned"
      }
    }
  ],
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  requestDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ToolRequest", toolRequestSchema);

