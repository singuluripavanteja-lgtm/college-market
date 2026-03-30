const Notification = require("../models/Notification");

async function notify({ recipient, type, title, body, link }) {
    try {
        await Notification.create({ recipient, type, title, body, link });
    } catch (err) {
        console.error("Notification error:", err.message);
    }
}

module.exports = notify;