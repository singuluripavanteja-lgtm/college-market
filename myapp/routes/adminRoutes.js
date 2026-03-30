const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Product = require("../models/Product");
const Announcement = require("../models/Announcement");
const Notification = require("../models/Notification");
const adminOnly = require("../middleware/adminMiddleware");

// ── STATS ─────────────────────────────────────────
router.get("/stats", adminOnly, async (req, res) => {
    try {
        const [totalUsers, totalProducts, soldProducts, flaggedProducts, activeAnnouncements] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
            Product.countDocuments({ isSold: true }),
            Product.countDocuments({ isFlagged: true }),
            Announcement.countDocuments({ active: true })
        ]);
        res.json({ totalUsers, totalProducts, soldProducts, flaggedProducts, activeAnnouncements });
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// ── ALL USERS ─────────────────────────────────────
router.get("/users", adminOnly, async (req, res) => {
    try {
        const users = await User.find().select("-password").sort({ createdAt: -1 });
        res.json(users);
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// ── BAN / UNBAN USER ──────────────────────────────
router.put("/users/:id/ban", adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.isAdmin) return res.status(400).json({ message: "Cannot ban another admin" });
        user.isBanned = !user.isBanned;
        await user.save();
        res.json({ message: user.isBanned ? "User banned" : "User unbanned", isBanned: user.isBanned });
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// ── MAKE / REMOVE ADMIN ───────────────────────────
router.put("/users/:id/admin", adminOnly, async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ message: "You cannot change your own admin status" });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        user.isAdmin = !user.isAdmin;
        await user.save();
        res.json({ message: user.isAdmin ? "Admin granted" : "Admin removed", isAdmin: user.isAdmin });
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// ── ALL PRODUCTS ──────────────────────────────────
router.get("/products", adminOnly, async (req, res) => {
    try {
        const products = await Product.find()
            .populate("owner", "userName email")
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// ── FLAG / UNFLAG PRODUCT ─────────────────────────
router.put("/products/:id/flag", adminOnly, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });
        product.isFlagged = !product.isFlagged;
        await product.save();
        res.json({ message: product.isFlagged ? "Product flagged" : "Product unflagged", isFlagged: product.isFlagged });
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// ── DELETE PRODUCT (admin) ────────────────────────
router.delete("/products/:id", adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        // Cascade: remove related records to avoid orphaned data
        const PurchaseRequest = require("../models/PurchaseRequest");
        const Message         = require("../models/Message");
        const Notification    = require("../models/Notification");

        await Promise.all([
            PurchaseRequest.deleteMany({ product: id }),
            Message.deleteMany({ product: id }),
            Notification.deleteMany({ link: { $regex: id } }),
            // Remove from owner's soldItems / rentedItems lists
            require("../models/User").findByIdAndUpdate(product.owner, {
                $pull: { soldItems: product._id, rentedItems: product._id }
            })
        ]);

        await Product.findByIdAndDelete(id);
        res.json({ message: "Product and all related data deleted" });
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// ── PUBLIC: active announcements (for banner on home) ─
// IMPORTANT: must be before /:id routes
router.get("/announcements/active", async (req, res) => {
    try {
        const list = await Announcement.find({ active: true }).sort({ createdAt: -1 }).limit(5);
        res.json(list);
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// ── ANNOUNCEMENTS ─────────────────────────────────
// Get all (admin)
router.get("/announcements", adminOnly, async (req, res) => {
    try {
        const list = await Announcement.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// Create announcement + notify all users
router.post("/announcements", adminOnly, async (req, res) => {
    try {
        const { title, body, type } = req.body;
        if (!title || !body) return res.status(400).json({ message: "Title and body required" });

        const announcement = await Announcement.create({ title, body, type: type || "info", postedBy: req.user.id });

        // Broadcast notification to ALL users
        const users = await User.find({ isBanned: false }).select("_id");
        const notifs = users.map(u => ({
            recipient: u._id,
            type: "request", // reuse type for styling
            title: `📢 ${title}`,
            body,
            link: "../home/home.html"
        }));
        await Notification.insertMany(notifs);

        res.status(201).json({ message: `Announcement sent to ${users.length} users`, announcement });
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// Toggle active
router.put("/announcements/:id/toggle", adminOnly, async (req, res) => {
    try {
        const ann = await Announcement.findById(req.params.id);
        if (!ann) return res.status(404).json({ message: "Not found" });
        ann.active = !ann.active;
        await ann.save();
        res.json({ message: ann.active ? "Activated" : "Deactivated", active: ann.active });
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

// Delete announcement
router.delete("/announcements/:id", adminOnly, async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ message: "Something went wrong. Please try again." }); }
});

module.exports = router;