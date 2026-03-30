requireAuth();
const currentUser = getUser();

async function loadProfile() {
    if (!currentUser?.id) {
        window.location.href = "../login/login.html";
        return;
    }
    try {
        const response = await apiFetch(`${API_BASE}/products/profile/${currentUser.id}`);
        const userData = await response.json();
        if (!response.ok) throw new Error(userData.message);

        document.getElementById("userInfo").innerHTML = `
            <p><strong>Username:</strong> ${userData.userName}</p>
            <p><strong>Email:</strong> ${userData.email}</p>
            <p><strong>Branch:</strong> ${userData.branch || "–"} — Year ${userData.year || "–"}</p>
            <p><strong>Phone:</strong> ${userData.phNo || 'Not provided'}</p>
        `;

        renderItems(userData.soldItems, "soldItemsContainer");
        renderItems(userData.rentedItems, "rentedItemsContainer");
        renderItems(userData.purchases, "purchasesContainer");
    } catch (error) {
        document.getElementById("userInfo").innerHTML = "<p style='color:red;'>Failed to load profile.</p>";
    }
}

function renderItems(items, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    if (!items || items.length === 0) {
        container.innerHTML = "<p class='no-requests'>No items found.</p>";
        return;
    }
    items.forEach(item => {
        const imageUrl = imgUrl((item.images && item.images.length > 0) ? item.images[0] : item.image) || PLACEHOLDER;
        const isOwner = containerId === "soldItemsContainer" || containerId === "rentedItemsContainer";
        const relistBtn = (isOwner && item.isSold)
            ? `<button onclick="relistItem('${item._id}')"
                style="width:100%;padding:6px;background:#27ae60;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:4px;">
                🔁 Re-list
               </button>` : "";
        container.innerHTML += `
            <div class="product-card" style="width:200px;">
                <img src="${imageUrl}" alt="${item.name}" style="width:100%;height:140px;object-fit:cover;">
                <h3 style="font-size:15px;padding:10px 12px 4px;">${item.name}</h3>
                <p style="padding:0 12px;color:#27ae60;font-weight:bold;">&#8377; ${item.price?.toLocaleString()}</p>
                ${isOwner ? `
                    <div style="padding:0 12px 12px;">
                        ${relistBtn}
                        <button onclick="deleteItem('${item._id}')"
                            style="width:100%;padding:7px;background:#e74c3c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">
                            Delete
                        </button>
                    </div>` : ""}
            </div>
        `;
    });
}

