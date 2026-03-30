const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        // message = new chat message
        // request = new purchase request
        // approved = request approved
        // rejected = request rejected
        enum: ["message", "request", "approved", "rejected"],
        required: true
    },
    title: { type: String, required: true },
    body:  { type: String, required: true },
    link:  { type: String, default: null },  // frontend URL to navigate to
    read:  { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);