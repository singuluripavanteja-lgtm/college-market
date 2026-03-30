// =============================================
// shared.js — include in every page
// =============================================

const _isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const SERVER_BASE = _isLocal ? "http://127.0.0.1:5000" : window.location.origin;
const API_BASE    = `${SERVER_BASE}/api`;

const PLACEHOLDER = `${SERVER_BASE}/placeholder.svg`;

// Convert DB image path to full browser URL
function imgUrl(src) {
    if (!src) return PLACEHOLDER;
    if (src.startsWith("http://") || src.startsWith("https://")) return src;

    // Fix Windows backslashes
    let clean = src.replace(/\\/g, "/");

    // Strip leading slashes
    clean = clean.replace(/^\/+/, "");

    // Ensure path starts with uploads/
    if (!clean.startsWith("uploads/")) {
        clean = "uploads/" + clean.split("/").pop();
    }

    return `${SERVER_BASE}/${clean}`;
}

function getToken() { return localStorage.getItem("token"); }

function getUser() {
    try { return JSON.parse(localStorage.getItem("user")); }
    catch { return null; }
}

function isAdmin() {
    const u = getUser();
    return u && u.isAdmin === true;
}

function requireAuth() {
    if (!getToken()) window.location.href = "../login/login.html";
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("darkMode");
    window.location.href = "../login/login.html";
}

async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    return fetch(url, { ...options, headers });
}

// ── Dark Mode ──────────────────────────────────────
function applyDarkMode(on) {
    document.documentElement.classList.toggle("dark", on);
    localStorage.setItem("darkMode", on ? "1" : "0");
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.contains("dark");
    applyDarkMode(!isDark);
}

// Apply on load
(function () {
    if (localStorage.getItem("darkMode") === "1") {
        document.documentElement.classList.add("dark");
    }
})();