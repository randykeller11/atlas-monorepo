const config = {
  API_URL:
    process.env.NODE_ENV === "development"
      ? "http://localhost:5001" // Local development
      : "https://nucoord-atlas-e99e7eee1cf6.herokuapp.com", // Production
};

export default config;
