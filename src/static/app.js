document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userMenuBtn = document.getElementById("user-menu-btn");
  const manageHint = document.getElementById("manage-hint");
  const loginModal = document.getElementById("login-modal");
  const closeLoginBtn = document.getElementById("close-login-btn");
  const loginForm = document.getElementById("login-form");

  const authState = {
    token: localStorage.getItem("authToken"),
    user: null,
  };

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function canManageRegistrations() {
    if (!authState.user) {
      return false;
    }

    return ["club_officer", "admin", "teacher"].includes(authState.user.role);
  }

  function getAuthHeaders() {
    if (!authState.token) {
      return {};
    }

    return {
      Authorization: `Bearer ${authState.token}`,
    };
  }

  function setAuthState(token, user) {
    authState.token = token;
    authState.user = user;

    if (token) {
      localStorage.setItem("authToken", token);
    } else {
      localStorage.removeItem("authToken");
    }

    updateAuthUI();
  }

  function updateAuthUI() {
    if (authState.user) {
      authStatus.textContent = `Signed in as ${authState.user.username} (${authState.user.role})`;
      loginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");

      if (canManageRegistrations()) {
        manageHint.textContent = "You can manage student registrations.";
        manageHint.className = "success-block";
      } else {
        manageHint.textContent = "You are signed in without staff permissions. Registration management is disabled.";
        manageHint.className = "info-block";
      }
    } else {
      authStatus.textContent = "Viewing as guest";
      loginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      manageHint.textContent = "Staff login is required to register or unregister students.";
      manageHint.className = "info-block";
    }

    signupForm.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !canManageRegistrations();
    });
  }

  async function restoreSession() {
    if (!authState.token) {
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setAuthState(null, null);
        return;
      }

      const result = await response.json();
      setAuthState(authState.token, result.user);
    } catch (error) {
      setAuthState(null, null);
      console.error("Error restoring session:", error);
    }
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        canManageRegistrations()
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      if (canManageRegistrations()) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!canManageRegistrations()) {
      showMessage("Only staff can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!canManageRegistrations()) {
      showMessage("Only staff can register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginBtn.addEventListener("click", openLoginModal);
  userMenuBtn.addEventListener("click", openLoginModal);
  closeLoginBtn.addEventListener("click", closeLoginModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      setAuthState(result.token, result.user);
      closeLoginModal();
      showMessage(result.message, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Failed to sign in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      if (authState.token) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: getAuthHeaders(),
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }

    setAuthState(null, null);
    showMessage("Signed out", "success");
    fetchActivities();
  });

  // Initialize app
  restoreSession();
  fetchActivities();
});
