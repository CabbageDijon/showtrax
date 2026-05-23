// js/app.js – Main application controller (PocketBase backend)
import {
  searchShows,
  getShow,
  getShowsByGenre,
  searchYouTubeTrailer,
} from "./api.js";

// Initialize PocketBase client (connects to same origin, nginx proxies /api/ -> pocketbase)
const pb = new PocketBase("/"); // base URL where API is served

/* ---------- App State ---------- */
let currentUser = pb.authStore.model; // PocketBase user object or null
let currentView = "dashboard";
let trackedShowCache = new Map(); // showId -> show object

/* ---------- DOM Ready ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // Views
  const views = {
    dashboard: document.getElementById("dashboard-view"),
    discover: document.getElementById("discover-view"),
    docs: document.getElementById("docs-view"),
  };

  // Nav buttons
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const view = e.currentTarget.dataset.view;
      switchView(view);
      document.getElementById("mobile-menu").classList.add("hidden");
    });
  });

  // Hamburger
  document.getElementById("hamburger-btn").addEventListener("click", () => {
    document.getElementById("mobile-menu").classList.toggle("hidden");
  });

  // User menu button
  document.getElementById("user-menu-btn").addEventListener("click", () => {
    if (currentUser) {
      openProfileModal();
    } else {
      openAuthModal();
    }
  });

  // Auth modal handlers
  document
    .getElementById("signin-form")
    .addEventListener("submit", handleSignIn);
  document
    .getElementById("signup-form")
    .addEventListener("submit", handleSignUp);
  document.getElementById("show-signup").addEventListener("click", () => {
    document.getElementById("signin-form").classList.add("hidden");
    document.getElementById("signup-form").classList.remove("hidden");
  });
  document.getElementById("show-signin").addEventListener("click", () => {
    document.getElementById("signup-form").classList.add("hidden");
    document.getElementById("signin-form").classList.remove("hidden");
  });
  document
    .getElementById("guest-login-btn")
    .addEventListener("click", loginAsGuest);

  // Profile modal
  document
    .getElementById("close-profile")
    .addEventListener("click", closeProfileModal);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("export-btn").addEventListener("click", exportBackup);

  // Show modal close
  document
    .getElementById("close-modal")
    .addEventListener("click", closeShowModal);

  // Search
  document
    .getElementById("search-btn")
    .addEventListener("click", performSearch);
  document.getElementById("search-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") performSearch();
  });

  // Listen for auth changes (e.g., on page refresh)
  pb.authStore.onChange((token, model) => {
    currentUser = model;
    if (!model) {
      // user logged out
      trackedShowCache.clear();
      closeProfileModal();
      closeShowModal();
      switchView("dashboard");
      openAuthModal();
    } else {
      // user logged in, refresh dashboard
      initApp();
    }
  });

  // Initial setup
  if (!currentUser) {
    openAuthModal();
  } else {
    initApp();
  }
});

/* ---------- View Switching ---------- */
function switchView(viewName) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const view = document.getElementById(`${viewName}-view`);
  if (view) view.classList.remove("hidden");
  currentView = viewName;

  document.querySelectorAll(".nav-btn, .mobile-nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  if (viewName === "dashboard") renderDashboard();
  if (viewName === "discover") {
    document.getElementById("search-results-grid").innerHTML = "";
    document.getElementById("search-status").textContent = "";
  }
}

/* ---------- Authentication ---------- */
function openAuthModal() {
  document.getElementById("auth-modal").classList.add("active");
}
function closeAuthModal() {
  document.getElementById("auth-modal").classList.remove("active");
}

async function handleSignIn(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value;
  try {
    await pb.collection("users").authWithPassword(username, password);
    // on successful auth, the authStore onChange will update currentUser and close modals
    closeAuthModal();
    form.reset();
  } catch (err) {
    alert("Login failed: " + (err.message || "Invalid credentials"));
  }
}

async function handleSignUp(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  try {
    await pb
      .collection("users")
      .create({ username, email, password, passwordConfirm: password });
    // auto-login after signup
    await pb.collection("users").authWithPassword(username, password);
    closeAuthModal();
    form.reset();
    initApp();
  } catch (err) {
    alert("Registration failed: " + err.message);
  }
}

