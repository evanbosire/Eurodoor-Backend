const mongoose = require("mongoose");

const assignedTaskSchema = new mongoose.Schema({
  doorName: String,
  quantity: Number,
  description: String,
  status: {
    type: String,
    enum: ["assigned","in-production", "completed", "approved"],
    default: "assigned"
  },
  assignedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("AssignedTask", assignedTaskSchema);
