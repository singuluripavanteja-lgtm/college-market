requireAuth();

const currentUser = getUser();
const params      = new URLSearchParams(window.location.search);
const otherUserId = params.get("user");
const productId   = params.get("product");

if (!otherUserId || !productId) window.location.href = "../messages/messages.html";

let pollInterval     = null;
let lastMessageCount = 0;
let dealRequest      = null; // current purchase request state

// ── INIT ───────────────────────────────────────────
async function init() {
    await loadProductInfo();
    await loadDealStatus();
    await loadMessages();
    pollInterval = setInterval(async () => {
        await loadMessages(true);
        await loadDealStatus();
    }, 4000);
}

// ── PRODUCT INFO ───────────────────────────────────
async function loadProductInfo() {
    try {
        const res     = await apiFetch(`${API_BASE}/products/${productId}`);
        const product = await res.json();
        if (!res.ok) return;

        document.getElementById("chatName").textContent   = product.owner?.userName || "User";
        document.getElementById("chatSub").textContent    = product.name;
        document.getElementById("chatAvatar").textContent = (product.owner?.userName || "U").charAt(0).toUpperCase();

        const strip = document.getElementById("productStrip");
        strip.style.display = "flex";
        document.getElementById("productName").textContent  = product.name;
        document.getElementById("productPrice").textContent = `₹ ${product.price?.toLocaleString()}`;
        if (product.image) document.getElementById("productImg").src = imgUrl(product.image);
    } catch (e) {}
}

// ── DEAL STATUS ────────────────────────────────────
async function loadDealStatus() {
    try {
        const res  = await apiFetch(`${API_BASE}/purchase/status/${productId}`);
        const data = await res.json();
        if (!res.ok || !data.exists) return;

        dealRequest = data;
        renderDealBar(data);
        renderInputArea(data);
    } catch (e) {}
}

function renderDealBar(d) {
    const bar = document.getElementById("dealBar");
    if (!bar) return;

    if (d.status === "completed") {
        bar.innerHTML = `<div class="deal-banner completed">🎉 Deal Completed! Item has been marked as sold.</div>`;
        return;
    }
    if (d.status === "rejected") {
        bar.innerHTML = `<div class="deal-banner rejected">❌ This request was declined.</div>`;
        return;
    }
    if (d.status === "pending") {
        bar.innerHTML = `<div class="deal-banner info">⏳ Request is pending seller approval.</div>`;
        return;
    }
    if (d.status === "approved") {
        bar.innerHTML = `<div class="deal-banner info">✅ Request approved! You can now chat. Confirm the deal when you're both ready.</div>`;
        return;
    }

    // chatting / seller_confirmed / buyer_confirmed
    const myConfirmed    = d.isSeller ? d.sellerConfirmed : d.buyerConfirmed;
    const otherConfirmed = d.isSeller ? d.buyerConfirmed  : d.sellerConfirmed;

    let statusText = "";
    if (myConfirmed && !otherConfirmed)       statusText = "✅ You confirmed. Waiting for the other party...";
    else if (!myConfirmed && otherConfirmed)  statusText = "⚠️ Other party confirmed! Please confirm your side to complete the deal.";
    else if (!myConfirmed && !otherConfirmed) statusText = "🤝 Both parties need to confirm to complete the deal.";

    bar.innerHTML = `
        <div class="deal-banner deal-action">
            <span>${statusText}</span>
            ${!myConfirmed ? `<button class="confirm-btn" onclick="confirmDeal()">✅ Confirm Deal</button>` : ""}
        </div>
    `;
}

