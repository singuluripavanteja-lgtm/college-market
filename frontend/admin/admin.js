requireAuth();
if (!isAdmin()) {
    alert("Admin access only.");
    window.location.href = "../home/home.html";
}

// Dark mode
function syncDarkBtn() {
    const btn = document.getElementById("darkBtn");
    if (btn) btn.textContent = document.documentElement.classList.contains("dark") ? "☀️" : "🌙";
}
syncDarkBtn();

let allUsers    = [];
let allListings = [];

// ── Tabs ───────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll(".tab-btn").forEach((b, i) => {
        const tabs = ["users","listings","announcements"];
        b.classList.toggle("active", tabs[i] === name);
    });
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.getElementById(`tab-${name}`).classList.add("active");
}

// ── Stats ──────────────────────────────────────────
async function loadStats() {
    try {
        const res  = await apiFetch(`${API_BASE}/admin/stats`);
        const data = await res.json();
        document.getElementById("s-users").textContent    = data.totalUsers;
        document.getElementById("s-products").textContent = data.totalProducts;
        document.getElementById("s-sold").textContent     = data.soldProducts;
        document.getElementById("s-flagged").textContent  = data.flaggedProducts;
        document.getElementById("s-ann").textContent      = data.activeAnnouncements;
    } catch (e) { console.error(e); }
}

// ── Users ──────────────────────────────────────────
async function loadUsers() {
    try {
        const res = await apiFetch(`${API_BASE}/admin/users`);
        allUsers  = await res.json();
        renderUsers(allUsers);
    } catch (e) { document.getElementById("usersTable").innerHTML = `<tr><td colspan="6" class="no-data">Failed to load users</td></tr>`; }
}

