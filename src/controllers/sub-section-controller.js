import prisma from "../lib/prisma";

// 1. CREATE Sub-section (Connects two stations)
const createSubSection = async (req, res) => {
	const { code, name, fromStationId, toStationId, startKm, endKm, supervisorId } = req.body;

	const userId = req.user.id;
	const divisionId = req.user.divisionId;

	if (!supervisorId) {
		return res.status(400).json({ message: "Supervisor is required." });
	}

	try {
		// Validation: Ensure both stations belong to the user's division
		const stations = await prisma.station.findMany({
			where: {
				id: { in: [fromStationId, toStationId] },
				divisionId: req.user.role === "SUPER_ADMIN" ? undefined : divisionId,
			},
		});

		if (stations.length !== 2) {
			return res.status(400).json({
				message:
					"One or both stations not found or unauthorized for this division.",
			});
		}

		const supervisor = await prisma.user.findFirst({
			where: {
				id: supervisorId,
				divisionId: req.user.role === "SUPER_ADMIN" ? undefined : divisionId,
			},
			select: { id: true },
		});

		if (!supervisor) {
			return res.status(400).json({ message: "Invalid supervisor for this division." });
		}

		const parsedStart = startKm !== undefined && startKm !== "" ? Number.parseFloat(startKm) : null;
		const parsedEnd = endKm !== undefined && endKm !== "" ? Number.parseFloat(endKm) : null;

		if (
			parsedStart !== null &&
			parsedEnd !== null &&
			Number.isFinite(parsedStart) &&
			Number.isFinite(parsedEnd) &&
			parsedStart >= parsedEnd
		) {
			return res.status(400).json({ message: "Start KM must be less than End KM." });
		}

		const subSection = await prisma.subsection.create({
			data: {
				code,
				name,
				fromStationId,
				toStationId,
				startKm: parsedStart,
				endKm: parsedEnd,
				divisionId,
				createdById: userId,
				supervisorId,
			},
			include: {
				fromStation: { select: { name: true, code: true } },
				toStation: { select: { name: true, code: true } },
				supervisor: { select: { id: true, name: true, designation: true } },
			},
		});

		res.status(201).json({ message: "Sub-section created!", subSection });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 2. GET ALL Sub-sections (Filtered by Division)
const findAllSubSections = async (req, res) => {
	const { divisionId, role } = req.user;

	try {
		const queryOptions = {
			where: role === "SUPER_ADMIN" ? {} : { divisionId },
			include: {
				fromStation: { select: { name: true, code: true } },
				toStation: { select: { name: true, code: true } },
				createdBy: { select: { name: true } },
				supervisor: { select: { id: true, name: true, designation: true } },
				section: { select: { name: true, code: true } }, // If linked to a main section
			},
		};

		const subSections = await prisma.subsection.findMany(queryOptions);
		res.status(200).json(subSections);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 3. UPDATE Sub-section
const updateSubSection = async (req, res) => {
	const { id } = req.params;
	const { divisionId, role } = req.user;
	const data = req.body;

	try {
		const existing = await prisma.subsection.findUnique({ where: { id } });

		if (!existing)
			return res.status(404).json({ message: "Sub-section not found" });

		if (role !== "SUPER_ADMIN" && existing.divisionId !== divisionId) {
			return res.status(403).json({ message: "Unauthorized access" });
		}

		if (data.supervisorId !== undefined) {
			const supervisor = await prisma.user.findFirst({
				where: {
					id: data.supervisorId,
					divisionId: role === "SUPER_ADMIN" ? undefined : divisionId,
				},
				select: { id: true },
			});
			if (!supervisor) {
				return res.status(400).json({ message: "Invalid supervisor for this division." });
			}
		}

		const updated = await prisma.subsection.update({
			where: { id },
			data,
			include: {
				fromStation: true,
				toStation: true,
			},
		});

		res.status(200).json({ message: "Sub-section updated!", updated });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 4. DELETE Sub-section
const deleteSubSection = async (req, res) => {
	const { id } = req.params;
	const { divisionId, role } = req.user;

	try {
		const subSection = await prisma.subsection.findUnique({ where: { id } });

		if (!subSection) return res.status(404).json({ message: "Not found" });

		if (role !== "SUPER_ADMIN" && subSection.divisionId !== divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		await prisma.subsection.delete({ where: { id } });
		res.status(200).json({ message: "Sub-section deleted successfully!" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 5. GET Sub-section Details (Used for connectivity analysis)
const getSubSectionDetails = async (req, res) => {
	const { id } = req.params;
	const { divisionId, role } = req.user;

	try {
		const details = await prisma.subsection.findFirst({
			where: {
				id,
				divisionId: role === "SUPER_ADMIN" ? undefined : divisionId,
			},
			include: {
				fromStation: true,
				toStation: true,
				supervisor: { select: { id: true, name: true, designation: true } },
				section: { select: { name: true, code: true } },
			},
		});

		if (!details)
			return res.status(404).json({ error: "Sub-section not found" });
		res.status(200).json(details);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export {
	createSubSection,
	findAllSubSections,
	updateSubSection,
	deleteSubSection,
	getSubSectionDetails,
};
