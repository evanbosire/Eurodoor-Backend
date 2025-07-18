const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Feedback = require("../models/Feedback");
const Receipt = require("../models/Receipt");
const Payment = require("../models/Payment");
const Customer = require("../models/Customer");

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// ✅ View products with merged quantities by title
router.get("/products", async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$title", // Group by title
          productId: { $first: "$_id" }, // Get the first product _id
          description: { $first: "$description" },
          price: { $first: "$price" },
          status: { $first: "$status" },
          imageUrl: { $first: "$imageUrl" },
          quantity: { $sum: "$quantity" },
        },
      },
      {
        $project: {
          _id: 0,
          id: "$productId", // Return as 'id' (or '_id' if preferred)
          title: "$_id",
          description: 1,
          price: 1,
          status: 1,
          imageUrl: 1,
          quantity: 1,
        },
      },
    ]);

    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/customer/get-id
router.post("/get-id", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const customer = await Customer.findOne({ email });
  if (!customer) {
    console.log("Customer not found in DB");
    return res.status(404).json({ message: "Customer not found" });
  }
  res.json({ _id: customer._id });
});

// ✅ Add product to cart
router.post("/cart/add", async (req, res) => {
  const { customerId, productId, quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  let cart = await Cart.findOne({ customer: customerId });
  if (!cart) {
    cart = new Cart({ customer: customerId, items: [] });
  }

  // ✅ Check if product already exists in cart
  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId
  );

  if (existingItem) {
    // ✅ If exists, update quantity
    existingItem.quantity += quantity;
  } else {
    // ✅ Else, push new item
    cart.items.push({
      product: product._id,
      quantity,
      title: product.title,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price,
    });
  }

  await cart.save();
  res.json(cart);
});

// ✅ View Cart with Total
router.get("/cart/view/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const cart = await Cart.findOne({ customer: customerId }).populate(
      "items.product"
    );

    if (!cart || cart.items.length === 0) {
      return res
        .status(200)
        .json({ message: "Cart is empty", items: [], total: 0 });
    }

    // ✅ Calculate total price
    let total = 0;
    cart.items.forEach((item) => {
      if (item.product && item.product.price) {
        total += item.quantity * item.product.price;
      }
    });

    res.status(200).json({
      message: "Cart retrieved successfully",
      cart,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
router.put("/cart/update", async (req, res) => {
  const { customerId, productId, quantity } = req.body;

  const cart = await Cart.findOne({ customer: customerId });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  const item = cart.items.find((item) => item.product.toString() === productId);
  if (!item) return res.status(404).json({ message: "Product not in cart" });

  item.quantity = quantity; // update to new quantity
  await cart.save();

  res.status(200).json({ message: "Cart updated", cart });
});
// delete from cart
router.delete("/cart/remove", async (req, res) => {
  const { customerId, productId } = req.body;

  const cart = await Cart.findOne({ customer: customerId });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  // ✅ Filter out the product
  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId
  );

  await cart.save();
  res.status(200).json({ message: "Item removed", cart });
});

// POST /api/payment
router.post("/payment", async (req, res) => {
  const { customerId, code, amountPaid } = req.body;

  const cart = await Cart.findOne({ customer: customerId }).populate(
    "items.product"
  );
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  // Calculate total
  let total = 0;
  const items = cart.items.map((item) => {
    total += item.quantity * item.product.price;
    return {
      product: item.product._id,
      quantity: item.quantity,
      title: item.product.title,
      description: item.product.description,
      imageUrl: item.product.imageUrl,
      price: item.product.price,
    };
  });

  if (amountPaid < total) {
    return res.status(400).json({ message: "Insufficient amount paid" });
  }

  // Create payment with status "paid"
  const payment = new Payment({
    customer: customerId,
    code,
    amountPaid,
    status: "paid",
  });

  // Create order with status "placed"
  const order = new Order({
    customer: customerId,
    items,
    total,
    status: "placed",
    payment: payment._id,
  });

  payment.order = order._id;

  await order.save();
  await payment.save();
  await Cart.deleteOne({ _id: cart._id });

  res.status(201).json({ message: "Payment successful. Order placed.", order });
});

// ✅ View own orders
router.get("/orders/:customerId", async (req, res) => {
  const orders = await Order.find({ customer: req.params.customerId }).populate(
    "items.product"
  );
  res.json(orders);
});

// ✅ Submit feedback with validation
router.post("/feedback/:orderId", async (req, res) => {
  try {
    const { customerId, message } = req.body;
    const { orderId } = req.params;

    // Validate required fields
    if (!customerId || !message) {
      return res.status(400).json({ message: "Both customerId and message are required" });
    }
    // Create and save feedback
    const feedback = await Feedback.create({
      order: orderId,
      customer: customerId,
      message: message.trim(),
    });

    // Respond with the created feedback
    res.status(201).json(feedback);

  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// ✅ GET: View all feedbacks and replies for a specific customer
router.get("/replies/:customerId", async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ customer: req.params.customerId })
      .populate({
        path: "order",
        select: "items total status"
      })
      .populate({
        path: "dispatchManager",
        select: "name email role"
      });

    res.json(feedbacks);
  } catch (error) {
    console.error("Error fetching customer feedbacks:", error);
    res.status(500).json({ message: "Failed to fetch feedbacks" });
  }
});

