const mongoose = require("mongoose");

const purchaseRequestSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    buyer:   { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    seller:  { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    status: {
        type: String,
        enum: ["pending", "approved", "chatting", "seller_confirmed", "buyer_confirmed", "completed", "rejected"],
        default: "pending"
    },
    message:          { type: String, trim: true, default: "" },
    sellerConfirmed:  { type: Boolean, default: false },
    buyerConfirmed:   { type: Boolean, default: false }
}, { timestamps: true });

purchaseRequestSchema.index({ product: 1, buyer: 1 }, { unique: true });

module.exports = mongoose.model("PurchaseRequest", purchaseRequestSchema);