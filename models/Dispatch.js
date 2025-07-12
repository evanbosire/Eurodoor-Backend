const mongoose = require("mongoose");

const DispatchSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  status: {
    type: String,
    enum: ["assigned", "delivered"],
    default: "assigned"
  }
}, { timestamps: true });

const Dispatch = mongoose.model("Dispatch", DispatchSchema);
module.exports = Dispatch;
