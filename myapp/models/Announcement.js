const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
    title:   { type: String, required: true, trim: true },
    body:    { type: String, required: true, trim: true },
    type:    { type: String, enum: ["info", "warning", "success"], default: "info" },
    active:  { type: Boolean, default: true },
    postedBy:{ type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("Announcement", announcementSchema);