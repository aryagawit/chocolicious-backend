const mysql = require("mysql2/promise");
require("dotenv").config();

// Optional SSL configuration to support MySQL servers that require TLS.
// - Set `DB_SSL=true` to enable SSL handling.
// - Optionally provide `DB_CA` (PEM) to validate the server certificate.
const sslEnabled = process.env.DB_SSL === "true";
let ssl;
if (sslEnabled) {
  if (process.env.DB_CA) {
    ssl = { ca: process.env.DB_CA };
  } else {
    // If no CA is provided, allow insecure connections by disabling
    // certificate validation. This avoids the "unable to get local issuer certificate"
    // error in environments where the CA chain isn't available. Prefer providing
    // a CA in production for security.
    ssl = { rejectUnauthorized: false };
  }
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ...(ssl ? { ssl } : {}),
});

module.exports = db;
