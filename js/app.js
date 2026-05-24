// Initialize Appwrite
const client = new Appwrite.Client()
    .setEndpoint('https://appwrite.showtrax.duckdns.org/v1')
    .setProject('YOUR_PROJECT_ID');
const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);

const DB_ID = 'showtrax';
const USERS_COLLECTION_ID = 'usernames';  // Copy exact ID from Appwrite console

// Sign in anonymously (call this on button click)
async function signInAnonymously() {
    try {
        await account.createAnonymousSession();
        // Successfully signed in – now check if they already have a username
        const user = await account.get();
        const userId = user.$id;

        // Try to fetch their existing username document
        let doc;
        try {
            doc = await databases.getDocument(DB_ID, USERS_COLLECTION_ID, userId);
        } catch (e) {
            doc = null; // no doc yet
        }

        if (doc) {
            alert(`Welcome back, ${doc.username}!`);
            window.location.href = '/dashboard.html'; // or wherever
        } else {
            // New user – show username prompt
            showUsernameForm(userId);
        }
    } catch (err) {
        console.error('Anonymous sign-in failed:', err);
        alert('Error signing in. Please try again.');
    }
}

// Show a simple modal/prompt for username
function showUsernameForm(userId) {
    const username = prompt('Please choose a username:');
    if (!username) return;

    // Save the username in the database, using the user ID as document ID
    databases.createDocument(DB_ID, USERS_COLLECTION_ID, userId, {
        username: username,
        user_id: userId
    }).then(() => {
        alert(`Welcome, ${username}!`);
        window.location.href = '/dashboard.html';
    }).catch(err => {
        console.error(err);
        alert('Username might already be taken. Try another.');
    });
}
