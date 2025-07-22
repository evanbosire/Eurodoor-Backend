// --- ROUTES ---

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const express = require("express");
const router = express.Router();
const RawMaterialRequest = require("../models/RawMaterialRequest");
const RawMaterialStock = require("../models/RawMaterialStock");
const ProductStore = require("../models/ProductStore");
const ProductionRequest = require("../models/ProductionRequest");
const MaterialReleaseRequest = require("../models/MaterialReleaseRequest");
const AssignedTask = require("../models/AssignedTask");


// INVENTORY

// Step 1: Inventory  raw material request
router.post("/raw-material/request", async (req, res) => {
  try {
    const { materialName, quantity, unit, note, supplier } = req.body;

    if (!materialName || !quantity || !supplier || !unit) {
      return res.status(400).json({
        message: "Please provide material name, quantity, unit, and supplier."
      });
    }

    const request = new RawMaterialRequest({
      materialName,
      quantity,
      unit,
      note,
      supplier
    });

    await request.save();
    res.status(201).json({ message: "Raw material request submitted", request });
  } catch (error) {
    console.error("Error creating raw material request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Step 4: Inventory accepts or rejects supplied materials
router.put("/inventory/accept/:id", async (req, res) => {
  try {
    const request = await RawMaterialRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Raw material request not found." });
    }

    if (request.status !== "supplied") {
      return res.status(400).json({ message: "Only supplied materials can be accepted or rejected." });
    }

    const { status } = req.body;

    if (status === "accepted") {
      const material = await RawMaterialStock.findOne({ materialName: request.materialName });

      if (material) {
        material.quantity += request.quantity;
        await material.save();
      } else {
        await RawMaterialStock.create({
          materialName: request.materialName,
          quantity: request.quantity,
          unit: request.unit,
        });
      }

      request.status = "accepted";
      request.paymentStatus = "unpaid";

    } else if (status === "rejected") {
      request.status = "rejected-by-inventory";
    } else {
      return res.status(400).json({ message: "Invalid status. Use 'accepted' or 'rejected'." });
    }

    await request.save();

    res.json({
      message: `Raw material ${status}`,
      request,
    });

  } catch (error) {
    console.error("Inventory decision error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET all raw material requests with status "supplied" — for inventory manager to review
router.get("/inventory/supplied", async (req, res) => {
  try {
    const suppliedRequests = await RawMaterialRequest.find({ status: "supplied" });

    res.json({
      message: "Supplied raw material requests retrieved",
      requests: suppliedRequests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch supplied requests",
      error: error.message,
    });
  }
});
// GET /api/store/materials - Fetch all raw materials currently in stock
router.get("/store/materials", async (req, res) => {
  try {
    const stock = await RawMaterialStock.find();

    res.json({
      message: "Raw materials currently in store retrieved",
      stock,
    });
  } catch (error) {
    console.error("Failed to retrieve store materials:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



//  SUPPLIER

// GET all raw material requests with status "pending" — for suppliers to view
router.get("/supplier/pending", async (req, res) => {
  try {
    const pendingRequests = await RawMaterialRequest.find({ status: "pending" });
    
    res.json({
      message: "Pending raw material requests retrieved",
      requests: pendingRequests,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending requests", error: error.message });
  }
});

// Step 2: Supplier approves or rejects request
router.put("/supplier/respond/:id", async (req, res) => {
  try {
    const { status, unitCost } = req.body;

    // Validate status
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'." });
    }

    // Find the request first
    const request = await RawMaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Raw material request not found." });
    }

    // If status is approved, calculate total cost
    let totalCost = undefined;
    if (status === "approved") {
      if (unitCost === undefined || unitCost < 0) {
        return res.status(400).json({ message: "Please provide a valid unit cost for approval." });
      }

      totalCost = unitCost * request.quantity;
    }

    // Update the request
    request.status = status;
    if (status === "approved") {
      request.unitCost = unitCost;
      request.totalCost = totalCost;
    }

    await request.save();

    res.json({
      message: `Request ${status}`,
      request
    });

  } catch (error) {
    console.error("Supplier response error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET all raw material requests with status "approved" — for suppliers to view what they have approved to supply
router.get("/supplier/approved", async (req, res) => {
  try {
    const approvedRequests = await RawMaterialRequest.find({ status: "approved" });

    res.json({
      message: "Approved raw material requests retrieved",
      requests: approvedRequests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch approved requests",
      error: error.message,
    });
  }
});

// Step 3: Supplier supplies the raw materials
router.put("/supplier/supply/:id", async (req, res) => {
  try {
    // Find the existing request
    const request = await RawMaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Raw material request not found." });
    }

    // Ensure only approved requests can be supplied
    if (request.status !== "approved") {
      return res.status(400).json({ message: "Only approved requests can be marked as supplied." });
    }

    // Update status to supplied
    request.status = "supplied";
    await request.save();

    res.json({
      message: "Raw material marked as supplied.",
      request
    });
  } catch (error) {
    console.error("Supplier supply error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// GET all raw material requests with status "accepted" — for supplier to track pending payments
router.get("/supplier/accepted", async (req, res) => {
  try {
    const acceptedRequests = await RawMaterialRequest.find({ status: "accepted" });

    res.json({
      message: "Accepted raw material requests retrieved",
      requests: acceptedRequests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch accepted requests",
      error: error.message,
    });
  }
});

// GET: Generate and download receipt for the supplier
router.get("/raw-materials/:id/receipt", async (req, res) => {
  try {
    const request = await RawMaterialRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.paymentStatus !== "paid") {
      return res.status(400).json({ message: "Payment not completed yet" });
    }

    const receiptsDir = path.join(__dirname, "../public/receipts");
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const receiptPath = path.join(receiptsDir, `${request._id}.pdf`);
    const writeStream = fs.createWriteStream(receiptPath);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(writeStream);

    // Header
    doc.fontSize(22).fillColor("#003366").text("EuroDoor", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor("#000000").text("Supply Payment Receipt", { align: "center" });
    doc.moveDown();

    // Supplier Info
    doc.fontSize(12).fillColor("black");
    doc.text(`Receipt ID: ${request._id}`);
    doc.text(`Supplier: ${request.supplier}`);
    doc.text(`Material: ${request.materialName}`);
    doc.text(`Quantity: ${request.quantity} ${request.unit}`);
    doc.text(`Unit Cost: KES ${request.unitCost}`);
    doc.text(`Total Cost: KES ${request.totalCost}`);
    doc.moveDown();

    // Payment Details
    doc.fontSize(12);
    doc.text(`Payment Code: ${request.paymentCode}`);
    doc.text(`Amount Paid: KES ${request.amountPaid}`);
    doc.text(`Payment Status: ${request.paymentStatus}`);
    doc.text(`Paid On: ${new Date(request.
paymentDate).toDateString()}`);
    doc.moveDown();

    doc.moveDown(2);
    doc.fontSize(10).fillColor("gray");
    doc.text("Thank you for supplying EuroDoor!", { align: "center" });
    doc.text("For payment inquiries, contact finance@eurodoor.com", { align: "center" });

    doc.end();

    writeStream.on("finish", () => {
      const receiptUrl = `/receipts/${request._id}.pdf`;
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
 

// FINANCE

// GET /api/finance/unpaid
router.get("/finance/unpaid", async (req, res) => {
  try {
    const requests = await RawMaterialRequest.find({
      status: "accepted",
      paymentStatus: "unpaid"
    });

    res.json(requests);
  } catch (error) {
    console.error("Finance fetch error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


function isValidPaymentCode(code) {
  const hasValidLength = code.length === 10;
  const digitCount = (code.match(/\d/g) || []).length;
  const letterCount = (code.match(/[A-Z]/g) || []).length;
  const onlyValidChars = /^[A-Z0-9]+$/.test(code);

  return hasValidLength && digitCount === 2 && letterCount === 8 && onlyValidChars;
}

// ✅ PUT /finance/pay/:id — manually enter valid paymentCode, auto pick totalCost as amountPaid
router.put("/finance/pay/:id", async (req, res) => {
  try {
    const { paymentCode } = req.body;

    if (!paymentCode) {
      return res.status(400).json({ message: "paymentCode is required" });
    }

    if (!isValidPaymentCode(paymentCode)) {
      return res.status(400).json({
        message: "Invalid paymentCode format. Must be 10 characters: 2 digits and 8 uppercase letters (e.g., A2B3CDEFGH)"
      });
    }

    const request = await RawMaterialRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Raw material request not found" });
    }

    request.paymentStatus = "paid";
    request.paymentCode = paymentCode;
    request.amountPaid = request.totalCost;
     request.paymentDate = new Date();

    await request.save();

    res.status(200).json({
      message: "Payment recorded successfully",
      paymentCode: request.paymentCode,
      amountPaid: request.amountPaid
    });
  } catch (error) {
    console.error("Finance payment error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

///////////// ************* PRODUCTION PROCESS ******** /////////////////


//  INVENTORY


// Step 7: Inventory Manager requests production
router.post("/door-production/request", async (req, res) => {
  try {
    const { doorName, quantity, description } = req.body;

    if (!doorName || !quantity || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const request = new ProductionRequest({
      doorName,
      quantity,
      description,
    });

    await request.save();
    res.status(201).json(request);
  } catch (error) {
    console.error("Error creating production request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Inventory Manager views all pending raw material requests
router.get("/pending-material-requests", async (req, res) => {
  try {
    const pendingRequests = await MaterialReleaseRequest.find({ status: "pending" }).sort({ requestedAt: -1 });

    res.status(200).json(pendingRequests);
  } catch (error) {
    console.error("Error fetching pending material requests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// // Step 9: Inventory releases raw materials
// Release material based on a request
// router.put("/inventory/release/:id", async (req, res) => {
//   try {
//     const request = await MaterialReleaseRequest.findById(req.params.id);
//     if (!request) {
//       return res.status(404).json({ message: "Material release request not found." });
//     }

//     // Ensure request hasn't already been released
//     if (request.status === "released") {
//       return res.status(400).json({ message: "This request has already been released." });
//     }

//     // Mark as released without deducting from stock
//     request.status = "released";
//     request.processedAt = new Date();
//     await request.save();

//     res.status(200).json({
//       message: "Materials marked as released. Awaiting production approval.",
//       request
//     });

//   } catch (error) {
//     console.error("Error releasing materials:", error);
//     res.status(500).json({ message: "Server error while releasing materials." });
//   }
// });

// PUT /inventory/release/:id
router.put("/inventory/release/:id", async (req, res) => {
  try {
    const request = await MaterialReleaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Material release request not found." });
    }

    // Ensure request hasn't already been released
    if (request.status === "released") {
      return res.status(400).json({ message: "This request has already been released." });
    }

    // Ensure requested quantity is valid
    if (request.quantity < 1) {
      return res.status(400).json({ message: "Cannot release quantity less than 1." });
    }

    // Look up material in stock (case-insensitive)
    const stock = await RawMaterialStock.findOne({
      materialName: { $regex: new RegExp(`^${request.materialName}$`, 'i') }
    });

    // If not found, prompt to request from supplier
    if (!stock) {
      return res.status(400).json({
        message: `Material '${request.materialName}' not found in stock. Please request from supplier.`
      });
    }

    // Ensure stock is enough
    if (stock.quantity < request.quantity) {
      return res.status(400).json({
        message: `Insufficient stock for '${request.materialName}'. Requested: ${request.quantity}, Available: ${stock.quantity}. Please request from supplier.`
      });
    }

    // Mark request as released
    request.status = "released";
    request.processedAt = new Date();
    await request.save();

    res.status(200).json({
      message: "Materials marked as released. Awaiting production approval.",
      request
    });

  } catch (error) {
    console.error("Error releasing materials:", error);
    res.status(500).json({ message: "Server error while releasing materials." });
  }
});




//  PRODUCTION


//  Production Manager gets all pending production requests
router.get("/production/pending-requests", async (req, res) => {
  try {
    const pendingRequests = await ProductionRequest.find({ status: "pending" }).sort({ createdAt: -1 });

    res.status(200).json(pendingRequests);
  } catch (error) {
    console.error("Error fetching pending production requests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// Production Manager requests raw materials
router.post("/production/release-request", async (req, res) => {
  try {
    const { materialName, quantity } = req.body;

    if (!materialName || !quantity) {
      return res.status(400).json({ message: "Material name and quantity are required." });
    }

    const request = new MaterialReleaseRequest({
      materialName,
      quantity
    });

    await request.save();
    res.status(201).json(request);
  } catch (error) {
    console.error("Error creating material release request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//  production gets released raw materials to blacksmiths for approval
// GET /api/production/released-materials
router.get("/inventory-released-materials", async (req, res) => {
  try {
    const releasedRequests = await MaterialReleaseRequest.find({ status: "released" });
    res.status(200).json(releasedRequests);
  } catch (error) {
    console.error("Error fetching released materials:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /production/approve-release/:id
router.put("/approve-release/:id", async (req, res) => {
  const { decision } = req.body; // either "approved" or "rejected"

  try {
    // 1. Find the release request
    const request = await MaterialReleaseRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Release request not found." });
    }

    // 2. Ensure the request was released first
    if (request.status !== "released") {
      return res.status(400).json({ message: "Only released requests can be approved or rejected." });
    }

    // 3. If rejected, update the status and return
    if (decision === "rejected") {
      request.status = "rejected";
      await request.save();
      return res.status(200).json({ message: "Request rejected successfully.", request });
    }

    // 4. If approved, check and deduct stock
    const stockItem = await RawMaterialStock.findOne({ materialName: request.materialName });
    if (!stockItem) {
      return res.status(404).json({ message: "Material not found in stock." });
    }

    // Optional safety check
    if (stockItem.quantity < request.quantity) {
      return res.status(400).json({
        message: `Insufficient stock to approve. Available: ${stockItem.quantity}, Requested: ${request.quantity}.`
      });
    }

    // Deduct stock and update status
    stockItem.quantity -= request.quantity;
    await stockItem.save();

    request.status = "approved";
    await request.save();

    res.status(200).json({ message: "Request approved and stock updated.", request });

  } catch (error) {
    console.error("Error approving/rejecting release:", error);
    res.status(500).json({ message: "Server error while processing approval." });
  }
});


//  Production Assigns blacksmith
router.post("/assign-blacksmith-task/:requestId", async (req, res) => {
  const { requestId } = req.params;

  try {
    // Fetch the production request
    const productionRequest = await ProductionRequest.findById(requestId);

    if (!productionRequest) {
      return res.status(404).json({ message: "Production request not found." });
    }

    // Create and save the assigned task for blacksmith
    const newTask = new AssignedTask({
      doorName: productionRequest.doorName,
      quantity: productionRequest.quantity,
      description: productionRequest.description,
      status: "in-production" // Task itself starts as "in-production"
    });

    await newTask.save();

    // Update the original request status to "door-assigned"
    productionRequest.status = "door-assigned";
    await productionRequest.save();

    res.status(201).json({
      message: "Task assigned to blacksmith successfully.",
      task: newTask
    });

  } catch (error) {
    console.error("Error assigning task:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Step 12: Production approves completed task
router.put("/task/approve/:id", async (req, res) => {
  try {
    // Find the assigned task
    const task = await AssignedTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Assigned task not found" });
    }

    // Mark task as approved
    task.status = "approved";
    await task.save();

    // Update related production request (optional: check if it exists)
    const production = await ProductionRequest.findOne({ 
      doorName: task.doorName, 
      description: task.description 
    });

    if (production) {
      production.status = "approved";
      await production.save();
    }

    // Check if the product already exists in the store
    let product = await ProductStore.findOne({ 
      doorName: task.doorName, 
      description: task.description 
    });

    if (product) {
      // Increase quantity
      product.quantity += task.quantity;
      await product.save();
    } else {
      // Create new product record
      product = new ProductStore({
        doorName: task.doorName,
        description: task.description,
        quantity: task.quantity,
      });
      await product.save();
    }

    res.status(200).json({
      message: "Task approved and product store updated",
      task,
      product
    });
  } catch (error) {
    console.error("Error approving task:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//  BLACKSMITHS

//  blacksmiths gets all approved raw materials released by the production manager
router.get("/blacksmith/approved-releases", async (req, res) => {
  try {
    const approvedMaterials = await MaterialReleaseRequest.find({ status: "approved" });

    if (approvedMaterials.length === 0) {
      return res.status(404).json({ message: "No approved raw material requests found." });
    }

    res.status(200).json(approvedMaterials);
  } catch (error) {
    console.error("Error fetching approved releases:", error);
    res.status(500).json({ message: "Server error while retrieving approved materials." });
  }
});



// Step 11: Blacksmith marks task completed
// Mark task as completed
router.put("/blacksmith/complete-task/:taskId", async (req, res) => {
  const { taskId } = req.params;

  try {
    // Find the task by ID
    const task = await AssignedTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Assigned task not found" });
    }

    // Update status to completed
    task.status = "completed";
    await task.save();

    res.status(200).json({ message: "Task marked as completed successfully", task });
  } catch (error) {
    console.error("Error marking task as completed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



//    -----> IMPLEMENT THIS ALONE AS 'STORE'

// Inventory Get all products in the product store 
router.get("/products-store", async (req, res) => {
  try {
    const products = await ProductStore.find();

    res.status(200).json({
      message: "Products currently in the store",
      data: products
    });
  } catch (error) {
    console.error("Error fetching products from store:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
