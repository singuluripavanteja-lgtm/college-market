if (!getToken()) window.location.href = "../login/login.html";

async function saveProfile() {
    const userName = document.getElementById("userName").value.trim();
    const year     = document.getElementById("year").value;
    const branch   = document.getElementById("branch").value.trim();
    const phNo     = document.getElementById("phNo").value.trim();
    const message  = document.getElementById("message");
    const btn      = document.getElementById("saveBtn");

    message.innerHTML = "";

    if (!year || !branch) {
        message.innerHTML = "<p class='error'>Year and branch are required</p>";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        const res = await apiFetch(`${API_BASE}/auth/complete-profile`, {
            method: "PUT",
            body: JSON.stringify({ userName, year, branch, phNo })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            message.innerHTML = "<p class='success'>All set! Taking you to CollegeMart...</p>";
            setTimeout(() => window.location.href = "../home/home.html", 800);
        } else {
            message.innerHTML = `<p class='error'>${data.message}</p>`;
            btn.disabled = false;
            btn.textContent = "Start Using CollegeMart →";
        }
    } catch {
        message.innerHTML = "<p class='error'>Error. Is the server running?</p>";
        btn.disabled = false;
        btn.textContent = "Start Using CollegeMart →";
    }
}