async function deleteItem(itemId) {
    if (!confirm("Delete this item?")) return;
    try {
        const res = await apiFetch(`${API_BASE}/products/${itemId}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) { alert(data.message); loadProfile(); }
        else alert(data.message || "Failed to delete");
    } catch { alert("Error deleting item"); }
}

async function relistItem(itemId) {
    if (!confirm("Re-list this item as a new active listing?")) return;
    try {
        const res  = await apiFetch(`${API_BASE}/products/relist/${itemId}`, { method: "POST" });
        const data = await res.json();
        if (res.ok) {
            alert("✅ Item re-listed! It's now visible on the home page.");
            loadProfile();
        } else {
            alert(data.message || "Failed to re-list");
        }
    } catch { alert("Error re-listing item"); }
}

// ==============================
// INCOMING REQUESTS (seller view)
// ==============================
async function loadIncomingRequests() {
    const container = document.getElementById("incomingRequestsContainer");
    try {
        const res = await apiFetch(`${API_BASE}/purchase/incoming`);
        const requests = await res.json();

        const pending = requests.filter(r => r.status === "pending");
        const badge = document.getElementById("pendingBadge");
        if (pending.length > 0) {
            badge.textContent = `${pending.length} pending`;
            badge.style.display = "inline";
        }

        if (!requests.length) {
            container.innerHTML = "<p class='no-requests'>No purchase requests yet.</p>";
            return;
        }

        container.innerHTML = "";
        requests.forEach(req => {
            const imageUrl = req.product?.image
                ? imgUrl(req.product.image)
                : "";

            const statusBadge = {
                pending:          `<span class="status-badge status-pending">⏳ Pending</span>`,
                approved:         `<span class="status-badge status-approved">✅ Approved — Chat enabled</span>`,
                chatting:         `<span class="status-badge status-approved">💬 Chatting</span>`,
                seller_confirmed: `<span class="status-badge status-approved">🤝 You confirmed</span>`,
                buyer_confirmed:  `<span class="status-badge status-pending">⏳ Buyer confirmed — awaiting your confirmation</span>`,
                completed:        `<span class="status-badge status-approved">🎉 Completed</span>`,
                rejected:         `<span class="status-badge status-rejected">❌ Rejected</span>`
            }[req.status] || `<span class="status-badge">${req.status}</span>`;

            const chatBtn = ["approved", "chatting", "seller_confirmed", "buyer_confirmed"].includes(req.status)
                ? `<a href="../chat/chat.html?user=${req.buyer?._id}&product=${req.product?._id}"
                      style="display:inline-block;margin-top:8px;padding:7px 14px;background:#2563eb;color:white;border-radius:6px;text-decoration:none;font-size:13px;">
                      💬 Open Chat
                   </a>`
                : "";

            container.innerHTML += `
                <div class="request-card" id="req-${req._id}">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${req.product?.name}">` : ""}
                    <div class="request-info">
                        <strong>${req.product?.name || "Item"}</strong>
                        <p>&#8377; ${req.product?.price?.toLocaleString()}</p>
                        <p>From: <strong>${req.buyer?.userName}</strong> (${req.buyer?.email})</p>
                        ${req.message ? `<p style="font-style:italic;color:#888;">"${req.message}"</p>` : ""}
                        ${statusBadge}
                        ${chatBtn}
                        ${req.status === "pending" ? `
                            <div class="request-actions">
                                <button class="btn-approve" onclick="approveRequest('${req._id}')">✔ Approve</button>
                                <button class="btn-reject"  onclick="rejectRequest('${req._id}')">✘ Reject</button>
                            </div>` : ""}
                    </div>
                </div>
            `;
        });
    } catch {
        container.innerHTML = "<p class='no-requests' style='color:red;'>Failed to load requests.</p>";
    }
}

async function approveRequest(requestId) {
    if (!confirm("Approve this request? The buyer will be notified and can chat with you.")) return;
    try {
        const res = await apiFetch(`${API_BASE}/purchase/approve/${requestId}`, { method: "PUT" });
        const data = await res.json();
        if (res.ok) {
            alert("✅ Request approved! Chat is now enabled.");
            loadIncomingRequests();
        } else {
            alert(data.message || "Failed to approve request");
        }
    } catch { alert("Error approving request"); }
}

async function rejectRequest(requestId) {
    if (!confirm("Reject this request?")) return;
    try {
        const res = await apiFetch(`${API_BASE}/purchase/reject/${requestId}`, { method: "PUT" });
        const data = await res.json();
        alert(data.message);
        loadIncomingRequests();
    } catch { alert("Error rejecting request"); }
}

// ==============================
// OUTGOING REQUESTS (buyer view)
// ==============================
async function loadOutgoingRequests() {
    const container = document.getElementById("outgoingRequestsContainer");
    try {
        const res = await apiFetch(`${API_BASE}/purchase/outgoing`);
        const requests = await res.json();

        if (!requests.length) {
            container.innerHTML = "<p class='no-requests'>You haven't requested to buy anything yet.</p>";
            return;
        }

        container.innerHTML = "";
        requests.forEach(req => {
            const imageUrl = req.product?.image
                ? imgUrl(req.product.image)
                : "";

            const statusBadge = {
                pending:          `<span class="status-badge status-pending">⏳ Awaiting seller response</span>`,
                approved:         `<span class="status-badge status-approved">✅ Approved — you can now chat!</span>`,
                chatting:         `<span class="status-badge status-approved">💬 Chatting with seller</span>`,
                seller_confirmed: `<span class="status-badge status-pending">⏳ Seller confirmed — waiting for your confirmation</span>`,
                buyer_confirmed:  `<span class="status-badge status-approved">🤝 You confirmed</span>`,
                completed:        `<span class="status-badge status-approved">🎉 Deal Completed</span>`,
                rejected:         `<span class="status-badge status-rejected">❌ Rejected by seller</span>`
            }[req.status] || `<span class="status-badge">${req.status}</span>`;

            const chatBtn = ["approved", "chatting", "seller_confirmed", "buyer_confirmed"].includes(req.status)
                ? `<a href="../chat/chat.html?user=${req.seller?._id}&product=${req.product?._id}"
                      style="display:inline-block;margin-top:8px;padding:7px 14px;background:#2563eb;color:white;border-radius:6px;text-decoration:none;font-size:13px;">
                      💬 Open Chat
                   </a>`
                : "";

            container.innerHTML += `
                <div class="request-card">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${req.product?.name}">` : ""}
                    <div class="request-info">
                        <strong>${req.product?.name || "Item"}</strong>
                        <p>&#8377; ${req.product?.price?.toLocaleString()} &nbsp;·&nbsp; Seller: ${req.seller?.userName}</p>
                        ${req.message ? `<p style="font-style:italic;color:#888;">Your note: "${req.message}"</p>` : ""}
                        ${statusBadge}
                        ${chatBtn}
                    </div>
                </div>
            `;
        });
    } catch {
        container.innerHTML = "<p class='no-requests' style='color:red;'>Failed to load requests.</p>";
    }
}

// ==============================
// PASSWORD MODAL
// ==============================
function openPasswordModal()  { document.getElementById("passwordModal").classList.add("active"); }
function closePasswordModal() {
    document.getElementById("passwordModal").classList.remove("active");
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("pwMessage").innerHTML = "";
}

async function changePassword() {
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const pwMessage = document.getElementById("pwMessage");
    if (!currentPassword || !newPassword) { pwMessage.innerHTML = "<span style='color:red;'>Both fields required</span>"; return; }
    if (newPassword.length < 6) { pwMessage.innerHTML = "<span style='color:red;'>Min 6 characters</span>"; return; }
    try {
        const res = await apiFetch(`${API_BASE}/products/change-password/${currentUser.id}`, {
            method: "PUT",
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (res.ok) {
            pwMessage.innerHTML = "<span style='color:green;'>Password changed! Logging out...</span>";
            setTimeout(logout, 1500);
        } else {
            pwMessage.innerHTML = `<span style='color:red;'>${data.message}</span>`;
        }
    } catch { pwMessage.innerHTML = "<span style='color:red;'>Error</span>"; }
}

// Init
loadProfile();
loadIncomingRequests();
loadOutgoingRequests();

// ==============================
// PHONE OTP MODAL (from profile)
// ==============================
let otpTimerInterval = null;

function openOtpModal() {
    document.getElementById("otpModal").classList.add("active");
}
function closeOtpModal() {
    document.getElementById("otpModal").classList.remove("active");
    document.getElementById("otpStep1").style.display = "block";
    document.getElementById("otpStep2").style.display = "none";
    document.getElementById("newPhNo").value = "";
    document.getElementById("otpDigits").value = "";
    document.getElementById("otpModalMsg").innerHTML = "";
    clearInterval(otpTimerInterval);
}

async function sendProfileOtp() {
    const phNo = document.getElementById("newPhNo").value.trim();
    const msg  = document.getElementById("otpModalMsg");
    const btn  = document.getElementById("sendProfileOtpBtn");
    msg.innerHTML = "";

    if (!/^[6-9]\d{9}$/.test(phNo)) {
        msg.innerHTML = "<span style='color:red;font-size:13px;'>Enter valid 10-digit number</span>";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
        const res = await apiFetch(`${API_BASE}/auth/send-otp`, {
            method: "POST",
            body: JSON.stringify({ phNo })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById("otpStep1").style.display = "none";
            document.getElementById("otpStep2").style.display = "block";
            startOtpTimer();
        } else {
            msg.innerHTML = `<span style='color:red;font-size:13px;'>${data.message}</span>`;
        }
    } catch { msg.innerHTML = "<span style='color:red;font-size:13px;'>Error sending OTP</span>"; }
    finally { btn.disabled = false; btn.textContent = "Send OTP"; }
}

async function verifyProfileOtp() {
    const otp = document.getElementById("otpDigits").value.trim();
    const msg = document.getElementById("otpModalMsg");
    const btn = document.getElementById("verifyProfileOtpBtn");
    msg.innerHTML = "";

    if (otp.length !== 6) {
        msg.innerHTML = "<span style='color:red;font-size:13px;'>Enter 6-digit OTP</span>";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Verifying...";

    try {
        const res = await apiFetch(`${API_BASE}/auth/verify-otp`, {
            method: "POST",
            body: JSON.stringify({ otp })
        });
        const data = await res.json();
        if (res.ok) {
            msg.innerHTML = "<span style='color:green;font-size:13px;'>✅ Phone verified!</span>";
            clearInterval(otpTimerInterval);
            const user = getUser();
            if (user) { user.isPhoneVerified = true; localStorage.setItem("user", JSON.stringify(user)); }
            setTimeout(() => { closeOtpModal(); loadProfile(); }, 1200);
        } else {
            msg.innerHTML = `<span style='color:red;font-size:13px;'>${data.message}</span>`;
            btn.disabled = false;
            btn.textContent = "Verify";
        }
    } catch { msg.innerHTML = "<span style='color:red;font-size:13px;'>Error</span>"; btn.disabled = false; btn.textContent = "Verify"; }
}

function startOtpTimer() {
    let secs = 60;
    const el = document.getElementById("otpCountdown");
    const rl = document.getElementById("otpResendLink");
    el.textContent = `${secs}s`; el.style.display = "inline"; rl.style.display = "none";
    clearInterval(otpTimerInterval);
    otpTimerInterval = setInterval(() => {
        secs--;
        el.textContent = `${secs}s`;
        if (secs <= 0) { clearInterval(otpTimerInterval); el.style.display = "none"; rl.style.display = "inline"; }
    }, 1000);
}