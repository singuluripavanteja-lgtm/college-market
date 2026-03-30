require('dotenv').config();
const dns = require("dns");
// Fix DNS lookup issues for MongoDB Atlas SRV on Windows
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ==============================
// CREATE UPLOADS FOLDER IF MISSING
// ==============================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads/ folder');
}

// ==============================
// ROUTES
// ==============================
const authRoutes         = require('./routes/authRoutes');
const productRoutes      = require('./routes/productRoutes');
const messageRoutes      = require('./routes/messageRoutes');
const purchaseRoutes     = require('./routes/purchaseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes        = require('./routes/adminRoutes');

const app = express();

// ==============================
// SECURITY MIDDLEWARE
// ==============================
try {
    const helmet = require('helmet');
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: false,
        crossOriginEmbedderPolicy: false,
    }));
} catch(e) { console.warn("⚠️  helmet not installed — run: npm install helmet"); }

try {
    const rateLimit = require('express-rate-limit');

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: { message: "Too many requests. Please try again in 15 minutes." },
        standardHeaders: true,
        legacyHeaders: false
    });

    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        message: { message: "Too many requests. Please slow down." }
    });

    app.use('/api/auth', authLimiter);
    app.use('/api/', apiLimiter);
} catch(e) { console.warn("⚠️  express-rate-limit not installed — run: npm install express-rate-limit"); }

// ==============================
// CORS & BODY PARSING
// ==============================
app.use(cors({ origin: '*', credentials: false }));

app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
}, express.static(path.join(__dirname, "uploads")));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ==============================
// CHECK JWT_SECRET
// ==============================
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error("❌ FATAL: JWT_SECRET is missing or too short in .env. Use a random 64-char string.");
    process.exit(1);
}

// ==============================
// STATIC FILES
// ==============================
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use(express.static(path.join(__dirname, 'frontend')));

app.get("/placeholder.svg", (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
        <rect width="300" height="300" fill="#f0f0f0"/>
        <rect x="90" y="80" width="120" height="90" rx="8" fill="#ccc"/>
        <circle cx="115" cy="105" r="12" fill="#bbb"/>
        <polygon points="90,170 140,120 175,155 200,130 210,170" fill="#bbb"/>
        <text x="150" y="220" text-anchor="middle" font-family="Arial" font-size="14" fill="#999">No Image</text>
    </svg>`);
});

// ONE-TIME IMAGE PATH FIX
app.get("/admin/fix-image-paths", async (req, res) => {
    try {
        const Product = require('./models/Product');
        const products = await Product.find({});
        let fixed = 0;

        const fixPath = (src) => {
            if (!src || src.startsWith("http")) return src;
            let clean = src.replace(/\\/g, "/");
            if (clean.includes("/uploads/")) {
                return "uploads/" + clean.split("/uploads/").pop();
            } else if (clean.includes(":/")) {
                return "uploads/" + clean.split("/").pop();
            }
            return clean;
        };

        for (const p of products) {
            const newImage  = fixPath(p.image);
            const newImages = (p.images || []).map(fixPath);

            if (newImage !== p.image || JSON.stringify(newImages) !== JSON.stringify(p.images)) {
                p.image  = newImage;
                p.images = newImages;
                await p.save();
                fixed++;
            }
        }

        res.json({ message: `Fixed ${fixed} products out of ${products.length} total.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==============================
// ROUTES
// ==============================
app.use('/api/auth',          authRoutes);
app.use('/api/products',      productRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/purchase',      purchaseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',         adminRoutes);

// ==============================
// GLOBAL ERROR HANDLER
// ==============================
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ message: 'CORS policy violation' });
    }
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

// ==============================
// DATABASE CONNECTION
// ==============================
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("❌ FATAL: MONGO_URI is missing in .env");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB Connected");
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    });