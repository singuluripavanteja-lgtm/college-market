requireAuth();

let allProducts = [];
let notifOpen = null; // track which dropdown is open

// ── Hamburger menu ─────────────────────────────────
function toggleMenu() {
    document.getElementById("mobileMenu").classList.toggle("open");
}

// Close menu when clicking outside
document.addEventListener("click", (e) => {
    const menu = document.getElementById("mobileMenu");
    const hamburger = document.querySelector(".hamburger");
    if (menu.classList.contains("open") && !menu.contains(e.target) && !hamburger.contains(e.target)) {
        menu.classList.remove("open");
    }
    // Close notification dropdown if clicking outside
    if (notifOpen && !e.target.closest(".notif-wrapper")) {
        document.getElementById("notifDropdown").classList.remove("open");
        document.getElementById("notifDropdownMobile").classList.remove("open");
        notifOpen = null;
    }
});

async function loadUnreadCount() {
    try {
        const res = await apiFetch(`${API_BASE}/messages/unread/count`);
        const data = await res.json();
        ["unreadBadge", "unreadBadgeMobile"].forEach(id => {
            const el = document.getElementById(id);
            if (el && data.count > 0) { el.textContent = data.count; el.style.display = "inline"; }
        });
    } catch (e) { /* silent */ }
}

// ── Notifications ──────────────────────────────────
let notifications = [];

function toggleNotifications() {
    const dd = document.getElementById("notifDropdown");
    const isOpen = dd.classList.contains("open");
    dd.classList.toggle("open", !isOpen);
    if (!isOpen) renderNotifications();
}

async function loadNotifications() {
    try {
        const res = await apiFetch(`${API_BASE}/notifications`);
        notifications = await res.json();
        updateNotifBadge();
    } catch (e) { /* silent */ }
}

function updateNotifBadge() {
    const unread = notifications.filter(n => !n.read).length;
    const el = document.getElementById("notifBadge");
    if (!el) return;
    if (unread > 0) { el.textContent = unread > 9 ? "9+" : unread; el.style.display = "block"; }
    else { el.style.display = "none"; }
}

function renderNotifications() {
    const list = document.getElementById("notifList");

    if (!notifications.length) {
        list.innerHTML = `<div class="notif-empty">🔔<br>No notifications yet</div>`;
        return;
    }

    const icons = { message: "💬", request: "🛒", approved: "✅", rejected: "❌" };

    list.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.read ? "" : "unread"}" onclick="openNotif('${n._id}', '${n.link || ""}')">
            <div class="notif-icon ${n.type}">${icons[n.type] || "🔔"}</div>
            <div class="notif-text">
                <div class="notif-title">${n.title}</div>
                <div class="notif-body">${n.body}</div>
                <div class="notif-time">${timeAgo(n.createdAt)}</div>
            </div>
        </div>
    `).join("");
}

async function openNotif(id, link) {
    // Mark as read
    try { await apiFetch(`${API_BASE}/notifications/${id}/read`, { method: "PUT" }); } catch (e) {}
    const n = notifications.find(n => n._id === id);
    if (n) n.read = true;
    updateNotifBadge();
    if (link) window.location.href = link;
}

async function markAllRead() {
    try {
        await apiFetch(`${API_BASE}/notifications/read-all`, { method: "PUT" });
        notifications.forEach(n => n.read = true);
        updateNotifBadge();
        renderNotifications();
    } catch (e) { /* silent */ }
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr);
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
}

// ── Products ───────────────────────────────────────
async function loadProducts() {
    const container = document.getElementById("productContainer");
    container.innerHTML = Array(8).fill('<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line price"></div><div class="skeleton-line short"></div></div></div>').join('');
    try {
        const response = await apiFetch(`${API_BASE}/products`);
        if (!response.ok) throw new Error();
        allProducts = await response.json();
        displayProducts(allProducts);
    } catch (error) {
        container.innerHTML = "<p style='color:red;'>Failed to load products. Is the server running?</p>";
    }
}

function esc(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function filterByCategory(cat) {
    if (event) event.preventDefault();
    document.getElementById("viewTitle").textContent = cat;
    displayProducts(allProducts.filter(p => p.category === cat));
}

function filterProducts(type) {
    if (event) event.preventDefault();
    const title = document.getElementById("viewTitle");
    const map = { all: "All Available Items", sell: "Items For Sale", rent: "Items For Rent" };
    title.textContent = map[type] || "All Available Items";
    displayProducts(type === "all" ? allProducts : allProducts.filter(p => p.type === type));
}

function displayProducts(products) {
    const container = document.getElementById("productContainer");
    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🛍️</div><p>No items found.<br><small>Try a different filter or check back later.</small></p></div>';
        return;
    }

    // Update item count
    const countEl = document.getElementById("itemCount");
    if (countEl) countEl.textContent = `${products.length} item${products.length !== 1 ? 's' : ''}`;

    products.forEach((product, i) => {
        const rawImg = (product.images && product.images.length > 0) ? product.images[0] : product.image;
        const imageUrl = imgUrl(rawImg);
        const isRent = product.type === "rent";

        const rentLine = isRent && product.rentPricePerDay
            ? `<div class="card-rent-price">₹${Number(product.rentPricePerDay).toLocaleString()}/day${product.depositAmount ? ` · ₹${Number(product.depositAmount).toLocaleString()} deposit` : ''}</div>`
            : '';

        const tags = [];
        if (product.category)       tags.push(`<span class="card-tag">🏷️ ${esc(product.category)}</span>`);
        if (product.pickupLocation) tags.push(`<span class="card-tag">📍 ${esc(product.pickupLocation)}</span>`);

        const card = document.createElement("div");
        card.className = "product-card";
        card.style.animationDelay = `${Math.min(i * 0.04, 0.32)}s`;
        card.innerHTML = `
            <div class="card-image-wrap">
                <img src="${imageUrl}" alt="${esc(product.name)}"
                    onerror="this.onerror=null;this.src='${SERVER_BASE}/placeholder.svg'"/>
                <span class="card-badge ${isRent ? 'rent' : 'sell'}">${isRent ? 'Rent' : 'Sale'}</span>
            </div>
            <div class="card-body">
                <div class="card-title">${esc(product.name)}</div>
                <div class="card-price">₹${Number(product.price).toLocaleString()}</div>
                ${rentLine}
                <div class="card-desc">${esc(product.description || '')}</div>
                ${tags.length ? `<div class="card-meta">${tags.join('')}</div>` : ''}
            </div>
            <div class="card-footer">
                <button class="view-btn" onclick="viewDetails('${product._id}')">View →</button>
                <span class="card-seller">${esc(product.owner?.userName || '')}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function viewDetails(productId) {
    window.location.href = `../productDetail/productDetail.html?id=${productId}`;
}

