const mongoose = require("mongoose");

const CATEGORIES = [
    "Books & Notes",
    "Electronics",
    "Furniture",
    "Cycles & Vehicles",
    "Lab Equipment",
    "Sports & Fitness",
    "Clothing",
    "Stationery",
    "Kitchen & Appliances",
    "Other"
];

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },

    // Single image (legacy) + multiple images
    image:  { type: String, default: "" },
    images: { type: [String], default: [] },  // up to 4 images

    category: {
        type: String,
        enum: CATEGORIES,
        default: "Other"
    },
    pickupLocation: {
        type: String,
        trim: true,
        default: ""   // e.g. "Hostel 3, Room 204"
    },

    type: { type: String, enum: ["sell", "rent"], required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isSold:    { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },

    // ── Rent-only fields ──────────────────────────
    rentPricePerDay: { type: Number, default: null },
    minRentDays:     { type: Number, default: 1 },
    maxRentDays:     { type: Number, default: null },
    depositAmount:   { type: Number, default: null },
    availableFrom:   { type: Date,   default: null },
    availableTo:     { type: Date,   default: null },
    rentConditions:  { type: String, trim: true, default: "" }

}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
module.exports.CATEGORIES = CATEGORIES;