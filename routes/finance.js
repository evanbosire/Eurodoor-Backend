const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Payment = require("../models/Payment");


// GET /api/finance/placed-orders
router.get("/placed-orders", async (req, res) => {
  const orders = await Order.find({ status: "placed" })
    .populate({
      path: "payment",
      match: { status: "paid" } // Only show paid but unconfirmed
    })
    .populate("customer")
    .populate("items.product");

  // Filter out orders with no matching payment (status !== "paid")
  const filtered = orders.filter(order => order.payment);

  res.json(filtered);
});


// PUT /api/finance/confirm-payment/:paymentId
router.put("/confirm-payment/:paymentId", async (req, res) => {
  const payment = await Payment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ message: "Payment not found" });

  payment.status = "confirmed";
  await payment.save();

  res.json({ message: "Payment confirmed", payment });
});
// GET /api/finance/confirmed-payments
router.get("/confirmed-payments", async (req, res) => {
  try {
    const confirmedPayments = await Payment.find({ status: "confirmed" })
      .populate("order")
      .populate("customer"); // optional, if you want customer info too

    res.status(200).json(confirmedPayments);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
