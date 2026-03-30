const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");
const Message  = require("../models/Message");
const PurchaseRequest = require("../models/PurchaseRequest");
const protect  = require("../middleware/authMiddleware");
const notify   = require("../utils/notify");

// ── SEND A MESSAGE ─────────────────────────────────
// Chat is enabled only after seller approves the request (status = approved/chatting/seller_confirmed/buyer_confirmed)
router.post("/send", protect, async (req, res) => {
    try {
        const { receiverId, productId, text } = req.body;
        const senderId = req.user.id;

        if (!receiverId || !productId || !text?.trim())
            return res.status(400).json({ message: "All fields are required" });

        if (!mongoose.Types.ObjectId.isValid(receiverId) || !mongoose.Types.ObjectId.isValid(productId))
            return res.status(400).json({ message: "Invalid receiver or product ID" });

        if (senderId === receiverId)
            return res.status(400).json({ message: "You cannot message yourself" });

        if (text.trim().length > 1000)
            return res.status(400).json({ message: "Message cannot exceed 1000 characters" });

        // Check a purchase request exists between these two users for this product
        const request = await PurchaseRequest.findOne({
            product: productId,
            $or: [
                { seller: senderId, buyer: receiverId },
                { seller: receiverId, buyer: senderId }
            ]
        });

        if (!request)
            return res.status(403).json({ message: "No purchase request exists for this item." });

        if (request.status === "pending")
            return res.status(403).json({ message: "The seller hasn't approved this request yet." });

        if (request.status === "rejected")
            return res.status(403).json({ message: "This request was rejected." });

        if (request.status === "completed")
            return res.status(403).json({ message: "This deal is already completed." });

        // Move approved → chatting on first message
        if (request.status === "approved") {
            request.status = "chatting";
            await request.save();
        }

        const message = await Message.create({
            sender: senderId, receiver: receiverId, product: productId, text: text.trim()
        });

        const populated = await message.populate([
            { path: "sender",   select: "userName" },
            { path: "receiver", select: "userName" },
            { path: "product",  select: "name image" }
        ]);

        await notify({
            recipient: receiverId,
            type: "message",
            title: `New message from ${populated.sender.userName}`,
            body: `Re: ${populated.product.name} — "${text.trim().slice(0, 60)}${text.length > 60 ? "…" : ""}"`,
            link: `../chat/chat.html?user=${senderId}&product=${productId}`
        });

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── GET ALL CONVERSATIONS ──────────────────────────
router.get("/conversations", protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const messages = await Message.find({ $or: [{ sender: userId }, { receiver: userId }] })
            .populate("sender",   "userName")
            .populate("receiver", "userName")
            .populate("product",  "name image")
            .sort({ createdAt: -1 });

        const convMap = new Map();
        messages.forEach(msg => {
            const otherUser = msg.sender._id.toString() === userId ? msg.receiver : msg.sender;
            const key = `${otherUser._id}_${msg.product._id}`;
            if (!convMap.has(key)) {
                convMap.set(key, {
                    otherUser,
                    product: msg.product,
                    lastMessage: msg.text,
                    lastTime: msg.createdAt,
                    unread: !msg.read && msg.receiver._id.toString() === userId ? 1 : 0
                });
            } else if (!msg.read && msg.receiver._id.toString() === userId) {
                convMap.get(key).unread++;
            }
        });

        res.json(Array.from(convMap.values()));
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── UNREAD COUNT ───────────────────────────────────
// IMPORTANT: must be before /:otherUserId/:productId to avoid route shadowing
router.get("/unread/count", protect, async (req, res) => {
    try {
        const count = await Message.countDocuments({ receiver: req.user.id, read: false });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── GET MESSAGES between two users about a product ─
router.get("/:otherUserId/:productId", protect, async (req, res) => {
    try {
        const { otherUserId, productId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(otherUserId) || !mongoose.Types.ObjectId.isValid(productId))
            return res.status(400).json({ message: "Invalid ID" });

        const messages = await Message.find({
            product: productId,
            $or: [
                { sender: userId,      receiver: otherUserId },
                { sender: otherUserId, receiver: userId }
            ]
        }).populate("sender", "userName").sort({ createdAt: 1 });

        await Message.updateMany(
            { sender: otherUserId, receiver: userId, product: productId, read: false },
            { $set: { read: true } }
        );

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

module.exports = router;