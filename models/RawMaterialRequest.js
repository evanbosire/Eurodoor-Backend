const mongoose = require("mongoose");

const rawMaterialRequestSchema = new mongoose.Schema({
  materialName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true }, // <-- New field for units like "kgs", "pieces", etc.
  note: { type: String },
  supplier: { type: String, required: true },

  status: {
    type: String,
    enum: [
      "pending", "approved", "rejected",
      "supplied", "accepted", "rejected-by-inventory"
    ],
    default: "pending"
  },

  unitCost: { type: Number },
  totalCost: { type: Number },
  amountPaid: { type: Number }, // ✅ New field
  paymentCode: { type: String },
   paymentDate: {
    type: Date, // ✅ Add this line
    default: null
  },
  paymentStatus: {
  type: String,
  enum: ["unpaid", "paid"],
  default: "unpaid",
},


  createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model("RawMaterialRequest", rawMaterialRequestSchema);
