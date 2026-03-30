requireAuth();

const currentUser = getUser();

function esc(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function loadConversations() {
    try {
        const res = await apiFetch(`${API_BASE}/messages/conversations`);
        const conversations = await res.json();

        const list = document.getElementById("convList");

        if (!conversations.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="icon">💬</div>
                    <h3>No messages yet</h3>
                    <p>When you contact a seller or get contacted by a buyer,<br>your conversations will appear here.</p>
                    <a href="../home/home.html">Browse Items</a>
                </div>
            `;
            return;
        }

        list.innerHTML = "";

        conversations.forEach(conv => {
            const initial = esc(conv.otherUser.userName.charAt(0).toUpperCase());
            const imageUrl = conv.product.image
                ? imgUrl(conv.product.image)
                : null;

            const timeStr = formatTime(conv.lastTime);

            const card = document.createElement("a");
            card.className = `conv-card ${conv.unread > 0 ? "unread" : ""}`;
            card.href = `../chat/chat.html?user=${esc(conv.otherUser._id)}&product=${esc(conv.product._id)}`;

            card.innerHTML = `
                ${imageUrl
                    ? `<img class="conv-product-img" src="${imageUrl}" alt="${esc(conv.product.name)}" onerror="this.style.display='none'">`
                    : `<div class="conv-avatar">${initial}</div>`
                }
                <div class="conv-info">
                    <div class="conv-top">
                        <span class="conv-name">${esc(conv.otherUser.userName)}</span>
                        <span class="conv-time">${esc(timeStr)}</span>
                    </div>
                    <div class="conv-product-name">re: ${esc(conv.product.name)}</div>
                    <div class="conv-last-msg">${esc(conv.lastMessage)}</div>
                </div>
                ${conv.unread > 0 ? `<span class="unread-badge">${conv.unread}</span>` : ""}
            `;

            list.appendChild(card);
        });

    } catch (err) {
        document.getElementById("convList").innerHTML = `
            <div class="empty-state">
                <div class="icon">⚠️</div>
                <h3>Could not load messages</h3>
                <p>Make sure the server is running.</p>
            </div>
        `;
    }
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "yesterday";
    return date.toLocaleDateString();
}

loadConversations();