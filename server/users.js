// Static user configuration for development
// TODO: Replace with proper authentication system in production

export const users = [
  {
    username: "randy",
    password: "!1Stocksaretight",
    role: "admin",
    permissions: ["debug", "admin", "templates"]
  },
  {
    username: "ramallah",
    password: "NucoordAtlas",
    role: "admin", 
    permissions: ["debug", "admin", "templates"]
  },
  {
    username: "keyna",
    password: "NucoordAtlas",
    role: "user",
    permissions: ["basic"]
  },
];

// Helper function to get user by username
export function getUserByUsername(username) {
  return users.find(user => user.username === username);
}

// Helper function to validate user credentials
export function validateUser(username, password) {
  const user = getUserByUsername(username);
  return user && user.password === password ? user : null;
}

// Helper function to check user permissions
export function hasPermission(user, permission) {
  return user && user.permissions && user.permissions.includes(permission);
}

// Helper function to check if user is admin
export function isAdmin(user) {
  return user && user.role === 'admin';
}
