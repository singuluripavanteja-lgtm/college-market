const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { CATEGORIES } = require("../models/Product");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const protect = require("../middleware/authMiddleware");

// Helper: validate MongoDB ObjectId
function validId(id) { return mongoose.Types.ObjectId.isValid(id); }

// ==============================
// IMAGE STORAGE — Cloudinary in production, local disk in dev
// ==============================
let upload;

if (process.env.CLOUDINARY_CLOUD_NAME) {
    const cloudinary = require("cloudinary").v2;
    const { CloudinaryStorage } = require("multer-storage-cloudinary");

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const cloudStorage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder: "collegemart",
            allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
            transformation: [{ width: 1000, height: 1000, crop: "limit" }]
        }
    });

    upload = multer({ storage: cloudStorage, limits: { fileSize: 5 * 1024 * 1024 } });
    console.log("☁️  Using Cloudinary for image storage");

} else {
    // Local disk (development)
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, "uploads/"),
        filename:    (req, file, cb) => cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + path.extname(file.originalname))
    });
    upload = multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            // Check mimetype (more reliable than extension)
            const validMime = /^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype);
            // Also accept by extension as fallback
            const validExt  = /\.(jpeg|jpg|png|gif|webp)$/i.test(file.originalname);
            if (validMime || validExt) {
                cb(null, true);
            } else {
                cb(new Error("Only image files are allowed"));
            }
        }
    });
    console.log("💾  Using local disk for image storage (dev mode)");
}

// ==============================
// GET CATEGORIES LIST
// ==============================
router.get("/categories", (req, res) => {
    res.json(CATEGORIES);
});

// ==============================
// ADD PRODUCT (protected, up to 4 images)
// ==============================
// Multer error handler wrapper
function uploadMiddleware(req, res, next) {
    upload.array("images", 4)(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message || "File upload failed" });
        }
        next();
    });
}

router.post("/add", protect, uploadMiddleware, async (req, res) => {
    try {
        const {
            name, description, price, type, category, pickupLocation,
            rentPricePerDay, minRentDays, maxRentDays,
            depositAmount, availableFrom, availableTo, rentConditions
        } = req.body;

        if (!name || name.length > 100)
            return res.status(400).json({ message: "Item title is required and must be under 100 characters" });
        if (!description || description.length > 1000)
            return res.status(400).json({ message: "Description is required and must be under 1000 characters" });
        if (!price || isNaN(price) || Number(price) < 0)
            return res.status(400).json({ message: "Valid price is required" });
        if (!["sell","rent"].includes(type))
            return res.status(400).json({ message: "Invalid listing type" });

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "At least one image is required" });
        }

        // Save relative path with forward slashes e.g. "uploads/filename.jpg"
        const imagePaths = req.files.map(f =>
            f.path.startsWith("http") ? f.path : f.path.replace(/\\/g, "/")
        );

        const productData = {
            name, description, price, type,
            category: category || "Other",
            pickupLocation: pickupLocation || "",
            image:  imagePaths[0],   // keep legacy field as first image
            images: imagePaths,
            owner: req.user.id
        };

        if (type === "rent") {
            if (!rentPricePerDay) return res.status(400).json({ message: "Price per day is required for rent items" });
            productData.rentPricePerDay = Number(rentPricePerDay);
            productData.minRentDays     = minRentDays   ? Number(minRentDays)   : 1;
            productData.maxRentDays     = maxRentDays   ? Number(maxRentDays)   : null;
            productData.depositAmount   = depositAmount ? Number(depositAmount) : null;
            productData.availableFrom   = availableFrom || null;
            productData.availableTo     = availableTo   || null;
            productData.rentConditions  = rentConditions || "";
        }

        const savedProduct = await new Product(productData).save();

        const updateField = type === "sell" ? "soldItems" : "rentedItems";
        await User.findByIdAndUpdate(req.user.id, { $push: { [updateField]: savedProduct._id } });

        res.status(201).json({ message: "Item added successfully!", product: savedProduct });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ==============================
// GET ALL PRODUCTS
// ==============================
router.get("/", async (req, res) => {
    try {
        const { type } = req.query;
        const filter = { isSold: false, isFlagged: { $ne: true } };
        if (type && type !== "all") filter.type = type;

        const products = await Product.find(filter).populate("owner", "userName phNo").sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ==============================
// GET SINGLE PRODUCT
// ==============================
router.get("/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid product ID" });
        const product = await Product.findById(req.params.id).populate("owner", "userName phNo email");
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ==============================
// DELETE PRODUCT (protected, owner only)
// ==============================
router.delete("/:id", protect, async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid product ID" });
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        if (product.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized to delete this item" });
        }

        await Product.findByIdAndDelete(req.params.id);

        // Remove from user's lists
        await User.findByIdAndUpdate(req.user.id, {
            $pull: { soldItems: product._id, rentedItems: product._id }
        });

        res.json({ message: "Item deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ==============================
// GET PROFILE DATA
// ==============================
router.get("/profile/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select("-password")
            .populate("soldItems")
            .populate("rentedItems")
            .populate("purchases");

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// NOTE: change-password route removed — this app uses Google OAuth only.
// The User model has no password field; bcrypt comparison always failed.

// NOTE: Direct /buy route removed — purchases must go through the
// PurchaseRequest flow (request → chat → dual confirm) in purchaseRoutes.js

// ==============================
// RELIST A SOLD ITEM (protected, owner only)
// ==============================
router.post("/relist/:productId", protect, async (req, res) => {
    try {
        const original = await Product.findById(req.params.productId);
        if (!original) return res.status(404).json({ message: "Product not found" });
        if (original.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Create a fresh copy with isSold=false
        const relistData = original.toObject();
        delete relistData._id;
        delete relistData.__v;
        delete relistData.createdAt;
        delete relistData.updatedAt;
        relistData.isSold    = false;
        relistData.isFlagged = false;

        const newProduct = await Product.create(relistData);

        const updateField = original.type === "sell" ? "soldItems" : "rentedItems";
        await User.findByIdAndUpdate(req.user.id, { $push: { [updateField]: newProduct._id } });

        res.status(201).json({ message: "Item re-listed successfully!", product: newProduct });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

module.exports = router;