async function loginAsGuest() {
  // Use anonymous auth if enabled in PocketBase, or create a guest account on the fly
  try {
    // Try anonymous authentication (if collection allows)
    await pb.collection("users").authWithPassword("guest", "guest");
  } catch {
    // If not, create a new guest user with random credentials
    const guestName = "guest_" + crypto.randomUUID().slice(0, 8);
    const guestPass = crypto.randomUUID();
    try {
      await pb.collection("users").create({
        username: guestName,
        password: guestPass,
        passwordConfirm: guestPass,
      });
      await pb.collection("users").authWithPassword(guestName, guestPass);
    } catch (err) {
      alert("Guest login unavailable. Please sign up.");
      return;
    }
  }
  closeAuthModal();
}

async function logout() {
  pb.authStore.clear();
  // onChange will handle the rest
}

/* ---------- Profile Modal & Export ---------- */
function openProfileModal() {
  const modal = document.getElementById("profile-modal");
  const infoDiv = document.getElementById("profile-info");
  if (currentUser) {
    infoDiv.innerHTML = `
      <p><strong>Username:</strong> ${currentUser.username}</p>
      <p><strong>Email:</strong> ${currentUser.email || "Not set"}</p>
    `;
  }
  modal.classList.add("active");
}
function closeProfileModal() {
  document.getElementById("profile-modal").classList.remove("active");
}