function renderUsers(users) {
    const tbody = document.getElementById("usersTable");
    if (!users.length) { tbody.innerHTML = `<tr><td colspan="6" class="no-data">No users found</td></tr>`; return; }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${escHtml(u.userName)}</strong></td>
            <td>${escHtml(u.email)}</td>
            <td>${u.branch || "–"}</td>
            <td>${u.year || "–"}</td>
            <td>
                ${u.isAdmin  ? `<span class="badge-admin">Admin</span> ` : ""}
                ${u.isBanned ? `<span class="badge-banned">Banned</span>` : ""}
            </td>
            <td>
                <button class="act-btn ${u.isBanned ? 'btn-green' : 'btn-red'}" onclick="toggleBan('${u._id}')">
                    ${u.isBanned ? "Unban" : "Ban"}
                </button>
                <button class="act-btn ${u.isAdmin ? 'btn-yellow' : 'btn-blue'}" onclick="toggleAdmin('${u._id}')">
                    ${u.isAdmin ? "Remove Admin" : "Make Admin"}
                </button>
            </td>
        </tr>
    `).join("");
}

function filterUsers() {
    const q = document.getElementById("userSearch").value.toLowerCase();
    renderUsers(allUsers.filter(u =>
        u.userName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    ));
}

async function toggleBan(userId) {
    try {
        const res  = await apiFetch(`${API_BASE}/admin/users/${userId}/ban`, { method: "PUT" });
        const data = await res.json();
        if (res.ok) { await loadUsers(); loadStats(); }
        else alert(data.message);
    } catch { alert("Error"); }
}

async function toggleAdmin(userId) {
    if (!confirm("Change admin status for this user?")) return;
    try {
        const res  = await apiFetch(`${API_BASE}/admin/users/${userId}/admin`, { method: "PUT" });
        const data = await res.json();
        if (res.ok) await loadUsers();
        else alert(data.message);
    } catch { alert("Error"); }
}

// ── Listings ───────────────────────────────────────
async function loadListings() {
    try {
        const res    = await apiFetch(`${API_BASE}/admin/products`);
        allListings  = await res.json();
        renderListings(allListings);
    } catch (e) { document.getElementById("listingsTable").innerHTML = `<tr><td colspan="7" class="no-data">Failed to load listings</td></tr>`; }
}

function renderListings(items) {
    const tbody = document.getElementById("listingsTable");
    if (!items.length) { tbody.innerHTML = `<tr><td colspan="7" class="no-data">No listings found</td></tr>`; return; }

    tbody.innerHTML = items.map(p => {
        const imgSrc = imgUrl((p.images && p.images.length) ? p.images[0] : p.image) || "";
        return `
        <tr>
            <td><img class="thumb" src="${imgSrc}" onerror="this.style.display='none'"></td>
            <td><strong>${escHtml(p.name)}</strong></td>
            <td>${p.owner ? escHtml(p.owner.userName) : "–"}</td>
            <td>${p.type.toUpperCase()}</td>
            <td>&#8377;${p.price?.toLocaleString()}</td>
            <td>
                ${p.isSold    ? `<span class="badge-sold">Sold</span> `    : ""}
                ${p.isFlagged ? `<span class="badge-flagged">Flagged</span>` : ""}
            </td>
            <td>
                <button class="act-btn ${p.isFlagged ? 'btn-gray' : 'btn-yellow'}" onclick="toggleFlag('${p._id}')">
                    ${p.isFlagged ? "Unflag" : "🚩 Flag"}
                </button>
                <button class="act-btn btn-red" onclick="deleteProduct('${p._id}')">Delete</button>
            </td>
        </tr>`;
    }).join("");
}

function filterListings() {
    const q = document.getElementById("listingSearch").value.toLowerCase();
    renderListings(allListings.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.owner && p.owner.userName.toLowerCase().includes(q))
    ));
}

async function toggleFlag(productId) {
    try {
        const res = await apiFetch(`${API_BASE}/admin/products/${productId}/flag`, { method: "PUT" });
        if (res.ok) { await loadListings(); loadStats(); }
    } catch { alert("Error"); }
}

async function deleteProduct(productId) {
    if (!confirm("Permanently delete this listing?")) return;
    try {
        const res = await apiFetch(`${API_BASE}/admin/products/${productId}`, { method: "DELETE" });
        if (res.ok) { await loadListings(); loadStats(); }
    } catch { alert("Error"); }
}

// ── Announcements ──────────────────────────────────
async function loadAnnouncements() {
    try {
        const res  = await apiFetch(`${API_BASE}/admin/announcements`);
        const list = await res.json();
        const tbody = document.getElementById("annTable");

        if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" class="no-data">No announcements yet</td></tr>`; return; }

        const typeLabel = { info: "ℹ️ Info", warning: "⚠️ Warning", success: "✅ Success" };
        tbody.innerHTML = list.map(a => `
            <tr>
                <td><strong>${escHtml(a.title)}</strong></td>
                <td>${escHtml(a.body)}</td>
                <td>${typeLabel[a.type] || a.type}</td>
                <td>${a.active ? `<span class="badge-sold">Active</span>` : `<span class="badge-banned">Off</span>`}</td>
                <td>${new Date(a.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="act-btn btn-gray" onclick="toggleAnn('${a._id}')">
                        ${a.active ? "Deactivate" : "Activate"}
                    </button>
                    <button class="act-btn btn-red" onclick="deleteAnn('${a._id}')">Delete</button>
                </td>
            </tr>
        `).join("");
    } catch (e) { console.error(e); }
}

async function sendAnnouncement() {
    const title = document.getElementById("annTitle").value.trim();
    const body  = document.getElementById("annBody").value.trim();
    const type  = document.getElementById("annType").value;
    const msg   = document.getElementById("annMsg");

    if (!title || !body) { msg.textContent = "Title and message required."; msg.style.color = "#e74c3c"; return; }

    try {
        const res  = await apiFetch(`${API_BASE}/admin/announcements`, {
            method: "POST",
            body: JSON.stringify({ title, body, type })
        });
        const data = await res.json();
        if (res.ok) {
            msg.textContent = `✅ ${data.message}`;
            msg.style.color = "#27ae60";
            document.getElementById("annTitle").value = "";
            document.getElementById("annBody").value  = "";
            await loadAnnouncements();
            loadStats();
        } else {
            msg.textContent = data.message;
            msg.style.color = "#e74c3c";
        }
    } catch { msg.textContent = "Error sending."; msg.style.color = "#e74c3c"; }
}

async function toggleAnn(id) {
    try {
        await apiFetch(`${API_BASE}/admin/announcements/${id}/toggle`, { method: "PUT" });
        await loadAnnouncements(); loadStats();
    } catch { alert("Error"); }
}

async function deleteAnn(id) {
    if (!confirm("Delete this announcement?")) return;
    try {
        await apiFetch(`${API_BASE}/admin/announcements/${id}`, { method: "DELETE" });
        await loadAnnouncements(); loadStats();
    } catch { alert("Error"); }
}

// ── Utility ────────────────────────────────────────
function escHtml(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Init ───────────────────────────────────────────
loadStats();
loadUsers();
loadListings();
loadAnnouncements();