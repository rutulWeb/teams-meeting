const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const meetingRoutes = require("./routes/meetingRoutes");
const { ApiError } = require("./services/meetingService");

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", meetingRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.use((error, req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      message: "Invalid JSON request body",
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
  }

  return res.status(500).json({
    message: "Unexpected server error",
    details: error?.message,
  });
});

app.listen(port, () => {
  console.log(`Teams meeting app listening on http://localhost:${port}`);
});