function renderInputArea(d) {
    const inputArea = document.getElementById("inputArea");
    if (!inputArea) return;

    if (d.status === "completed") {
        inputArea.innerHTML = `<div class="chat-closed">🎉 Deal completed. This chat is now closed.</div>`;
        return;
    }
    if (d.status === "rejected") {
        inputArea.innerHTML = `<div class="chat-closed">❌ Request was declined. This chat is closed.</div>`;
        return;
    }
    if (d.status === "pending") {
        inputArea.innerHTML = `<div class="chat-closed">⏳ Waiting for seller to approve the request before you can chat.</div>`;
        return;
    }

    // approved / chatting / seller_confirmed / buyer_confirmed — chat is open
    inputArea.innerHTML = `
        <div class="input-row">
            <textarea id="msgInput" placeholder="Type a message..." rows="1"></textarea>
            <button id="sendBtn" onclick="sendMessage()">Send</button>
        </div>
    `;

    document.getElementById("msgInput").addEventListener("input", function() { autoResize(this); });
    document.getElementById("msgInput").addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

// ── CONFIRM DEAL ───────────────────────────────────
async function confirmDeal() {
    if (!dealRequest?.requestId) return;
    if (!confirm("Confirm this deal? The item will be marked as sold once both parties confirm.")) return;

    const btn = document.querySelector(".confirm-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Confirming..."; }

    try {
        const res  = await apiFetch(`${API_BASE}/purchase/confirm/${dealRequest.requestId}`, { method: "PUT" });
        const data = await res.json();

        if (res.ok) {
            await loadDealStatus();
            await loadMessages(false);

            // If deal just completed, stop polling — it's done
            if (data.status === "completed") {
                if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
            }
        } else {
            alert(data.message || "Failed to confirm");
            if (btn) { btn.disabled = false; btn.textContent = "✅ Confirm Deal"; }
        }
    } catch (e) {
        alert("Error confirming deal");
        if (btn) { btn.disabled = false; btn.textContent = "✅ Confirm Deal"; }
    }
}

// ── LOAD MESSAGES ──────────────────────────────────
async function loadMessages(silent = false) {
    try {
        const res      = await apiFetch(`${API_BASE}/messages/${otherUserId}/${productId}`);
        const messages = await res.json();
        if (!res.ok) throw new Error();
        if (messages.length === lastMessageCount && silent) return;
        lastMessageCount = messages.length;
        renderMessages(messages);
    } catch (e) {
        if (!silent) {
            document.getElementById("messagesArea").innerHTML = `<div class="empty-chat"><div class="icon">⚠️</div><p>Could not load messages</p></div>`;
        }
    }
}

// ── RENDER MESSAGES ────────────────────────────────
function renderMessages(messages) {
    const area = document.getElementById("messagesArea");
    const wasAtBottom = area.scrollHeight - area.scrollTop <= area.clientHeight + 60;

    if (messages.length === 0) {
        area.innerHTML = `<div class="empty-chat"><div class="icon">💬</div><p>No messages yet.</p></div>`;
        return;
    }

    area.innerHTML = "";
    let lastDate = null;

    messages.forEach(msg => {
        const isMe    = msg.sender._id === currentUser.id || msg.sender._id === currentUser._id;
        const msgDate = new Date(msg.createdAt).toDateString();

        if (msgDate !== lastDate) {
            const divider = document.createElement("div");
            divider.className = "date-divider";
            divider.innerHTML = `<span>${formatDate(msg.createdAt)}</span>`;
            area.appendChild(divider);
            lastDate = msgDate;
        }

        const row     = document.createElement("div");
        row.className = `bubble-row ${isMe ? "me" : "them"}`;
        const initial = (msg.sender.userName || "U").charAt(0).toUpperCase();
        const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        row.innerHTML = `
            ${!isMe ? `<div class="bubble-avatar">${initial}</div>` : ""}
            <div>
                <div class="bubble">${escapeHtml(msg.text)}</div>
                <div class="bubble-time">${timeStr}</div>
            </div>
        `;
        area.appendChild(row);
    });

    if (wasAtBottom) area.scrollTop = area.scrollHeight;
}

// ── SEND MESSAGE ───────────────────────────────────
async function sendMessage() {
    const input = document.getElementById("msgInput");
    const btn   = document.getElementById("sendBtn");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    btn.disabled = true;
    input.value  = "";
    autoResize(input);

    try {
        const res = await apiFetch(`${API_BASE}/messages/send`, {
            method: "POST",
            body: JSON.stringify({ receiverId: otherUserId, productId, text })
        });

        if (res.ok) {
            await loadMessages();
            await loadDealStatus(); // refresh deal bar (e.g. seller sent first msg)
        } else {
            const data = await res.json();
            alert(data.message || "Failed to send message");
            input.value = text;
        }
    } catch (e) {
        alert("Error sending message");
        input.value = text;
    } finally {
        btn.disabled = false;
        input.focus();
    }
}

// ── HELPERS ────────────────────────────────────────
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString())     return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/\n/g, "<br>");
}

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}

window.addEventListener("beforeunload", () => { if (pollInterval) clearInterval(pollInterval); });

init();