// ── Dark mode icon sync ────────────────────────────
function syncDarkBtn() {
    const btn = document.getElementById("darkBtn");
    if (btn) btn.textContent = document.documentElement.classList.contains("dark") ? "☀️" : "🌙";
}
syncDarkBtn();
const _origToggle = window.toggleDarkMode;
window.toggleDarkMode = function() { _origToggle(); syncDarkBtn(); };

// ── Show admin link if admin ───────────────────────
if (isAdmin()) {
    const el = document.getElementById("adminLink");
    if (el) el.style.display = "inline";
}

// ── Browse dropdown toggle ─────────────────────────
function toggleBrowse(e) {
    e.stopPropagation();
    const dd = document.querySelector(".dropdown-content");
    dd.classList.toggle("open");
}
// Close dropdown when clicking anywhere else
document.addEventListener("click", () => {
    document.querySelectorAll(".dropdown-content.open")
        .forEach(d => d.classList.remove("open"));
});

// ── Load active announcements ──────────────────────
function getDismissed() {
    try { return JSON.parse(localStorage.getItem("dismissedAnnouncements") || "[]"); }
    catch { return []; }
}
function dismissAnnouncement(id, el) {
    const dismissed = getDismissed();
    if (!dismissed.includes(id)) dismissed.push(id);
    localStorage.setItem("dismissedAnnouncements", JSON.stringify(dismissed));
    el.remove();
}

async function loadAnnouncements() {
    try {
        const res  = await fetch(`${API_BASE}/admin/announcements/active`);
        const list = await res.json();
        const banner = document.getElementById("announcementBanner");
        if (!list.length || !banner) return;

        const dismissed = getDismissed();
        const visible = list.filter(a => !dismissed.includes(a._id));
        if (!visible.length) return;

        const colors = { info: "#3498db", warning: "#e67e22", success: "#27ae60" };
        banner.innerHTML = visible.map(a => `
            <div id="ann-${a._id}" style="background:${colors[a.type]||colors.info};color:white;padding:10px 5%;
                display:flex;justify-content:space-between;align-items:center;font-size:14px;">
                <span><strong>📢 ${esc(a.title)}</strong> — ${esc(a.body)}</span>
                <button onclick="dismissAnnouncement('${a._id}', document.getElementById('ann-${a._id}'))"
                    style="background:none;border:none;color:white;font-size:18px;cursor:pointer;padding:0 0 0 12px;line-height:1;">✕</button>
            </div>
        `).join("");
    } catch (e) { /* silent */ }
}

// ── Init ───────────────────────────────────────────
loadProducts();

// Refresh product listing every 30s so newly sold items disappear automatically
setInterval(loadProducts, 30000);
loadUnreadCount();
loadNotifications();
loadAnnouncements();

// Poll notifications every 15 seconds
setInterval(() => { loadNotifications(); loadUnreadCount(); }, 15000);