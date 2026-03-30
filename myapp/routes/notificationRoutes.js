const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const protect = require("../middleware/authMiddleware");

// GET all notifications for current user
router.get("/", protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .limit(30);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// GET unread count
router.get("/unread/count", protect, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ recipient: req.user.id, read: false });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// MARK all as read
router.put("/read-all", protect, async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user.id, read: false }, { read: true });
        res.json({ message: "All marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// MARK one as read
router.put("/:id/read", protect, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ message: "Marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

module.exports = router;