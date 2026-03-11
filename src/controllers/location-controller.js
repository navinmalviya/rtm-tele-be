import prisma from "../lib/prisma.js";

const SUPERVISOR_ROLES = [
	"JE_SSE_TELE_SECTIONAL",
	"SSE_TELE_INCHARGE",
	"SSE_SNT_OFFICE",
	"SSE_TECH",
];

const getDivisionScopedStation = async ({ stationId, divisionId, role }) => {
	return prisma.station.findFirst({
		where: {
			id: stationId,
			...(role === "SUPER_ADMIN" ? {} : { divisionId }),
		},
		select: {
			id: true,
			divisionId: true,
			supervisorId: true,
		},
	});
};

const validateSupervisor = async ({ supervisorId, divisionId, role }) => {
	const supervisor = await prisma.user.findFirst({
		where: {
			id: supervisorId,
			role: { in: SUPERVISOR_ROLES },
			...(role === "SUPER_ADMIN" ? {} : { divisionId }),
		},
		select: { id: true },
	});

	return Boolean(supervisor);
};

const getDivisionScopedLocation = async ({ id, divisionId, role }) => {
	return prisma.location.findFirst({
		where: {
			id,
			...(role === "SUPER_ADMIN" ? {} : { station: { divisionId } }),
		},
		select: { id: true, stationId: true, station: { select: { divisionId: true } } },
	});
};

// 1. CREATE Location
const createLocation = async (req, res) => {
	const { name, description, stationId, supervisorId } = req.body;
	const { divisionId, role } = req.user;

	if (!name || !stationId || !supervisorId) {
		return res
			.status(400)
			.json({ message: "Location name, stationId and supervisorId are required." });
	}

	try {
		const station = await getDivisionScopedStation({ stationId, divisionId, role });
		if (!station) {
			return res.status(403).json({ message: "Invalid station access." });
		}

		const isSupervisorValid = await validateSupervisor({
			supervisorId,
			divisionId: station.divisionId,
			role,
		});
		if (!isSupervisorValid) {
			return res.status(400).json({
				message: "Invalid supervisor. Select JE/SSE user from your division.",
			});
		}

		const newLocation = await prisma.location.create({
			data: {
				name,
				description: description || "",
				stationId,
				supervisorId,
			},
			include: {
				station: { select: { id: true, name: true, code: true } },
				supervisor: { select: { id: true, name: true, designation: true, role: true } },
				_count: { select: { racks: true } },
			},
		});

		res.status(201).json({ message: "Location created successfully!", newLocation });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 2. GET all locations in division (or all for SUPER_ADMIN)
const findAllLocations = async (req, res) => {
	const { divisionId, role } = req.user;

	try {
		const locations = await prisma.location.findMany({
			where: role === "SUPER_ADMIN" ? {} : { station: { divisionId } },
			include: {
				station: { select: { id: true, name: true, code: true } },
				supervisor: { select: { id: true, name: true, designation: true, role: true } },
				_count: { select: { racks: true } },
			},
			orderBy: [{ station: { code: "asc" } }, { name: "asc" }],
		});
		res.status(200).json(locations);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 3. GET all locations for a station
const findStationLocations = async (req, res) => {
	const { stationId } = req.params;
	const { divisionId, role } = req.user;

	try {
		const station = await getDivisionScopedStation({ stationId, divisionId, role });
		if (!station) {
			return res.status(403).json({ message: "Invalid station access." });
		}

		const locations = await prisma.location.findMany({
			where: { stationId },
			include: {
				supervisor: { select: { id: true, name: true, designation: true, role: true } },
				_count: { select: { racks: true } },
			},
			orderBy: { name: "asc" },
		});
		res.status(200).json(locations);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 4. GET Location Details (Racks -> Equipment -> Ports)
const getLocationDetails = async (req, res) => {
	const { id } = req.params;
	const { divisionId, role } = req.user;

	try {
		const location = await prisma.location.findFirst({
			where: {
				id,
				...(role === "SUPER_ADMIN" ? {} : { station: { divisionId } }),
			},
			include: {
				station: { select: { id: true, name: true, code: true } },
				supervisor: { select: { id: true, name: true, designation: true, role: true } },
				racks: {
					include: {
						equipments: {
							include: {
								portConfigs: {
									include: { portTemplate: true },
								},
							},
						},
					},
				},
			},
		});

		if (!location) {
			return res.status(404).json({ error: "Location not found" });
		}

		res.status(200).json(location);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 5. UPDATE Location details
const updateLocation = async (req, res) => {
	const { id } = req.params;
	const { name, description, supervisorId } = req.body;
	const { divisionId, role } = req.user;

	try {
		const existing = await getDivisionScopedLocation({ id, divisionId, role });
		if (!existing) {
			return res.status(404).json({ message: "Location not found" });
		}

		if (supervisorId !== undefined) {
			const isSupervisorValid = await validateSupervisor({
				supervisorId,
				divisionId: existing.station.divisionId,
				role,
			});
			if (!isSupervisorValid) {
				return res.status(400).json({
					message: "Invalid supervisor. Select JE/SSE user from your division.",
				});
			}
		}

		const updatedLocation = await prisma.location.update({
			where: { id },
			data: {
				name: name !== undefined ? name : undefined,
				description: description !== undefined ? description : undefined,
				supervisorId: supervisorId !== undefined ? supervisorId : undefined,
			},
			include: {
				station: { select: { id: true, name: true, code: true } },
				supervisor: { select: { id: true, name: true, designation: true, role: true } },
				_count: { select: { racks: true } },
			},
		});

		res.status(200).json({
			message: "Location updated successfully!",
			updatedLocation,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 6. DELETE Location
const deleteLocation = async (req, res) => {
	const { id } = req.params;
	const { divisionId, role } = req.user;

	try {
		const existing = await getDivisionScopedLocation({ id, divisionId, role });
		if (!existing) {
			return res.status(404).json({ message: "Location not found" });
		}

		await prisma.location.delete({ where: { id } });
		res.status(200).json({ message: "Location deleted successfully!" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export {
	createLocation,
	findAllLocations,
	findStationLocations,
	getLocationDetails,
	updateLocation,
	deleteLocation,
};