router.get("/receipt/:orderId", async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate(
      "items.product customer"
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    const payment = await Payment.findOne({
      order: order._id,
      status: "confirmed",
    });
    if (!payment)
      return res.status(400).json({ message: "Payment not confirmed yet" });

    const receiptsDir = path.join(__dirname, "../public/receipts");
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const receiptPath = path.join(receiptsDir, `${order._id}.pdf`);
    const writeStream = fs.createWriteStream(receiptPath);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(writeStream);

    // === Header ===
    doc.fontSize(22).fillColor("#003366").text("EuroDoor", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(18)
      .fillColor("#000000")
      .text("Customer Order Receipt", { align: "center" });
    doc.moveDown();

    // === Customer Info ===
    const customer = order.customer;
    doc.fontSize(12);
    doc.text(`Receipt ID: ${order._id}`);
    doc.text(`Customer Name: ${customer.customerName}`);
    doc.text(`Customer Email: ${customer.email}`);
    if (customer.phone) doc.text(`Customer Phone: ${customer.phone}`);
    doc.moveDown();

    // === Product Table Header ===
    doc
      .fontSize(13)
      .fillColor("#003366")
      .text("Order Details:", { underline: true });
    doc.moveDown(0.5);

    // Table Column Titles
    doc.fontSize(12).fillColor("#000000");
    const y = doc.y;
    doc.text("No", 50, y);
    doc.text("Product", 100, y);
    doc.text("Qty", 300, y);
    doc.text("Unit Price", 350, y);
    doc.text("Subtotal", 450, y);
    doc
      .moveTo(50, y + 15)
      .lineTo(550, y + 15)
      .stroke();

    // Table Rows
    let total = 0;
    let rowY = y + 20;
    order.items.forEach((item, index) => {
      const subtotal = item.quantity * item.price;
      total += subtotal;

      doc.fontSize(11);
      doc.text(`${index + 1}`, 50, rowY);
      doc.text(item.title, 100, rowY, { width: 180 });
      doc.text(item.quantity.toString(), 300, rowY);
      doc.text(`KES ${item.price}`, 350, rowY);
      doc.text(`KES ${subtotal}`, 450, rowY);
      rowY += 20;
    });

    doc.moveTo(50, rowY).lineTo(550, rowY).stroke();
    rowY += 10;

    // === Payment Summary ===
    rowY += 20;
    doc
      .fontSize(12)
      .text(`Total Amount Paid: KES ${payment.amountPaid}`, 350, rowY, {
        align: "left",
      });

    rowY += 20;
    doc.text(`Payment Code (M-PESA): ${payment.code}`, 350, rowY, {
      align: "left",
    });

    rowY += 30;
    doc.text(`Payment Date: ${payment.createdAt.toDateString()}`, 350, rowY, {
      align: "left",
    });

    doc.moveDown(3);

    // === Footer ===
    doc.moveDown(2);
    doc.fontSize(10).fillColor("gray");

    // Use full page width and center-align
    doc.text("Thank you for shopping with EuroDoor!", 50, doc.y, {
      width: 500,
      align: "center",
    });
    doc.text("For inquiries, contact us at eurodoor@gmail.com", 50, doc.y, {
      width: 500,
      align: "center",
    });
    doc.end();

    writeStream.on("finish", async () => {
      const receiptUrl = `/receipts/${order._id}.pdf`;

      await Receipt.create({
        customer: customer._id,
        order: order._id,
        payment: payment._id,
        amountPaid: payment.amountPaid,
        code: payment.code,
        receiptUrl,
        generatedAt: new Date(),
      });

      res.status(200).json({
        message: "Receipt generated successfully",
        receiptUrl,
      });
    });

    writeStream.on("error", (err) => {
      console.error("Write stream error:", err);
      res.status(500).json({ message: "Error saving receipt file" });
    });
  } catch (err) {
    console.error("Error generating receipt:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
