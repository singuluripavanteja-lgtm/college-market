document.getElementById("registerBtn").addEventListener("click", register);

async function register() {
    const userName = document.getElementById("userName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const year = document.getElementById("year").value;
    const branch = document.getElementById("branch").value.trim();
    const phNo = document.getElementById("phNo").value.trim();

    const message = document.getElementById("message");
    const btn = document.getElementById("registerBtn");
    message.innerHTML = "";

    if (!userName || !email || !password || !year || !branch || !phNo) {
        message.innerHTML = "<p class='error'>All fields are required</p>";
        return;
    }

    if (password.length < 4) {
        message.innerHTML = "<p class='error'>Password must be at least 6 characters</p>";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Registering...";

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, email, password, year, branch, phNo })
        });

        const data = await response.json();

        if (response.ok) {
            message.innerHTML = "<p class='success'>Registration Successful! Redirecting to login...</p>";
            setTimeout(() => {
                window.location.href = "../login/login.html";
            }, 1000);
        } else {
            message.innerHTML = `<p class='error'>${data.message}</p>`;
        }

    } catch (error) {
        message.innerHTML = "<p class='error'>Could not reach server. Is it running?</p>";
    } finally {
        btn.disabled = false;
        btn.textContent = "Register";
    }
}