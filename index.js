import "dotenv/config";
import cors from "cors";
import express from "express";

import authRoutes from "./src/routes/auth.js";
import deviceTypeRoutes from "./src/routes/deviceType.js";
import stationRoutes from "./src/routes/station.js";

const app = express();

app.use(express.json());

app.use(
	cors({
		origin: "http://localhost:3000",
		credentials: true,
	}),
);

app.get("/", (req, res) => {
	res.send("hello Express");
});

app.use("/auth", authRoutes);
app.use("/device-type", deviceTypeRoutes);
app.use("/station", stationRoutes);

app.listen(3001, () => {
	console.log("server is running on 3001");
});
