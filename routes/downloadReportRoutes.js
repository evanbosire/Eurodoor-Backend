// routes/downloadReportRoutes.js
const express = require("express");
const PDFDocument = require("pdfkit");
const moment = require("moment");
const Order = require("../models/Order");
const RawMaterialRequest = require("../models/RawMaterialRequest");
const ServiceBooking = require("../models/ServiceBooking");

const router = express.Router();

// Utility: Set headers and pipe PDF
function setupPDFStream(res, fileName) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return new PDFDocument({ margin: 40 });
}

// Utility: Add common header
function addPDFHeader(doc, title) {
  doc.fontSize(20).text("EURODOOR", { align: "center" }).moveDown(0.2);
  doc.fontSize(16).text(title, { align: "center" }).moveDown(1);
  doc.fontSize(12).text(`Generated on: ${moment().format("MMMM Do YYYY, h:mm:ss a")}`).moveDown();
}

// Utility: Draw table headers
function drawTableHeader(doc, headers, positions, y) {
  doc.font("Helvetica-Bold").fontSize(10);
  headers.forEach((text, i) => {
    doc.text(text, positions[i], y);
  });
  doc.moveTo(40, y + 12).lineTo(570, y + 12).stroke();
  doc.font("Helvetica");
}

// Utility: Draw table row
function drawTableRow(doc, data, positions, y) {
  doc.fontSize(9);
  data.forEach((text, i) => {
    doc.text(String(text), positions[i], y, { width: 100 });
  });
}

// 📄 DOWNLOAD: Orders Report PDF
router.get("/download/orders", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({ path: "customer", select: "customerName phone email" })
      .populate({ path: "payment", select: "status" })
      .lean();

    const report = orders.flatMap((order) =>
      order.items.map((item) => ({
        customerName: order.customer?.customerName || "N/A",
        title: item.title,
        quantity: item.quantity,
        pricePerUnit: item.price,
        totalPrice: item.price * item.quantity,
        paymentStatus: order.payment?.status || "unpaid",
        orderStatus: order.status,
        date: moment(order.createdAt).format("YYYY-MM-DD"),
      }))
    );

    const doc = setupPDFStream(res, "order_report.pdf");
    doc.pipe(res);
    addPDFHeader(doc, "ORDER REPORT");

    const headers = ["Customer", "Product", "Qty", "Unit", "Total", "Payment", "Status", "Date"];
    const positions = [40, 120, 250, 280, 340, 410, 470, 530];
    let y = 160;

    drawTableHeader(doc, headers, positions, y);
    y += 20;

    report.forEach((row) => {
      if (y > 750) {
        doc.addPage();
        y = 60;
        drawTableHeader(doc, headers, positions, y);
        y += 20;
      }
      drawTableRow(doc, [
        row.customerName,
        row.title,
        row.quantity,
        `KES ${row.pricePerUnit}`,
        `KES ${row.totalPrice}`,
        row.paymentStatus,
        row.orderStatus,
        row.date,
      ], positions, y);
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error("Error generating order report PDF:", err);
    res.status(500).json({ message: "Failed to download order report." });
  }
});

// 📄 DOWNLOAD: Supplier Report PDF
router.get("/download/suppliers", async (req, res) => {
  try {
    const data = await RawMaterialRequest.find().lean();
    const report = data.map((item) => ({
      supplier: item.supplier,
      materialName: item.materialName,
      unit: item.unit,
      quantity: item.quantity,
      unitCost: item.unitCost || 0,
      totalCost: item.totalCost || item.unitCost * item.quantity,
      paymentStatus: item.paymentStatus || "unpaid",
      status: item.status,
    }));

    const doc = setupPDFStream(res, "supplier_report.pdf");
    doc.pipe(res);
    addPDFHeader(doc, "SUPPLIER REPORT");

    const headers = ["Supplier", "Material", "Unit", "Qty", "Unit Cost", "Total", "Payment", "Status"];
    const positions = [40, 120, 240, 270, 310, 370, 440, 510];
    let y = 160;

    drawTableHeader(doc, headers, positions, y);
    y += 20;

    report.forEach((row) => {
      if (y > 750) {
        doc.addPage();
        y = 60;
        drawTableHeader(doc, headers, positions, y);
        y += 20;
      }
      drawTableRow(doc, [
        row.supplier,
        row.materialName,
        row.unit,
        row.quantity,
        `KES ${row.unitCost}`,
        `KES ${row.totalCost}`,
        row.paymentStatus,
        row.status,
      ], positions, y);
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error("Error generating supplier report PDF:", err);
    res.status(500).json({ message: "Failed to download supplier report." });
  }
});

// 📄 DOWNLOAD: Service Booking Report PDF
router.get("/download/service-bookings", async (req, res) => {
  try {
    const bookings = await ServiceBooking.find()
      .populate({ path: "customer", select: "customerName phone email" })
      .lean();

    const report = bookings.map((b) => ({
      customerName: b.customer?.customerName || "N/A",
      email: b.customer?.email || "N/A",
      phone: b.customer?.phone || "N/A",
      bookingDate: moment(b.createdAt).format("YYYY-MM-DD"),
      service: b.doorType,
      price: b.price,
      paymentCode: b.paymentCode,
      paymentStatus: b.paymentStatus,
      serviceStatus: b.serviceStatus,
    }));

    const doc = setupPDFStream(res, "service_booking_report.pdf");
    doc.pipe(res);
    addPDFHeader(doc, "SERVICE BOOKINGS REPORT");

    const headers = ["Customer", "Service", "Price", "Code", "Payment", "Status", "Date"];
    const positions = [40, 150, 250, 310, 390, 460, 530];
    let y = 160;

    drawTableHeader(doc, headers, positions, y);
    y += 20;

    report.forEach((row) => {
      if (y > 750) {
        doc.addPage();
        y = 60;
        drawTableHeader(doc, headers, positions, y);
        y += 20;
      }
      drawTableRow(doc, [
        row.customerName,
        row.service,
        `KES ${row.price}`,
        row.paymentCode,
        row.paymentStatus,
        row.serviceStatus,
        row.bookingDate,
      ], positions, y);
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error("Error generating service booking report PDF:", err);
    res.status(500).json({ message: "Failed to download service bookings report." });
  }
});

module.exports = router;
