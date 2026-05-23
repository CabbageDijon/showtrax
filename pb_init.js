// Run this in your browser console while the app is open
// (or via PocketBase Admin UI at /pb_admin/)
const pb = new PocketBase("http://your-vps-ip:8090"); // or localhost if port forwarded

// Authenticate as admin (first create an admin via PocketBase CLI or Docker env)
// admin credentials are created the first time you run PocketBase.
// Check container logs for the auto-generated password.
await pb.admins.authWithPassword("admin@example.com", "your-admin-password");

// Create watchlists collection
try {
  const collection = await pb.collections.create({
    name: "watchlists",
    type: "base",
    schema: [
      {
        name: "user",
        type: "relation",
        required: true,
        options: { collectionId: "_pb_users_auth_", cascadeDelete: true },
      },
      { name: "showId", type: "number", required: true },
    ],
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: '@request.auth.id != ""',
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
  });
  console.log("Collection created:", collection);
} catch (e) {
  console.error("Collection may already exist:", e);
}
