const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Payment = require("../models/Payment");

// ✅ GET: View all approved orders ready for payment
router.get("/orders", async (req, res) => {
  const orders = await Order.find({ status: "approved" }).populate("customer items.product");
  res.json(orders);
});

// ✅ POST: Approve payment for a specific order
router.post("/approve/:orderId", async (req, res) => {
  const { code, amountPaid } = req.body;

  try {
    // Create payment entry
    const payment = await Payment.create({
      order: req.params.orderId,
      code,
      amountPaid,
      status: "approved"
    });

    // Update order status to "paid"
    const order = await Order.findById(req.params.orderId);
    order.status = "paid";
    await order.save();

    res.json({ message: "Payment approved", payment });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