async function exportBackup() {
  if (!currentUser) return;
  try {
    // Fetch watchlist records for the current user
    const records = await pb.collection("watchlists").getFullList({
      filter: `user = "${currentUser.id}"`,
    });
    const backup = {
      user: {
        username: currentUser.username,
        email: currentUser.email,
      },
      watchlist: records.map((r) => r.showId),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tv-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Export failed: " + err.message);
  }
}

/* ---------- App Initialization ---------- */
function initApp() {
  if (!currentUser) return;
  switchView("dashboard");
  closeAuthModal();
  renderDashboard();
}

/* ---------- Dashboard Rendering ---------- */
async function renderDashboard() {
  if (!currentUser) return;
  const grid = document.getElementById("watchlist-grid");
  const emptyMsg = document.getElementById("empty-watchlist");
  const alertsContainer = document.getElementById("alerts-container");
  grid.innerHTML = "";
  alertsContainer.innerHTML = "";

  // Fetch watchlist from PocketBase
  let watchlistRecords;
  try {
    watchlistRecords = await pb.collection("watchlists").getFullList({
      filter: `user = "${currentUser.id}"`,
    });
  } catch (err) {
    grid.innerHTML = '<p class="text-red-400">Failed to load watchlist.</p>';
    return;
  }

  const showIds = watchlistRecords.map((r) => r.showId);

  if (showIds.length === 0) {
    emptyMsg.classList.remove("hidden");
    grid.classList.add("hidden");
  } else {
    emptyMsg.classList.add("hidden");
    grid.classList.remove("hidden");
    const showPromises = showIds.map((id) => getShow(id, "nextepisode"));
    const shows = await Promise.all(showPromises);
    shows.forEach((show) => {
      trackedShowCache.set(show.id, show);
      renderShowCard(show, grid, true);
    });

    // Check alerts (next 72 hours)
    const now = Date.now();
    const threeDays = 72 * 60 * 60 * 1000;
    let alerts = [];
    shows.forEach((show) => {
      const nextEp = show._embedded?.nextepisode;
      if (nextEp && nextEp.airstamp) {
        const airDate = new Date(nextEp.airstamp).getTime();
        if (airDate - now > 0 && airDate - now <= threeDays) {
          const hoursLeft = Math.floor((airDate - now) / 3600000);
          alerts.push(
            `<span class="font-semibold">${show.name}</span> airs in ${hoursLeft}h (${nextEp.name})`,
          );
        }
      }
    });
    if (alerts.length > 0) {
      alertsContainer.innerHTML = `<div class="bg-indigo-900/50 border border-indigo-400 rounded-lg p-4 flex items-start gap-3">
        <span class="text-2xl">⏰</span>
        <div><p class="font-bold text-indigo-200">Upcoming Episodes</p><ul class="list-disc list-inside text-sm">${alerts.map((a) => `<li>${a}</li>`).join("")}</ul></div>
      </div>`;
    }
  }

  loadRecommendations();
}

/* ---------- Render a single show card ---------- */
function renderShowCard(show, container, isTracked = false) {
  const card = document.createElement("div");
  card.className = "show-card";
  card.dataset.showId = show.id;
  card.innerHTML = `
    <img src="${show.image?.medium || "https://via.placeholder.com/210x295?text=No+Image"}" alt="${show.name}" loading="lazy">
    <div class="card-body">
      <h3 class="text-sm font-semibold leading-tight line-clamp-2">${show.name}</h3>
      <div class="flex items-center justify-between mt-2">
        <span class="text-xs px-2 py-0.5 rounded-full ${getStatusClass(show)}">${getStatusLabel(show)}</span>
        ${isTracked ? '<span class="text-xs text-green-400">✓ Tracked</span>' : ""}
      </div>
    </div>`;
  card.addEventListener("click", () => openShowModal(show.id));
  container.appendChild(card);
}

/* ---------- Status helpers ---------- */
function getStatusLabel(show) {
  if (show.status === "Running") {
    if (show._embedded?.nextepisode) return "Live / Airing";
    return "Off-Season / Returning";
  }
  return show.status;
}
function getStatusClass(show) {
  if (show.status === "Running" && show._embedded?.nextepisode)
    return "bg-green-700 text-green-100";
  if (show.status === "Running") return "bg-yellow-700 text-yellow-100";
  return "bg-slate-600 text-slate-200";
}

/* ---------- Show Modal (Bottom Sheet / Lightbox) ---------- */
async function openShowModal(showId) {
  const modal = document.getElementById("show-modal");
  const body = document.getElementById("modal-body");
  body.innerHTML =
    '<div class="text-center py-10"><div class="animate-spin w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full mx-auto"></div></div>';
  modal.classList.add("active");

  let show;
  try {
    show = await getShow(showId, "nextepisode");
    trackedShowCache.set(showId, show);
  } catch (e) {
    body.innerHTML = '<p class="text-red-400">Failed to load show details.</p>';
    return;
  }

  // Determine if already tracked
  let isTracked = false;
  try {
    const existing = await pb
      .collection("watchlists")
      .getFirstListItem(`user="${currentUser.id}" && showId=${showId}`);
    isTracked = !!existing;
  } catch (e) {
    /* not tracked */
  }

  const variantsPromise = discoverSpinOffs(show.name, showId);
  const youtubePromise = searchYouTubeTrailer(show.name);

  body.innerHTML = `
    <div class="flex flex-col md:flex-row gap-4">
      <img src="${show.image?.original || show.image?.medium || ""}" class="w-32 h-auto rounded-lg self-start" alt="">
      <div class="flex-1">
        <h2 class="text-xl font-bold">${show.name}</h2>
        <div class="flex flex-wrap gap-2 mt-2">
          <span class="text-xs px-2 py-0.5 rounded-full ${getStatusClass(show)}">${getStatusLabel(show)}</span>
          ${show.genres?.map((g) => `<span class="text-xs bg-slate-600 px-2 py-0.5 rounded-full">${g}</span>`).join("") || ""}
        </div>
        <div class="text-sm text-slate-300 mt-2" id="show-summary">${show.summary || "No description."}</div>
        <button id="track-toggle-btn" class="mt-3 px-4 py-2 rounded-lg text-sm font-medium ${isTracked ? "bg-red-700 hover:bg-red-800" : "bg-indigo-600 hover:bg-indigo-700"}">${isTracked ? "Remove from Watchlist" : "Add to Watchlist"}</button>
      </div>
    </div>
    <div id="modal-variants" class="mt-6"><p class="text-sm text-slate-400">Loading spin‑offs…</p></div>
    <div id="modal-media" class="mt-6"><p class="text-sm text-slate-400">Searching for trailer…</p></div>
  `;

  document
    .getElementById("track-toggle-btn")
    .addEventListener("click", async () => {
      await toggleTrackShow(showId);
      // Re-render modal
      openShowModal(showId);
    });

  const variants = await variantsPromise;
  const variantsDiv = document.getElementById("modal-variants");
  if (variants.length > 0) {
    variantsDiv.innerHTML = `
      <h3 class="font-semibold mb-2">🌍 Spin‑offs & Variants</h3>
      <div class="flex flex-wrap gap-2" id="variants-list">
        ${variants.map((s) => `<button data-variant-id="${s.id}" class="variant-link bg-slate-700 px-3 py-1 rounded-full text-sm hover:bg-slate-600 transition">${s.name}</button>`).join("")}
      </div>`;
    variantsDiv.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-variant-id]");
      if (btn) {
        const variantId = parseInt(btn.dataset.variantId, 10);
        if (!isNaN(variantId)) openShowModal(variantId);
      }
    });
  } else {
    variantsDiv.innerHTML =
      '<p class="text-sm text-slate-500">No spin‑offs found.</p>';
  }

  const embedUrl = await youtubePromise;
  const mediaDiv = document.getElementById("modal-media");
  if (embedUrl) {
    mediaDiv.innerHTML = `
      <h3 class="font-semibold mb-2">🎬 Trailer</h3>
      <div class="aspect-video">
        <iframe src="${embedUrl}" class="w-full h-full rounded-lg" allowfullscreen allow="autoplay"></iframe>
      </div>`;
  } else {
    mediaDiv.innerHTML =
      '<p class="text-sm text-slate-500">No trailer found.</p>';
  }
}

