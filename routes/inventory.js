const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Order = require("../models/Order");
const InventoryLog = require("../models/InventoryLog");
const Payment = require("../models/Payment");
const ProductStore = require("../models/ProductStore");

// ✅ POST: Add or update product by title

// router.post("/products", async (req, res) => {
//   try {
//     const { title, description, price, quantity, status } = req.body;

//     // 🔎 1. Check in the ProductStore
//     const storeProduct = await ProductStore.findOne({ doorName: title });

//     if (!storeProduct) {
//       return res.status(404).json({ message: "Product not found in store." });
//     }

//     // ❌ Not enough quantity in store
//     if (storeProduct.quantity < quantity) {
//       return res.status(400).json({ message: "Insufficient quantity in store." });
//     }

//     // 🧮 Deduct quantity from ProductStore
//     storeProduct.quantity -= quantity;
//     await storeProduct.save();

//     // ✅ 2. Check if product already exists in main Product model
//     let product = await Product.findOne({ title });

//     if (product) {
//       // ✅ Update existing product (append quantity and optional fields)
//       product.quantity += quantity;
//       if (description) product.description = description;
//       if (price) product.price = price;
//       if (status) product.status = status;

//       await product.save();

//       return res.status(200).json({
//         message: "Product already exists. Quantity and details updated.",
//         product,
//       });
//     }

//     // 🆕 3. Create new product in Product model
//     const newProduct = new Product({
//       title,
//       description: description || storeProduct.description,
//       price: price || 0,
//       quantity,
//       status: status || "available"
//     });

//     await newProduct.save();

//     res.status(201).json({
//       message: "New product created from store.",
//       product: newProduct,
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(400).json({ message: err.message });
//   }
// });

// router.post("/products", async (req, res) => {
//   try {
//     const { title, description, price, quantity, status } = req.body;

//     // Check if a product with the same title exists
//     const existingProduct = await Product.findOne({ title });

//     if (existingProduct) {
//       // ✅ Product exists — increase quantity
//       existingProduct.quantity += quantity;
//       await existingProduct.save();
//       return res.status(200).json({
//         message: "Product already exists. Quantity updated.",
//         product: existingProduct,
//       });
//     }

//     // ✅ Product does not exist — create new
//     const newProduct = new Product({ title, description, price, quantity, status });
//     await newProduct.save();

//     res.status(201).json({
//       message: "New product created.",
//       product: newProduct,
//     });
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

router.post("/products", async (req, res) => {
  try {
    const { title, description, price, quantity, status } = req.body;

    const quantityNum = Number(quantity);
    const priceNum = Number(price);

    if (isNaN(quantityNum) || isNaN(priceNum)) {
      return res.status(400).json({ message: "Invalid price or quantity value." });
    }

    const storeProducts = await ProductStore.find({ doorName: title });

    if (!storeProducts.length) {
      return res.status(404).json({ message: "Product not found in the store." });
    }

    const totalAvailable = storeProducts.reduce((acc, item) => acc + item.quantity, 0);

    if (totalAvailable < quantityNum) {
      return res.status(400).json({ message: "Not enough quantity available in the store." });
    }

    let quantityToSubtract = quantityNum;
    for (const product of storeProducts) {
      if (quantityToSubtract === 0) break;

      if (product.quantity <= quantityToSubtract) {
        quantityToSubtract -= product.quantity;
        await ProductStore.findByIdAndDelete(product._id);
      } else {
        product.quantity -= quantityToSubtract;
        await product.save();
        quantityToSubtract = 0;
      }
    }

    const existingProduct = await Product.findOne({ title });

    if (existingProduct) {
      existingProduct.quantity += quantityNum;
      existingProduct.price = priceNum;
      existingProduct.description = description;
      await existingProduct.save();

      return res.status(200).json({
        message: "Product already exists. Quantity updated, price and description overwritten.",
        product: existingProduct,
      });
    }

    const newProduct = new Product({ title, description, price: priceNum, quantity: quantityNum, status });
    await newProduct.save();

    res.status(201).json({
      message: "New product posted to the customer from the store.",
      product: newProduct,
    });
  } catch (err) {
    console.error("Error posting product:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: "Server error while posting product.", error: err.message });
  }
});





// ✅ GET: View merged active products by title
router.get("/products", async (req, res) => {
  try {
    const mergedProducts = await Product.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$title", // Group by title
          description: { $first: "$description" },
          price: { $first: "$price" },
          status: { $first: "$status" },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      {
        $project: {
          _id: 0,
          title: "$_id",
          description: 1,
          price: 1,
          status: 1,
          quantity: "$totalQuantity",
        },
      },
    ]);

    res.status(200).json(mergedProducts);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// ✅ GET: View all paid orders to release
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
// ✅ PUT: Release products for dispatch (decrease quantity)
router.put("/release/:orderId", async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate("items.product");
    
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status === 'released') {
      return res.status(400).json({ message: "Order already released" });
    }

    // Validate stock levels
    for (const item of order.items) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        return res.status(400).json({ message: `Product ${item.title} not found` });
      }
      if (product.quantity < item.quantity || item.quantity <= 0) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${item.title} (Available: ${product.quantity}, Requested: ${item.quantity})`
        });
      }
    }

    // Process the release
    for (const item of order.items) {
      const product = await Product.findById(item.product._id);
      product.quantity -= item.quantity;
      await product.save();

      await InventoryLog.create({
        product: product._id,
        quantity: -item.quantity,
        type: "release", // Using the correct enum value
        relatedOrder: order._id
      });
    }

    order.status = "released";
    order.updatedAt = new Date();
    await order.save();

    res.json({ message: "Order released for dispatch" });
  } catch (err) {
    console.error('Release error:', err);
    res.status(500).json({ 
      message: "Server error",
      error: err.message
    });
  }
});

module.exports = router;
