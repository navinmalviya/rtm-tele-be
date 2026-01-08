import "dotenv/config";
import cors from "cors";
import express from "express";

import authRoutes from "./src/routes/auth-routes.js";
import equipmentRoutes from "./src/routes/equipment-routes.js";
import locationRoutes from "./src/routes/location-routes.js";
import portRoutes from "./src/routes/port-routes.js";
import rackRoutes from "./src/routes/rack-routes.js";
import stationRoutes from "./src/routes/station-routes.js";

const app = express();

app.use(express.json());

app.use(
	cors({
		origin: "http://localhost:3000",
		credentials: true,
	}),
);

// app.get("/", (req, res) => {
// 	res.send("hello Express");
// });

app.use("/auth", authRoutes);
app.use("/station", stationRoutes);
app.use("/location", locationRoutes);
app.use("/rack", rackRoutes);
app.use("/equipment", equipmentRoutes);
app.use("/port", portRoutes);

app.listen(3001, () => {
	console.log("server is running on 3001");
});