function closeShowModal() {
  document.getElementById("show-modal").classList.remove("active");
  document.getElementById("modal-body").innerHTML = "";
}

/* ---------- Watchlist Toggle (PocketBase) ---------- */
async function toggleTrackShow(showId) {
  try {
    const existing = await pb
      .collection("watchlists")
      .getFirstListItem(`user="${currentUser.id}" && showId=${showId}`);
    // Remove
    await pb.collection("watchlists").delete(existing.id);
  } catch {
    // Add
    await pb.collection("watchlists").create({
      user: currentUser.id,
      showId: showId,
    });
  }
  if (currentView === "dashboard") renderDashboard();
}

/* ---------- Spin‑off Scanner ---------- */
async function discoverSpinOffs(title, excludeId) {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "of",
    "and",
    "in",
    "on",
    "to",
    "for",
    "is",
    "at",
  ]);
  const words = title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => !stopWords.has(w));
  if (words.length === 0) return [];
  const root = words.join(" ").trim();
  try {
    const results = await searchShows(root);
    return results.filter((s) => s.id !== excludeId).slice(0, 10);
  } catch {
    return [];
  }
}

/* ---------- Recommendations Engine ---------- */
async function loadRecommendations() {
  if (!currentUser) return;
  const container = document.getElementById("recommendations-scroll");
  const loadingEl = document.getElementById("rec-loading");
  container.innerHTML = "";

  let watchlistRecords;
  try {
    watchlistRecords = await pb
      .collection("watchlists")
      .getFullList({ filter: `user="${currentUser.id}"` });
  } catch {
    return;
  }

  const showIds = watchlistRecords.map((r) => r.showId);
  if (showIds.length === 0) {
    loadingEl.textContent = "Add shows to get recommendations.";
    return;
  }
  loadingEl.classList.remove("hidden");

  const genreCount = new Map();
  for (const id of showIds) {
    let show = trackedShowCache.get(id);
    if (!show) {
      try {
        show = await getShow(id);
        trackedShowCache.set(id, show);
      } catch {
        continue;
      }
    }
    if (show.genres) {
      show.genres.forEach((g) =>
        genreCount.set(g, (genreCount.get(g) || 0) + 1),
      );
    }
  }

  const sortedGenres = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map((e) => e[0]);
  if (sortedGenres.length === 0) {
    loadingEl.textContent = "Not enough genre data.";
    return;
  }

  let candidates = [];
  for (const genre of sortedGenres) {
    try {
      const shows = await getShowsByGenre(genre);
      candidates.push(...shows);
    } catch {}
  }

  const trackedIds = new Set(showIds);
  const uniqueCandidates = [];
  const seen = new Set();
  for (const s of candidates) {
    if (!seen.has(s.id) && !trackedIds.has(s.id)) {
      seen.add(s.id);
      uniqueCandidates.push(s);
    }
  }

  const shuffled = uniqueCandidates.sort(() => Math.random() - 0.5).slice(0, 8);
  if (shuffled.length === 0) {
    loadingEl.textContent = "No new recommendations found.";
  } else {
    loadingEl.classList.add("hidden");
    shuffled.forEach((show) => renderSmallRecCard(show, container));
  }
}

function renderSmallRecCard(show, container) {
  const card = document.createElement("div");
  card.className = "show-card snap-start flex-shrink-0 w-40 md:w-48";
  card.dataset.showId = show.id;
  card.innerHTML = `
    <img src="${show.image?.medium || "https://via.placeholder.com/210x295?text=No+Image"}" alt="${show.name}" loading="lazy">
    <div class="card-body">
      <h3 class="text-xs font-semibold line-clamp-2">${show.name}</h3>
    </div>`;
  card.addEventListener("click", () => openShowModal(show.id));
  container.appendChild(card);
}

/* ---------- Search ---------- */
async function performSearch() {
  const query = document.getElementById("search-input").value.trim();
  const grid = document.getElementById("search-results-grid");
  const status = document.getElementById("search-status");
  if (!query) return;
  grid.innerHTML = "";
  status.textContent = "Searching...";
  try {
    const shows = await searchShows(query);
    if (shows.length === 0) {
      status.textContent = "No results found.";
    } else {
      status.textContent = "";
      shows.forEach((show) => renderShowCard(show, grid, false));
    }
  } catch (e) {
    status.textContent = "Search failed. Please try again.";
  }
}
