require("dotenv").config();

const app = require("./app");

// Railway/Render/Heroku will inject PORT; fall back for local dev
const PORT = process.env.PORT || 3001;

// Start HTTP server
app.listen(PORT, () => {
  console.log(`📞 Server listening on port ${PORT}`);
});
