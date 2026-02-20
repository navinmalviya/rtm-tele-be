import "dotenv/config";
import cors from "cors";
import express from "express";

import authRoutes from "./src/routes/auth-routes.js";
import cableRoutes from "./src/routes/cable-routes.js";
import equipmentRoutes from "./src/routes/equipment-routes.js";
import equipmentTemplateRoutes from "./src/routes/equipment-template-routes.js";
import locationRoutes from "./src/routes/location-routes.js";
import portLinkRoutes from "./src/routes/port-link-routes.js";
import portRoutes from "./src/routes/port-routes.js";
import portTemplateRoutes from "./src/routes/port-template-routes.js";
import projectRoutes from "./src/routes/project-routes.js";
import rackRoutes from "./src/routes/rack-routes.js";
import stationRoutes from "./src/routes/station-routes.js";
import subSectionroutes from "./src/routes/sub-section-routes.js";
import taskRoutes from "./src/routes/task-routes.js";
import userRoutes from "./src/routes/user-routes.js";
import maintenanceScheduleRoutes from "./src/routes/maintenance-schedule-routes.js";
import cron from "node-cron";
import { runMaintenanceRemindersJob } from "./src/lib/maintenance-runner.js";

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
app.use("/subsection", subSectionroutes);
app.use("/equipment-template", equipmentTemplateRoutes);
app.use("/port-template", portTemplateRoutes);
app.use("/port-link", portLinkRoutes);
app.use("/project", projectRoutes);
app.use("/task", taskRoutes);
app.use("/user", userRoutes);
app.use("/cable", cableRoutes);
app.use("/maintenance", maintenanceScheduleRoutes);

if (process.env.ENABLE_SCHEDULER !== "false") {
	cron.schedule(
		"30 0 * * *",
		async () => {
			try {
				const result = await runMaintenanceRemindersJob(new Date());
				console.log("[maintenance] reminders ran:", result);
			} catch (error) {
				console.error("[maintenance] reminders failed:", error.message);
			}
		},
		{ timezone: process.env.SCHEDULER_TZ || "Asia/Kolkata" },
	);
}

app.listen(3001, () => {
	console.log("server is running on 3001");
});
