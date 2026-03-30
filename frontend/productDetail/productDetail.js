requireAuth();

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
if (!productId) window.location.href = "../home/home.html";

const currentUser = getUser();

function esc(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function loadProduct() {
    try {
        const res = await apiFetch(`${API_BASE}/products/${productId}`);
        const product = await res.json();
        if (!res.ok) throw new Error(product.message);
        renderProduct(product);
    } catch (err) {
        document.getElementById("detailContent").innerHTML = "<p style='color:red;'>Failed to load product.</p>";
    }
}

function formatDate(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function buildRentDetailsHTML(product) {
    if (product.type !== "rent") return "";

    const rows = [];

    if (product.rentPricePerDay)
        rows.push(`<span><strong>Price per day:</strong> &#8377; ${product.rentPricePerDay.toLocaleString()}</span>`);

    const minD = product.minRentDays || 1;
    const maxD = product.maxRentDays;
    if (maxD)
        rows.push(`<span><strong>Rental duration:</strong> ${minD} – ${maxD} days</span>`);
    else
        rows.push(`<span><strong>Min rental:</strong> ${minD} day${minD > 1 ? "s" : ""}</span>`);

    if (product.depositAmount)
        rows.push(`<span><strong>Security deposit:</strong> &#8377; ${product.depositAmount.toLocaleString()} <small style="color:#888;">(refundable)</small></span>`);

    const from = formatDate(product.availableFrom);
    const to   = formatDate(product.availableTo);
    if (from && to)
        rows.push(`<span><strong>Available:</strong> ${from} → ${to}</span>`);
    else if (from)
        rows.push(`<span><strong>Available from:</strong> ${from}</span>`);

    if (product.rentConditions)
        rows.push(`<span><strong>Conditions:</strong> ${product.rentConditions}</span>`);

    if (!rows.length) return "";

    return `
        <div style="background:#f0f7ff;border:1px solid #bee3f8;border-radius:10px;
            padding:14px 16px;margin:14px 0;">
            <div style="font-size:13px;font-weight:700;color:#2980b9;margin-bottom:10px;">🔑 Rental Details</div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#444;">
                ${rows.join("")}
            </div>
        </div>
    `;
}

function renderProduct(product) {
    // Handle both Cloudinary URLs (https://...) and local paths
    function imgUrl(p) {
        if (!p) return PLACEHOLDER;
        if (p.startsWith("http")) return p;
        return `${SERVER_BASE}/${p.replace(/\\/g, "/")}`;
    }

    const imgs = (product.images && product.images.length > 0)
        ? product.images
        : (product.image ? [product.image] : []);
    const mainImg = imgs.length ? imgUrl(imgs[0]) : PLACEHOLDER;

    const isOwner   = currentUser &&
        (currentUser.id === product.owner?._id || currentUser._id === product.owner?._id);
    const isAvailable = !product.isSold;

    document.title = `${product.name} - CollegeMart`;

    // Thumbnail strip for multiple images
    const thumbStrip = imgs.length > 1 ? `
        <div style="display:flex;gap:8px;padding:10px;overflow-x:auto;background:#f8f9fa;">
            ${imgs.map((img, i) => `
                <img src="${imgUrl(img)}"
                    onclick="document.querySelector('.detail-image').src=this.src"
                    style="width:64px;height:54px;object-fit:cover;border-radius:6px;cursor:pointer;
                    border:2px solid ${i===0?'#3498db':'#ddd'};flex-shrink:0;"
                    onmouseover="this.style.borderColor='#3498db'"
                    onmouseout="this.style.borderColor='${i===0?'#3498db':'#ddd'}'"
                    onerror="this.style.display='none'">
            `).join("")}
        </div>` : "";

    const categoryTag = product.category
        ? `<span style="background:#ecf0f1;padding:3px 10px;border-radius:12px;font-size:12px;color:#555;">🏷️ ${product.category}</span>` : "";
    const pickupTag = product.pickupLocation
        ? `<span style="font-size:13px;color:#555;">📍 <strong>Pickup:</strong> ${product.pickupLocation}</span>` : "";

    document.getElementById("detailContent").innerHTML = `
        <div class="detail-card">
            <div style="width:45%;display:flex;flex-direction:column;">
                <img class="detail-image" src="${mainImg}" alt="${product.name}"
                    style="width:100%;min-height:300px;object-fit:cover;"
                    onerror="this.onerror=null;this.src='${SERVER_BASE}/placeholder.svg'">
                ${thumbStrip}
            </div>
            <div class="detail-info">
                ${product.isSold ? `<span class="sold-badge">SOLD</span>` : ""}
                <h2>${esc(product.name)}</h2>
                ${categoryTag}
                <div class="detail-price">&#8377; ${product.price.toLocaleString()}
                    ${product.type === "rent" && product.rentPricePerDay
                        ? `<span style="font-size:14px;color:#888;font-weight:400;"> &nbsp;+&nbsp; &#8377;${product.rentPricePerDay}/day</span>`
                        : ""}
                </div>
                <p class="detail-desc">${esc(product.description || "No description provided.")}</p>

                ${buildRentDetailsHTML(product)}

                <div class="detail-meta">
                    <span><strong>Type:</strong> ${product.type === "sell" ? "For Sale" : "For Rent"}</span>
                    <span><strong>Seller:</strong> ${product.owner?.userName || "Unknown"}</span>
                    ${pickupTag}
                    <span><strong>Listed on:</strong> ${new Date(product.createdAt).toLocaleDateString()}</span>
                </div>

                ${!isOwner ? `
                    ${isAvailable ? `
                        <div id="requestSection">
                            <textarea id="requestMsg"
                                placeholder="${product.type === "rent"
                                    ? "Mention how many days you need it, your use case, etc."
                                    : "Introduce yourself or ask the seller a question..."}"
                                style="width:100%;padding:10px;margin:15px 0 10px;border:1px solid #ddd;
                                border-radius:8px;font-size:13px;resize:vertical;min-height:70px;
                                box-sizing:border-box;font-family:inherit;"></textarea>
                            <button class="btn-buy" id="requestBtn" onclick="sendRequest()">
                                ${product.type === "sell" ? "🛒 Request to Buy" : "🔑 Request to Rent"}
                            </button>
                        </div>
                    ` : `<button class="btn-buy" disabled>No Longer Available</button>`}
                    <button class="btn-contact" onclick="messageSeller('${product.owner?._id}')">
                        💬 Message Seller
                    </button>
                ` : `
                    <p style="margin-top:20px;padding:12px;background:#f8f9fa;border-radius:8px;
                        font-size:14px;color:#666;text-align:center;">This is your listing</p>
                `}
                <div id="statusMessage"></div>
            </div>
        </div>
    `;

    if (!isOwner && isAvailable) checkExistingRequest();
}

async function checkExistingRequest() {
    try {
        const res = await apiFetch(`${API_BASE}/purchase/outgoing`);
        const requests = await res.json();
        const existing = requests.find(r =>
            r.product?._id === productId || r.product === productId
        );
        if (existing) showRequestStatus(existing.status);
    } catch (e) { /* silent */ }
}

function showRequestStatus(status) {
    const section = document.getElementById("requestSection");
    if (!section) return;
    const msgs = {
        pending:  ["#fff3cd","#856404","⏳ Your request is pending — waiting for seller to respond"],
        approved: ["#d4edda","#155724","✅ Your request was approved! Check your purchases in profile."],
        rejected: ["","",""]
    };
    if (status === "rejected") {
        document.getElementById("statusMessage").innerHTML =
            `<p style="color:#e74c3c;font-size:13px;margin-top:8px;">
                Your previous request was rejected. You may send another.
            </p>`;
        return;
    }
    const [bg, color, text] = msgs[status] || [];
    if (bg) {
        section.innerHTML = `<div style="padding:12px;background:${bg};border-radius:8px;
            font-size:14px;color:${color};text-align:center;">${text}</div>`;
    }
}

async function sendRequest() {
    const btn       = document.getElementById("requestBtn");
    const msgText   = document.getElementById("requestMsg")?.value.trim() || "";
    const statusDiv = document.getElementById("statusMessage");

    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
        const res = await apiFetch(`${API_BASE}/purchase/request/${productId}`, {
            method: "POST",
            body: JSON.stringify({ message: msgText })
        });
        const data = await res.json();
        if (res.ok) {
            showRequestStatus("pending");
            statusDiv.innerHTML = "";
        } else {
            statusDiv.innerHTML = `<p style="color:red;font-size:13px;margin-top:8px;">${data.message}</p>`;
            btn.disabled = false;
            btn.textContent = "Request to Buy";
        }
    } catch {
        statusDiv.innerHTML = `<p style="color:red;font-size:13px;margin-top:8px;">Error sending request</p>`;
        btn.disabled = false;
    }
}

function messageSeller(sellerId) {
    window.location.href = `../chat/chat.html?user=${sellerId}&product=${productId}`;
}

loadProduct();