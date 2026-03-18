import prisma from "../lib/prisma.js";
import { buildStationVisibilityWhere } from "../lib/access-scope.js";

const STATION_SUPERVISOR_ROLES = [
	"JE_SSE_TELE_SECTIONAL",
	"SSE_TELE_INCHARGE",
	"SSE_SNT_OFFICE",
	"SSE_TECH",
	"TCM",
];

const parseSupervisorIds = ({ supervisorId, supervisorIds }) => {
	const rawIds = [];
	if (Array.isArray(supervisorIds)) {
		rawIds.push(...supervisorIds);
	}
	if (supervisorId) {
		rawIds.unshift(supervisorId);
	}

	return [...new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean))];
};

const validateStationSupervisors = async ({
	supervisorIds,
	divisionId,
	role,
}) => {
	if (!supervisorIds.length) {
		return [];
	}

	const validSupervisors = await prisma.user.findMany({
		where: {
			id: { in: supervisorIds },
			role: { in: STATION_SUPERVISOR_ROLES },
			...(role === "SUPER_ADMIN" ? {} : { divisionId }),
		},
		select: { id: true },
	});

	return validSupervisors.map((row) => row.id);
};

// 1. CREATE Station (Auto-attach Division)
const createStation = async (req, res) => {
	const { code, name, mapX, mapY, supervisorId, supervisorIds } = req.body;

	// Values extracted from the Token via the Middleware
	const userId = req.user.id;
	const divisionId = req.user.divisionId;

	const normalizedSupervisorIds = parseSupervisorIds({
		supervisorId,
		supervisorIds,
	});
	if (!normalizedSupervisorIds.length) {
		return res.status(400).json({ message: "At least one supervisor is required." });
	}

	try {
		const validSupervisorIds = await validateStationSupervisors({
			supervisorIds: normalizedSupervisorIds,
			divisionId,
			role: req.user.role,
		});

		if (validSupervisorIds.length !== normalizedSupervisorIds.length) {
			return res.status(400).json({
				message:
					"Invalid supervisor set. Select JE/SSE/TCM supervisors from your division.",
			});
		}

		const primarySupervisorId = validSupervisorIds.includes(supervisorId)
			? supervisorId
			: validSupervisorIds[0];

		const station = await prisma.$transaction(async (tx) => {
			const created = await tx.station.create({
				data: {
					code,
					name,
					divisionId,
					createdById: userId,
					supervisorId: primarySupervisorId,
					mapX: parseFloat(mapX || 0),
					mapY: parseFloat(mapY || 0),
				},
			});

			await tx.stationSupervisor.createMany({
				data: validSupervisorIds.map((id) => ({
					stationId: created.id,
					supervisorId: id,
				})),
				skipDuplicates: true,
			});

			return created;
		});

		res.status(201).json({ message: "Station created!", station });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 2. GET ALL Stations (Filtered by Division)
const findAllStations = async (req, res) => {
	try {
		const queryOptions = {
			where: buildStationVisibilityWhere(req),
			include: {
				createdBy: {
					select: { name: true },
				},
				supervisor: {
					select: { id: true, name: true, designation: true },
				},
				supervisors: {
					include: {
						supervisor: {
							select: { id: true, name: true, designation: true, role: true },
						},
					},
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
	const {
		supervisorId: supervisorIdPayload,
		supervisorIds: supervisorIdsPayload,
		...restData
	} = data;

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

		const normalizedSupervisorIds = parseSupervisorIds({
			supervisorId: supervisorIdPayload,
			supervisorIds: supervisorIdsPayload,
		});
		const hasSupervisorUpdate =
			supervisorIdPayload !== undefined || supervisorIdsPayload !== undefined;

		if (hasSupervisorUpdate && !normalizedSupervisorIds.length) {
			return res.status(400).json({ message: "At least one supervisor is required." });
		}

		let validSupervisorIds = [];
		if (hasSupervisorUpdate) {
			validSupervisorIds = await validateStationSupervisors({
				supervisorIds: normalizedSupervisorIds,
				divisionId,
				role,
			});
			if (validSupervisorIds.length !== normalizedSupervisorIds.length) {
				return res.status(400).json({
					message:
						"Invalid supervisor set. Select JE/SSE/TCM supervisors from your division.",
				});
			}
		}

		const primarySupervisorId = hasSupervisorUpdate
			? validSupervisorIds.includes(supervisorIdPayload)
				? supervisorIdPayload
				: validSupervisorIds[0]
			: undefined;

		const updatedStation = await prisma.$transaction(async (tx) => {
			const updated = await tx.station.update({
				where: { id },
				data: {
					...restData,
					supervisorId: primarySupervisorId,
					mapX: restData.mapX !== undefined ? parseFloat(restData.mapX) : undefined,
					mapY: restData.mapY !== undefined ? parseFloat(restData.mapY) : undefined,
				},
			});

			if (hasSupervisorUpdate) {
				await tx.stationSupervisor.deleteMany({ where: { stationId: id } });
				await tx.stationSupervisor.createMany({
					data: validSupervisorIds.map((supervisorRef) => ({
						stationId: id,
						supervisorId: supervisorRef,
					})),
					skipDuplicates: true,
				});

				await tx.location.updateMany({
					where: { stationId: id, supervisorId: existing.supervisorId },
					data: { supervisorId: primarySupervisorId },
				});
			}

			return updated;
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
		if (!station) {
			return res.status(404).json({ message: "Station not found" });
		}

		if (role !== "SUPER_ADMIN" && station.divisionId !== divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		await prisma.$transaction(async (tx) => {
			const uniqueIds = (values = []) => [...new Set(values.filter(Boolean))];
			const buildOr = (conditions = []) => conditions.filter(Boolean);

			const locations = await tx.location.findMany({
				where: { stationId: id },
				select: { id: true },
			});
			const locationIds = uniqueIds(locations.map((row) => row.id));

			const equipments = await tx.equipment.findMany({
				where: { stationId: id },
				select: { id: true },
			});
			const equipmentIds = uniqueIds(equipments.map((row) => row.id));

			// 1) Disconnect this station from all many-to-many subsection links.
			const linkedSubsections = await tx.subsection.findMany({
				where: {
					stations: {
						some: { id },
					},
				},
				select: { id: true, fromStationId: true, toStationId: true },
			});

			for (const subsection of linkedSubsections) {
				await tx.subsection.update({
					where: { id: subsection.id },
					data: {
						stations: {
							disconnect: [{ id }],
						},
					},
				});
			}

			// 2) Delete boundary subsections where this station is start/end.
			const boundarySubsectionIds = uniqueIds(
				linkedSubsections
					.filter(
						(subsection) =>
							subsection.fromStationId === id || subsection.toStationId === id,
					)
					.map((subsection) => subsection.id),
			);

			if (boundarySubsectionIds.length > 0) {
				const cables = await tx.cable.findMany({
					where: { subsectionId: { in: boundarySubsectionIds } },
					select: { id: true },
				});
				const cableIds = uniqueIds(cables.map((row) => row.id));

				if (cableIds.length > 0) {
					const cableCuts = await tx.cableCut.findMany({
						where: { cableId: { in: cableIds } },
						select: { id: true },
					});
					const cableCutIds = uniqueIds(cableCuts.map((row) => row.id));

					// Failures linked to cable-cuts must be deleted before cable-cuts.
					if (cableCutIds.length > 0) {
						const cableFailures = await tx.failure.findMany({
							where: { cableCutId: { in: cableCutIds } },
							select: { id: true, taskId: true },
						});
						const cableFailureIds = uniqueIds(
							cableFailures.map((row) => row.id),
						);
						const cableFailureTaskIds = uniqueIds(
							cableFailures.map((row) => row.taskId),
						);

						if (cableFailureIds.length > 0) {
							await tx.failure.deleteMany({
								where: { id: { in: cableFailureIds } },
							});
						}
						if (cableFailureTaskIds.length > 0) {
							await tx.task.deleteMany({
								where: { id: { in: cableFailureTaskIds } },
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
					where: { subsectionId: { in: boundarySubsectionIds } },
				});

				await tx.maintenanceSchedule.deleteMany({
					where: { subsectionId: { in: boundarySubsectionIds } },
				});

				await tx.subsection.deleteMany({
					where: { id: { in: boundarySubsectionIds } },
				});
			}

			// 3) Delete station-linked task records and parent tasks.
			const failures = await tx.failure.findMany({
				where: {
					OR: buildOr([
						{ stationId: id },
						locationIds.length > 0 ? { locationId: { in: locationIds } } : null,
					]),
				},
				select: { id: true, taskId: true },
			});
			const failureIds = uniqueIds(failures.map((row) => row.id));
			const failureTaskIds = uniqueIds(failures.map((row) => row.taskId));

			if (failureIds.length > 0) {
				await tx.failure.deleteMany({ where: { id: { in: failureIds } } });
			}

			const trcRequests = equipmentIds.length
				? await tx.tRCRequest.findMany({
						where: { equipmentId: { in: equipmentIds } },
						select: { id: true, taskId: true },
					})
				: [];
			const trcRequestIds = uniqueIds(trcRequests.map((row) => row.id));
			const trcTaskIds = uniqueIds(trcRequests.map((row) => row.taskId));

			if (trcRequestIds.length > 0) {
				await tx.tRCRequest.deleteMany({
					where: { id: { in: trcRequestIds } },
				});
			}

			const maintenances = await tx.maintenance.findMany({
				where: {
					OR: buildOr([
						{ stationId: id },
						locationIds.length > 0 ? { locationId: { in: locationIds } } : null,
						equipmentIds.length > 0
							? { equipmentId: { in: equipmentIds } }
							: null,
					]),
				},
				select: { id: true, taskId: true },
			});
			const maintenanceIds = uniqueIds(maintenances.map((row) => row.id));
			const maintenanceTaskIds = uniqueIds(
				maintenances.map((row) => row.taskId),
			);

			if (maintenanceIds.length > 0) {
				await tx.maintenance.deleteMany({
					where: { id: { in: maintenanceIds } },
				});
			}

			const stationTaskIds = uniqueIds([
				...failureTaskIds,
				...trcTaskIds,
				...maintenanceTaskIds,
			]);
			if (stationTaskIds.length > 0) {
				await tx.task.deleteMany({
					where: { id: { in: stationTaskIds } },
				});
			}

			// 4) Delete master-detail station data.
			await tx.maintenanceSchedule.deleteMany({
				where: {
					OR: buildOr([
						{ stationId: id },
						locationIds.length > 0 ? { locationId: { in: locationIds } } : null,
						equipmentIds.length > 0
							? { equipmentId: { in: equipmentIds } }
							: null,
					]),
				},
			});

			await tx.tnpItem.deleteMany({ where: { stationId: id } });
			await tx.stationCircuit.deleteMany({ where: { stationId: id } });

			// Optional work rows tied directly to this station.
			await tx.workDemandEntry.deleteMany({ where: { stationId: id } });
			await tx.workAllocationEntry.deleteMany({ where: { stationId: id } });
			await tx.workProgressEntry.deleteMany({ where: { stationId: id } });
			await tx.workExecutionStationScope.deleteMany({ where: { stationId: id } });

			if (equipmentIds.length > 0) {
				await tx.equipment.deleteMany({
					where: { id: { in: equipmentIds } },
				});
			}

			if (locationIds.length > 0) {
				await tx.location.deleteMany({
					where: { id: { in: locationIds } },
				});
			}

			await tx.station.delete({ where: { id } });
		});

		res.status(200).json({ message: "Station deleted successfully!" });
	} catch (error) {
		if (error.code === "P2003") {
			return res.status(400).json({
				message:
					"Station deletion blocked by linked records that could not be auto-cleaned.",
			});
		}
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
		const stationScope = buildStationVisibilityWhere(req);

		const topology = await prisma.station.findFirst({
			where: {
				id,
				...stationScope,
			},
			select: {
				id: true,
				name: true,
				code: true,
				supervisor: { select: { id: true, name: true, designation: true } },
				// FIX: Changed 'subsection' to 'subsections' to match your schema
				subsections: {
					select: {
						name: true,
					},
				},
				_count: {
					select: {
						locations: true,
						equipments: true,
					},
				},
				locations: {
					include: {
						supervisor: {
							select: { id: true, name: true, designation: true, role: true },
						},
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

		if (!topology) {
			return res
				.status(404)
				.json({ error: "Station not found or unauthorized" });
		}

		res.status(200).json(topology);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 7. SUMMARY
const getStationSummary = async (req, res) => {
	try {
		const { id } = req.params;
		const stationScope = buildStationVisibilityWhere(req);

		const summary = await prisma.station.findFirst({
			where: {
				id,
				...stationScope,
			},
			select: {
				name: true,
				code: true,
				supervisor: { select: { id: true, name: true, designation: true } },
				subsections: { select: { name: true } },
				_count: {
					select: {
						locations: true,
						equipments: true,
					},
				},
				locations: {
					select: {
						id: true,
						name: true,
						supervisor: {
							select: { id: true, name: true, designation: true, role: true },
						},
					},
				},
			},
		});

		if (!summary) return res.status(404).json({ error: "Station not found" });

		const rackCount = await prisma.rack.count({
			where: {
				location: {
					stationId: id,
					station: {
						...stationScope,
					},
				},
			},
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
