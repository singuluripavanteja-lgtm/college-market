const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ALLOWED_DOMAIN = "student.nitandhra.ac.in";

function makeToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function userResponse(user, token) {
    return {
        token,
        user: {
            id: user._id,
            _id: user._id,
            userName: user.userName,
            email: user.email,
            year: user.year,
            branch: user.branch,
            phNo: user.phNo,
            isAdmin: user.isAdmin || false,
            isProfileComplete: user.isProfileComplete
        }
    };
}

// ── Google One Tap ─────────────────────────────────
exports.googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ message: "No credential provided" });

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const { sub: googleId, email, name, email_verified } = ticket.getPayload();

        if (!email_verified)
            return res.status(400).json({ message: "Google email not verified" });

        if (!email.endsWith(`@${ALLOWED_DOMAIN}`))
            return res.status(403).json({
                message: `Only @${ALLOWED_DOMAIN} accounts are allowed`
            });

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            user = await User.create({ userName: name, email, googleId, isProfileComplete: false });
        } else if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }

        if (user.isBanned) {
            return res.status(403).json({ message: "Your account has been suspended. Contact admin." });
        }

        const token = makeToken(user._id);
        res.json({
            message: user.isProfileComplete ? "Login Successful" : "Profile setup required",
            needsProfileSetup: !user.isProfileComplete,
            ...userResponse(user, token)
        });

    } catch (error) {
        console.error("Google auth error:", error);
        res.status(401).json({ message: "Google sign-in failed. Please try again." });
    }
};

// ── Complete profile (after first Google sign-in) ──
exports.completeProfile = async (req, res) => {
    try {
        const { year, branch, phNo, userName } = req.body;

        if (!year || !branch)
            return res.status(400).json({ message: "Year and branch are required" });

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { year, branch, phNo: phNo || null, userName: userName || undefined, isProfileComplete: true },
            { new: true }
        );

        const token = makeToken(user._id);
        res.json({ message: "Profile completed!", ...userResponse(user, token) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ── Get current user ───────────────────────────────
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};