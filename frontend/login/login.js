// Already logged in? Go home
if (getToken()) window.location.href = "../home/home.html";

async function handleGoogleLogin(response) {
    const message = document.getElementById("message");

    // Decode the JWT payload from Google (no library needed)
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const email = payload.email || "";

    if (!email.endsWith("@student.nitandhra.ac.in")) {
        message.innerHTML = `<p class='error'>❌ Only <strong>@student.nitandhra.ac.in</strong> accounts are allowed.<br>
            <small style="color:#aaa;">You signed in as: ${email}</small></p>`;
        // Also trigger Google sign-out so they can switch accounts
        google.accounts.id.disableAutoSelect();
        return;
    }

    message.innerHTML = "<p class='loading'>Signing in...</p>";

    try {
        const res = await fetch(`${API_BASE}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();

        if (!res.ok) {
            message.innerHTML = `<p class='error'>${data.message}</p>`;
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        if (data.needsProfileSetup) {
            window.location.href = "../register/completeProfile.html";
        } else {
            message.innerHTML = "<p class='success'>Welcome back! Redirecting...</p>";
            setTimeout(() => window.location.href = "../home/home.html", 600);
        }

    } catch (err) {
        message.innerHTML = "<p class='error'>Sign-in failed. Please try again.</p>";
    }
}