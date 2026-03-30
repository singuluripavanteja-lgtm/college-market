const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userName:   { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true },
    googleId:   { type: String, default: null },
    year:       { type: Number, default: null },
    branch:     { type: String, default: null },
    phNo:       { type: String, default: null },
    isAdmin:    { type: Boolean, default: false },
    isBanned:   { type: Boolean, default: false },
    isProfileComplete: { type: Boolean, default: false },
    soldItems:   [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    rentedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    purchases:   [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);