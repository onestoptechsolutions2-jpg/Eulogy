// Local development only. On Vercel, `api/index.js` is invoked directly as
// a serverless function and this file is never run.
import "dotenv/config";
import app from "./api/index.js";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`In Memory (standalone) — local dev on http://localhost:${PORT}`));
