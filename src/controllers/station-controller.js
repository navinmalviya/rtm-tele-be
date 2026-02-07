import prisma from "../lib/prisma";

// 1. CREATE Station (Auto-attach Division)
const createStation = async (req, res) => {
	const { code, name, mapX, mapY } = req.body;

	// Values extracted from the Token via the Middleware
	const userId = req.user.id;
	const divisionId = req.user.divisionId;

	try {
		const station = await prisma.station.create({
			data: {
				code,
				name,
				divisionId,
				createdById: userId,
				mapX: parseFloat(mapX || 0),
				mapY: parseFloat(mapY || 0),
			},
		});
		res.status(201).json({ message: "Station created!", station });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 2. GET ALL Stations (Filtered by Division)
const findAllStations = async (req, res) => {
	const { divisionId, role } = req.user;

	try {
		const queryOptions = {
			where: {},
			include: {
				createdBy: {
					select: { name: true },
				},
				// FIX: Changed from 'subsection' to 'subsections' to match schema back-relations
				subsections: true,
				// Optional: You might also want to include these for the dashboard
				_count: {
					select: {
						locations: true,
						equipments: true,
						failures: true,
					},
				},
			},
		};

		// If not SUPER_ADMIN, strictly filter by user's divisionId
		if (role !== "SUPER_ADMIN") {
			queryOptions.where.divisionId = divisionId;
		}

		const stations = await prisma.station.findMany(queryOptions);
		res.status(200).json(stations);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 3. UPDATE Station (Used when dragging on the map)
const updateStation = async (req, res) => {
	const { id } = req.params;
	const { divisionId, role } = req.user;
	const data = req.body;

	try {
		// Find existing to check ownership/division
		const existing = await prisma.station.findUnique({ where: { id } });

		if (!existing)
			return res.status(404).json({ message: "Station not found" });
		if (role !== "SUPER_ADMIN" && existing.divisionId !== divisionId) {
			return res
				.status(403)
				.json({ message: "Unauthorized to update this division's data" });
		}

		const updatedStation = await prisma.station.update({
			where: { id },
			data: {
				...data,
				mapX: data.mapX !== undefined ? parseFloat(data.mapX) : undefined,
				mapY: data.mapY !== undefined ? parseFloat(data.mapY) : undefined,
			},
		});
		res.status(200).json({ message: "Station updated!", updatedStation });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 4. DELETE Station
const deleteStation = async (req, res) => {
	const { id } = req.params;
	const { divisionId, role } = req.user;

	try {
		const station = await prisma.station.findUnique({ where: { id } });

		if (role !== "SUPER_ADMIN" && station.divisionId !== divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		await prisma.station.delete({ where: { id } });
		res.status(200).json({ message: "Station deleted successfully!" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 5. BULK UPDATE (For React Flow dragging)
const bulkUpdateStations = async (req, res) => {
	const { stations } = req.body;
	const { divisionId, role } = req.user;

	if (!Array.isArray(stations) || stations.length === 0) {
		return res.status(400).json({ message: "No data provided." });
	}

	try {
		const updateOperations = stations.map((st) =>
			prisma.station.updateMany({
				// updateMany allows us to add the divisionId safety check
				where: {
					id: st.id,
					divisionId: role === "SUPER_ADMIN" ? undefined : divisionId,
				},
				data: {
					mapX: parseFloat(st.mapX),
					mapY: parseFloat(st.mapY),
				},
			}),
		);

		await prisma.$transaction(updateOperations);
		res.status(200).json({ message: "Layout saved successfully!" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 6. INTERNAL TOPOLOGY (Rack/Equipment view)
const getStationInternalTopology = async (req, res) => {
	try {
		const { id } = req.params;
		const { divisionId, role } = req.user;

		const topology = await prisma.station.findFirst({
			where: {
				id,
				divisionId: role === "SUPER_ADMIN" ? undefined : divisionId,
			},
			include: {
				locations: {
					include: {
						racks: {
							include: {
								equipments: {
									include: {
										ports: {
											include: {
												linksAsSource: true,
												linksAsTarget: true,
											},
										},
									},
								},
							},
						},
					},
				},
				equipments: {
					where: { rackId: null },
					include: { ports: true },
				},
			},
		});

		if (!topology)
			return res
				.status(404)
				.json({ error: "Station not found or unauthorized" });
		res.status(200).json(topology);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 7. SUMMARY
const getStationSummary = async (req, res) => {
	try {
		const { id } = req.params;
		const { divisionId, role } = req.user;

		const summary = await prisma.station.findFirst({
			where: {
				id,
				divisionId: role === "SUPER_ADMIN" ? undefined : divisionId,
			},
			select: {
				name: true,
				code: true,
				subsection: { select: { name: true } },
				_count: {
					select: {
						locations: true,
						equipments: true,
					},
				},
			},
		});

		if (!summary) return res.status(404).json({ error: "Station not found" });

		const rackCount = await prisma.rack.count({
			where: { location: { stationId: id } },
		});

		res.status(200).json({
			...summary,
			totalLocations: summary._count.locations,
			totalRacks: rackCount,
			totalDevices: summary._count.equipments,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export {
	createStation,
	findAllStations,
	updateStation,
	deleteStation,
	bulkUpdateStations,
	getStationInternalTopology,
	getStationSummary,
};
