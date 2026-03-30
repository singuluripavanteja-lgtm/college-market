const protect = require("./authMiddleware");
const User = require("../models/User");

const adminOnly = async (req, res, next) => {
    // First run normal auth
    protect(req, res, async () => {
        const user = await User.findById(req.user.id).select("isAdmin");
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: "Admin access required" });
        }
        next();
    });
};

module.exports = adminOnly;