// routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const RawMaterialRequest = require("../models/RawMaterialRequest");
const ServiceBooking = require("../models/ServiceBooking");

// GET /api/reports/orders
router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({
        path: "customer",
        select: "customerName phone email",
      })
      .populate({
        path: "payment",
        select: "status",
      })
      .lean();

    const report = orders.map((order) => {
      return order.items.map((item) => ({
        orderId: order._id,
        customerName: order.customer?.customerName || "N/A",
        phone: order.customer?.phone || "N/A",
        email: order.customer?.email || "N/A",
        title: item.title,
        quantity: item.quantity,
        pricePerUnit: item.price,
        totalPrice: item.price * item.quantity,
        orderStatus: order.status,
        paymentStatus: order.payment?.status || "unpaid",
        createdAt: order.createdAt
      }));
    });

    // Flatten nested arrays
    const flatReport = report.flat();

    res.status(200).json(flatReport);
  } catch (error) {
    console.error("Failed to generate order report:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// GET /api/reports/suppliers
router.get("/suppliers", async (req, res) => {
  try {
    const requests = await RawMaterialRequest.find().lean();

    const report = requests.map((item) => ({
      supplier: item.supplier,
      materialName: item.materialName,
      unit: item.unit,
      quantity: item.quantity,
      unitCost: item.unitCost || 0,
      totalCost: item.totalCost || (item.unitCost && item.quantity ? item.unitCost * item.quantity : 0),
      paymentStatus: item.paymentStatus || "unpaid",
      status: item.status
    }));

    res.status(200).json(report);
  } catch (error) {
    console.error("Failed to generate supplier report:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// GET /api/reports/service-bookings
router.get("/service-bookings", async (req, res) => {
  try {
    const bookings = await ServiceBooking.find()
      .populate({
        path: "customer",
        select: "customerName phone email"
      })
      .lean();

    const report = bookings.map((booking) => ({
      customerName: booking.customer?.customerName || "N/A",
      phone: booking.customer?.phone || "N/A",
      email: booking.customer?.email || "N/A",
      bookingDate: booking.createdAt,
      service: booking.doorType,
      price: booking.price,
      paymentCode: booking.paymentCode,
      paymentStatus: booking.paymentStatus,
      serviceStatus: booking.serviceStatus
    }));

    res.status(200).json(report);
  } catch (error) {
    console.error("Error generating service booking report:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
