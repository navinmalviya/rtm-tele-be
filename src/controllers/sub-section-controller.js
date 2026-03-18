import prisma from "../lib/prisma";
import { buildSubsectionVisibilityWhere } from "../lib/access-scope.js";

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
	try {
		const queryOptions = {
			where: buildSubsectionVisibilityWhere(req),
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

		await prisma.$transaction(async (tx) => {
			const uniqueIds = (values = []) => [...new Set(values.filter(Boolean))];

			const cables = await tx.cable.findMany({
				where: { subsectionId: id },
				select: { id: true },
			});
			const cableIds = uniqueIds(cables.map((row) => row.id));

			if (cableIds.length > 0) {
				const cableCuts = await tx.cableCut.findMany({
					where: { cableId: { in: cableIds } },
					select: { id: true },
				});
				const cableCutIds = uniqueIds(cableCuts.map((row) => row.id));

				if (cableCutIds.length > 0) {
					const cableFailures = await tx.failure.findMany({
						where: { cableCutId: { in: cableCutIds } },
						select: { id: true, taskId: true },
					});
					const failureIds = uniqueIds(cableFailures.map((row) => row.id));
					const failureTaskIds = uniqueIds(cableFailures.map((row) => row.taskId));

					if (failureIds.length > 0) {
						await tx.failure.deleteMany({
							where: { id: { in: failureIds } },
						});
					}

					if (failureTaskIds.length > 0) {
						await tx.task.deleteMany({
							where: { id: { in: failureTaskIds } },
						});
					}
				}

				await tx.cableTestReport.deleteMany({
					where: { cableId: { in: cableIds } },
				});
				await tx.joint.deleteMany({
					where: { cableId: { in: cableIds } },
				});
				await tx.cableCut.deleteMany({
					where: { cableId: { in: cableIds } },
				});
				await tx.cable.deleteMany({
					where: { id: { in: cableIds } },
				});
			}

			await tx.socketTestingReport.deleteMany({
				where: { subsectionId: id },
			});

			await tx.maintenanceSchedule.deleteMany({
				where: { subsectionId: id },
			});

			await tx.workDemandEntry.deleteMany({
				where: { subsectionId: id },
			});
			await tx.workAllocationEntry.deleteMany({
				where: { subsectionId: id },
			});
			await tx.workProgressEntry.deleteMany({
				where: { subsectionId: id },
			});
			await tx.workExecutionSubsectionScope.deleteMany({
				where: { subsectionId: id },
			});

			await tx.subsection.delete({ where: { id } });
		});

		res.status(200).json({ message: "Sub-section deleted successfully!" });
	} catch (error) {
		if (error.code === "P2003") {
			return res.status(400).json({
				message:
					"Sub-section deletion blocked by linked records that could not be auto-cleaned.",
			});
		}
		res.status(500).json({ error: error.message });
	}
};

// 5. GET Sub-section Details (Used for connectivity analysis)
const getSubSectionDetails = async (req, res) => {
	const { id } = req.params;
	const subsectionScope = buildSubsectionVisibilityWhere(req);

	try {
		const details = await prisma.subsection.findFirst({
			where: {
				id,
				...subsectionScope,
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
