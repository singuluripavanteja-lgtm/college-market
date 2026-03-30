const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");
const PurchaseRequest = require("../models/PurchaseRequest");
const Product  = require("../models/Product");
const User     = require("../models/User");
const protect  = require("../middleware/authMiddleware");
const notify   = require("../utils/notify");

// ── BUYER: Send a purchase request ─────────────────
router.post("/request/:productId", protect, async (req, res) => {
    try {
        const buyerId = req.user.id;
        const { productId } = req.params;
        const { message } = req.body;

        if (!mongoose.Types.ObjectId.isValid(productId))
            return res.status(400).json({ message: "Invalid product ID" });

        const product = await Product.findById(productId);
        if (!product)         return res.status(404).json({ message: "Product not found" });
        if (product.isSold)   return res.status(400).json({ message: "Item is no longer available" });
        if (product.owner.toString() === buyerId)
            return res.status(400).json({ message: "You cannot request to buy your own item" });

        const existing = await PurchaseRequest.findOne({ product: productId, buyer: buyerId });
        if (existing) {
            if (existing.status === "pending" || existing.status === "chatting")
                return res.status(400).json({ message: "You already have an active request for this item" });
            if (existing.status === "completed")
                return res.status(400).json({ message: "This deal is already completed" });
            // Rejected — allow re-request
            existing.status  = "pending";
            existing.message = message || "";
            existing.sellerConfirmed = false;
            existing.buyerConfirmed  = false;
            await existing.save();
            return res.json({ message: "Purchase request sent to seller!" });
        }

        await PurchaseRequest.create({
            product: productId,
            buyer:   buyerId,
            seller:  product.owner,
            message: message || ""
        });

        // Notify seller
        const buyer = await User.findById(buyerId).select("userName");
        await notify({
            recipient: product.owner,
            type:  "request",
            title: "New Purchase Request",
            body:  `${buyer.userName} wants to ${product.type === "rent" ? "rent" : "buy"} your "${product.name}". Message them if you're interested!`,
            link:  "../profile/profile.html"
        });

        res.status(201).json({ message: "Purchase request sent to seller!" });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── SELLER: Approve a request → unlocks chat ───────
router.put("/approve/:requestId", protect, async (req, res) => {
    try {
        const request = await PurchaseRequest.findById(req.params.requestId)
            .populate("product", "name type");
        if (!request) return res.status(404).json({ message: "Request not found" });

        if (request.seller.toString() !== req.user.id)
            return res.status(403).json({ message: "Not authorized" });

        if (request.status !== "pending")
            return res.status(400).json({ message: "Request is no longer pending" });

        request.status = "approved";
        await request.save();

        // Notify buyer that they can now chat
        await notify({
            recipient: request.buyer,
            type:  "approved",
            title: "✅ Request Approved!",
            body:  `Your request for "${request.product.name}" was approved. You can now chat with the seller.`,
            link:  `../chat/chat.html?user=${request.seller}&product=${request.product._id}`
        });

        res.json({
            message: "Request approved. Chat is now enabled.",
            sellerId: request.seller,
            productId: request.product._id
        });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── SELLER: Reject a request ───────────────────────
router.put("/reject/:requestId", protect, async (req, res) => {
    try {
        const request = await PurchaseRequest.findById(req.params.requestId);
        if (!request) return res.status(404).json({ message: "Request not found" });

        if (request.seller.toString() !== req.user.id)
            return res.status(403).json({ message: "Not authorized" });

        if (request.status === "completed" || request.status === "rejected")
            return res.status(400).json({ message: "Request already closed" });

        request.status = "rejected";
        await request.save();

        const product = await Product.findById(request.product).select("name");
        await notify({
            recipient: request.buyer,
            type:  "rejected",
            title: "Request Declined",
            body:  `Your request for "${product.name}" was declined by the seller.`,
            link:  "../profile/profile.html"
        });

        res.json({ message: "Request rejected." });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── CONFIRM DEAL (both buyer and seller must confirm) ──
router.put("/confirm/:requestId", protect, async (req, res) => {
    try {
        const request = await PurchaseRequest.findById(req.params.requestId);
        if (!request) return res.status(404).json({ message: "Request not found" });

        const userId   = req.user.id;
        const isSeller = request.seller.toString() === userId;
        const isBuyer  = request.buyer.toString()  === userId;

        if (!isSeller && !isBuyer)
            return res.status(403).json({ message: "Not authorized" });

        if (request.status === "completed")
            return res.status(400).json({ message: "Deal already completed" });

        if (request.status === "rejected")
            return res.status(400).json({ message: "This request was rejected" });

        if (request.status === "pending")
            return res.status(400).json({ message: "Seller must initiate chat before confirming." });

        // Mark confirmation
        if (isSeller) request.sellerConfirmed = true;
        if (isBuyer)  request.buyerConfirmed  = true;

        // If both confirmed → complete the deal
        if (request.sellerConfirmed && request.buyerConfirmed) {
            request.status = "completed";
            await request.save();

            // Mark product as sold
            await Product.findByIdAndUpdate(request.product, { isSold: true });

            // Add to buyer's purchases
            await User.findByIdAndUpdate(request.buyer, {
                $push: { purchases: request.product }
            });

            // Reject all other pending requests for this product
            await PurchaseRequest.updateMany(
                { product: request.product, _id: { $ne: request._id }, status: { $in: ["pending", "chatting"] } },
                { status: "rejected" }
            );

            const product = await Product.findById(request.product).select("name");

            // Notify both parties
            await notify({
                recipient: request.buyer,
                type:  "approved",
                title: "🎉 Deal Completed!",
                body:  `Your deal for "${product.name}" is confirmed. Enjoy!`,
                link:  "../profile/profile.html"
            });
            await notify({
                recipient: request.seller,
                type:  "approved",
                title: "🎉 Deal Completed!",
                body:  `Your item "${product.name}" has been sold!`,
                link:  "../profile/profile.html"
            });

            return res.json({ message: "Deal completed! Item marked as sold.", status: "completed" });
        }

        // Only one confirmed so far
        request.status = isSeller ? "seller_confirmed" : "buyer_confirmed";
        await request.save();

        const product  = await Product.findById(request.product).select("name");
        const notifyTo = isSeller ? request.buyer : request.seller;
        const whoName  = isSeller ? "The seller" : "The buyer";

        await notify({
            recipient: notifyTo,
            type:  "approved",
            title: `${whoName} confirmed the deal!`,
            body:  `Please confirm your side to complete the purchase of "${product.name}".`,
            link:  `../chat/chat.html?user=${userId}&product=${request.product}`
        });

        res.json({
            message: `Your confirmation saved. Waiting for the ${isSeller ? "buyer" : "seller"} to confirm.`,
            status: request.status
        });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── Get purchase request status for a product/user pair ──
router.get("/status/:productId", protect, async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.id;

        const request = await PurchaseRequest.findOne({
            product: productId,
            $or: [{ buyer: userId }, { seller: userId }]
        });

        if (!request) return res.json({ exists: false });

        res.json({
            exists: true,
            status:          request.status,
            sellerConfirmed: request.sellerConfirmed,
            buyerConfirmed:  request.buyerConfirmed,
            requestId:       request._id,
            isSeller:        request.seller.toString() === userId,
            isBuyer:         request.buyer.toString()  === userId,
            sellerId:        request.seller,
            buyerId:         request.buyer
        });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── SELLER: Get all incoming requests ──────────────
router.get("/incoming", protect, async (req, res) => {
    try {
        const requests = await PurchaseRequest.find({ seller: req.user.id })
            .populate("product", "name image price type")
            .populate("buyer",   "userName email phNo")
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── BUYER: Get all outgoing requests ───────────────
router.get("/outgoing", protect, async (req, res) => {
    try {
        const requests = await PurchaseRequest.find({ buyer: req.user.id })
            .populate("product", "name image price type")
            .populate("seller",  "userName")
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ── Pending incoming count (badge) ─────────────────
router.get("/incoming/count", protect, async (req, res) => {
    try {
        const count = await PurchaseRequest.countDocuments({
            seller: req.user.id,
            status: { $in: ["pending", "approved", "chatting", "buyer_confirmed"] }
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

module.exports = router;