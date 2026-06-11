import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import sendRoutes from "./routes/send.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "channel", ts: new Date().toISOString() });
});

app.use("/send", sendRoutes);

app.listen(env.PORT, () => {
  console.log(`[channel] listening on :${env.PORT}`);
});
