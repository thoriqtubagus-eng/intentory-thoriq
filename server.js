import "dotenv/config";
import express from "express";
import handler from "./api/index.js";

const app = express();
app.use(express.json());

app.all("/api/{*path}", async (req, res) => {
  await handler(req, res);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
