requireAuth();

const MAX_IMAGES = 4;
let selectedFiles = []; // stores File objects

// ── Mobile nav ─────────────────────────────────────
function toggleMobileNav() {
    document.getElementById("mobileNav").classList.toggle("open");
}

// ── Load categories from server ────────────────────
async function loadCategories() {
    try {
        const res = await apiFetch(`${API_BASE}/products/categories`);
        const cats = await res.json();
        const sel = document.getElementById("category");
        cats.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c; opt.textContent = c;
            sel.appendChild(opt);
        });
    } catch (e) {
        // fallback hardcoded
        const cats = ["Books & Notes","Electronics","Furniture","Cycles & Vehicles",
                      "Lab Equipment","Sports & Fitness","Clothing","Stationery",
                      "Kitchen & Appliances","Other"];
        const sel = document.getElementById("category");
        cats.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c; opt.textContent = c;
            sel.appendChild(opt);
        });
    }
}

// ── Type toggle ────────────────────────────────────
function setType(type) {
    document.getElementById("type").value = type;
    document.getElementById("btnSell").classList.toggle("active", type === "sell");
    document.getElementById("btnRent").classList.toggle("active", type === "rent");
    document.getElementById("rentSection").classList.toggle("visible", type === "rent");
    document.getElementById("priceLabel").innerHTML =
        type === "sell"
            ? 'Selling Price (₹) <span class="required">*</span>'
            : 'Total / Estimated Price (₹) <span class="required">*</span>';
}

// ── Image selection & preview ──────────────────────
function handleImageSelect(input) {
    const newFiles = Array.from(input.files);

    for (const file of newFiles) {
        if (selectedFiles.length >= MAX_IMAGES) break;
        // Avoid duplicate file names
        if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    }

    // Reset input so same file can be re-added if removed
    input.value = "";
    renderPreviews();
}

function renderPreviews() {
    const container = document.getElementById("imagePreviews");
    const countEl   = document.getElementById("imgCount");
    container.innerHTML = "";

    selectedFiles.forEach((file, i) => {
        const url = URL.createObjectURL(file);
        const item = document.createElement("div");
        item.className = "image-preview-item";
        item.innerHTML = `
            <img src="${url}" alt="Preview ${i+1}">
            <button class="remove-img-btn" onclick="removeImage(${i})" title="Remove">✕</button>
            ${i === 0 ? '<div style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.55);color:white;font-size:10px;padding:1px 5px;border-radius:4px;">Cover</div>' : ""}
        `;
        container.appendChild(item);
    });

    const remaining = MAX_IMAGES - selectedFiles.length;
    countEl.textContent = selectedFiles.length > 0
        ? `${selectedFiles.length} photo${selectedFiles.length > 1 ? "s" : ""} selected${remaining > 0 ? ` · ${remaining} more allowed` : " · Max reached"}`
        : "";

    // Show/hide upload area hint
    const uploadArea = document.querySelector(".image-upload-area");
    uploadArea.style.opacity = selectedFiles.length >= MAX_IMAGES ? "0.5" : "1";
    uploadArea.style.pointerEvents = selectedFiles.length >= MAX_IMAGES ? "none" : "auto";
}

function removeImage(index) {
    selectedFiles.splice(index, 1);
    renderPreviews();
}

// ── Submit ─────────────────────────────────────────
async function submitForm() {
    const type           = document.getElementById("type").value;
    const title          = document.getElementById("title").value.trim();
    const category       = document.getElementById("category").value;
    const description    = document.getElementById("description").value.trim();
    const price          = document.getElementById("price").value;
    const pickupLocation = document.getElementById("pickupLocation").value.trim();
    const message        = document.getElementById("message");
    const btn            = document.getElementById("submitBtn");

    message.innerHTML = "";

    // Validation
    if (!title)       return showError("Item title is required.");
    if (!category)    return showError("Please select a category.");
    if (!description) return showError("Description is required.");
    if (!price)       return showError("Price is required.");
    if (selectedFiles.length === 0) return showError("Please add at least one photo.");

    if (type === "rent") {
        const rpd  = document.getElementById("rentPricePerDay").value;
        const minD = document.getElementById("minRentDays").value;
        const maxD = document.getElementById("maxRentDays").value;
        const af   = document.getElementById("availableFrom").value;
        const at   = document.getElementById("availableTo").value;
        if (!rpd) return showError("Price per day is required for rent items.");
        if (maxD && Number(maxD) < Number(minD)) return showError("Max days cannot be less than min days.");
        if (af && at && new Date(at) < new Date(af)) return showError('"Available To" must be after "Available From".');
    }

    const formData = new FormData();
    formData.append("name",           title);
    formData.append("description",    description);
    formData.append("price",          price);
    formData.append("type",           type);
    formData.append("category",       category);
    formData.append("pickupLocation", pickupLocation);

    selectedFiles.forEach(file => formData.append("images", file));

    if (type === "rent") {
        formData.append("rentPricePerDay", document.getElementById("rentPricePerDay").value);
        formData.append("minRentDays",     document.getElementById("minRentDays").value || 1);
        formData.append("maxRentDays",     document.getElementById("maxRentDays").value || "");
        formData.append("depositAmount",   document.getElementById("depositAmount").value || "");
        formData.append("availableFrom",   document.getElementById("availableFrom").value || "");
        formData.append("availableTo",     document.getElementById("availableTo").value || "");
        formData.append("rentConditions",  document.getElementById("rentConditions").value.trim());
    }

    btn.disabled = true;
    btn.textContent = "Uploading...";

    try {
        const res  = await apiFetch(`${API_BASE}/products/add`, { method: "POST", body: formData });
        const data = await res.json();

        if (res.ok) {
            message.innerHTML = "<p class='success'>✅ Item listed successfully! Redirecting...</p>";
            setTimeout(() => window.location.href = "../home/home.html", 1200);
        } else {
            showError(data.message || data.error);
        }
    } catch (err) {
        showError("Error adding item. Is the server running?");
    } finally {
        btn.disabled = false;
        btn.textContent = "List Item";
    }
}

function showError(msg) {
    document.getElementById("message").innerHTML = `<p class='error'>${msg}</p>`;
}

// ── Init ───────────────────────────────────────────
loadCategories();