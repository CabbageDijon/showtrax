// ---------- Initialize Appwrite ----------
const client = new Appwrite.Client()
    .setEndpoint('https://appwrite.showtrax.duckdns.org/v1')
    .setProject('6a1379e5000fa6ee80fd'); // Replace with your actual project ID

const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);

// ---------- Database & Collection ----------
const DB_ID = 'showtrax';
const WATCHLIST_COLLECTION = '6a137bfe000e58d6854f'; // Use your actual watchlist collection ID

// ---------- Auth State ----------
let currentUser = null;

// On page load
(async function init() {
    try {
        currentUser = await account.get();
        console.log('Already logged in as', currentUser.email);
        showApp();
    } catch (err) {
        showAuth();
    }
})();

// ---------- UI Helpers ----------
function showAuth() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('appSection').style.display = 'none';
}

function showApp() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('appSection').style.display = 'block';
    loadWatchlist();
    loadUsername(); // Show username from prefs
}

// ---------- Auth Functions ----------

async function handleSignUp(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const username = document.getElementById('signupUsername').value.trim();

    if (!email || !password || !username) {
        alert('Please fill in all fields.');
        return;
    }

    try {
        // 1. Create the account
        const user = await account.create('unique()', email, password);
        // 2. Save the username in user preferences (prefs)
        await account.updatePrefs({ username: username });
        // 3. Automatically log in
        await account.createEmailPasswordSession(email, password);
        currentUser = await account.get();
        showApp();
    } catch (err) {
        console.error('Sign up failed:', err);
        alert(err.message);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        alert('Please enter email and password.');
        return;
    }

    try {
        await account.createEmailPasswordSession(email, password);
        currentUser = await account.get();
        showApp();
    } catch (err) {
        console.error('Login failed:', err);
        alert(err.message);
    }
}

async function handleLogout() {
    try {
        await account.deleteSession('current');
        currentUser = null;
        showAuth();
    } catch (err) {
        console.error('Logout error:', err);
    }
}

// ---------- Username Display (from prefs) ----------
async function loadUsername() {
    if (!currentUser) return;
    try {
        const prefs = await account.getPrefs();
        const username = prefs.username || currentUser.email;
        document.getElementById('usernameDisplay').textContent = username;
    } catch (err) {
        console.error('Could not load username:', err);
    }
}

// ---------- Watchlist Functions ----------

async function loadWatchlist() {
    if (!currentUser) return;
    try {
        const response = await databases.listDocuments(
            DB_ID,
            WATCHLIST_COLLECTION,
            [Appwrite.Query.equal('user_id', currentUser.$id)]
        );
        renderWatchlist(response.documents);
    } catch (err) {
        console.error('Failed to load watchlist:', err);
    }
}

function renderWatchlist(watchlist) {
    const container = document.getElementById('watchlist');
    container.innerHTML = '';
    if (watchlist.length === 0) {
        container.innerHTML = '<p>Your watchlist is empty.</p>';
        return;
    }
    watchlist.forEach(item => {
        const div = document.createElement('div');
        div.className = 'watchlist-item';
        div.innerHTML = `
            <span>Show ID: ${item.showId}</span>
            <button onclick="removeFromWatchlist('${item.$id}')">Remove</button>
        `;
        container.appendChild(div);
    });
}

async function addToWatchlist(showId) {
    if (!currentUser) {
        alert('You must be logged in.');
        return;
    }
    try {
        await databases.createDocument(DB_ID, WATCHLIST_COLLECTION, 'unique()', {
            showId: parseInt(showId),
            user_id: currentUser.$id
        });
        loadWatchlist();
    } catch (err) {
        console.error('Failed to add:', err);
        alert(err.message);
    }
}

async function removeFromWatchlist(documentId) {
    try {
        await databases.deleteDocument(DB_ID, WATCHLIST_COLLECTION, documentId);
        loadWatchlist();
    } catch (err) {
        console.error('Failed to remove:', err);
        alert(err.message);
    }
}
