/*********************************************
 * app.js – ShowTrax (Appwrite version)
 *********************************************/

// ---------- Initialize Appwrite ----------
const client = new Appwrite.Client()
    .setEndpoint('https://appwrite.showtrax.duckdns.org/v1')   // your Appwrite endpoint
    .setProject('YOUR_PROJECT_ID');                           // replace with your project ID

const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);

// ---------- Database & Collection IDs ----------
const DB_ID = 'showtrax';
const WATCHLIST_COLLECTION = 'watchlists';   // replace with exact collection ID from Appwrite
const USERNAME_COLLECTION = 'usernames';    // replace with exact collection ID

// ---------- Auth State ----------
let currentUser = null;

// On page load, check if a session exists
(async function init() {
    try {
        currentUser = await account.get();
        console.log('Already logged in as', currentUser.email);
        // Show dashboard / watchlist etc.
        showApp();
    } catch (err) {
        // Not logged in – show auth forms
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
}

// ---------- Auth Functions ----------

// Sign Up (email + password + username)
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
        // 1. Create Appwrite account
        const user = await account.create('unique()', email, password);

        // 2. Store the username in a separate collection (document ID = user ID)
        await databases.createDocument(DB_ID, USERNAME_COLLECTION, user.$id, {
            user_id: user.$id,
            username: username
        });

        // 3. Log the user in immediately
        await account.createEmailPasswordSession(email, password);
        currentUser = user;
        showApp();
    } catch (err) {
        console.error('Sign up failed:', err);
        alert(err.message);
    }
}

// Login
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

// Logout
async function handleLogout() {
    try {
        await account.deleteSession('current');
        currentUser = null;
        showAuth();
    } catch (err) {
        console.error('Logout error:', err);
    }
}

// ---------- Watchlist Functions ----------

// Load the current user’s watchlist
async function loadWatchlist() {
    if (!currentUser) return;

    try {
        const response = await databases.listDocuments(
            DB_ID,
            WATCHLIST_COLLECTION,
            [Appwrite.Query.equal('user_id', currentUser.$id)]
        );
        const watchlist = response.documents;
        renderWatchlist(watchlist);
    } catch (err) {
        console.error('Failed to load watchlist:', err);
    }
}

// Render watchlist items to the DOM
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

// Add a show to watchlist
async function addToWatchlist(showId) {
    if (!currentUser) {
        alert('You must be logged in.');
        return;
    }

    try {
        await databases.createDocument(DB_ID, WATCHLIST_COLLECTION, 'unique()', {
            showId: parseInt(showId),   // ensure integer
            user_id: currentUser.$id
        });
        loadWatchlist();
    } catch (err) {
        console.error('Failed to add:', err);
        alert(err.message);
    }
}

// Remove a show from watchlist
async function removeFromWatchlist(documentId) {
    try {
        // Optional: check ownership (here we just trust the user, but document security helps)
        await databases.deleteDocument(DB_ID, WATCHLIST_COLLECTION, documentId);
        loadWatchlist();
    } catch (err) {
        console.error('Failed to remove:', err);
        alert(err.message);
    }
}
