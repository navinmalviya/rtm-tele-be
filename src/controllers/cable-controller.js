import prisma from "../lib/prisma.js";
import { buildSubsectionVisibilityWhere } from "../lib/access-scope.js";

const QUAD_A_WIRE_COLORS = ["Orange", "Blue", "Brown", "Green", "Yellow", "Black"];
const TUBE_COLORS = ["Blue", "Orange", "Green", "Brown", "Slate", "White"];
const FIBER_COLORS = ["Blue", "Orange", "Green", "Natural"];
const CABLE_SUPERVISOR_ROLES = [
	"JE_SSE_TELE_SECTIONAL",
	"SSE_TELE_INCHARGE",
	"SSE_SNT_OFFICE",
	"SSE_TECH",
	"TCM",
];
const JOINT_TYPES = new Set(["NORMAL", "EC"]);
const TRACK_SIDES = new Set(["UP", "DOWN"]);
const TEST_CAUSES = new Set([
	"SCHEDULED",
	"FAILURE",
	"POST_RESTORATION",
	"COMMISSIONING",
	"OTHER",
]);

const parseSideSegments = (sideSegments) => {
	if (typeof sideSegments === "string") {
		try {
			return JSON.parse(sideSegments);
		} catch {
			return [];
		}
	}
	return Array.isArray(sideSegments) ? sideSegments : [];
};

const parseNullableFloat = (value) => {
	if (value === undefined || value === null || value === "") return null;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const parseNullableDate = (value) => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

export const cableController = {
	// 1) Get all subsection cables
	getCablesBySubsection: async (req, res) => {
		try {
			const { subsectionId } = req.params;
			const subsectionScope = buildSubsectionVisibilityWhere(req);

			const cables = await prisma.cable.findMany({
				where: {
					subsectionId,
					subsection: {
						...subsectionScope,
					},
				},
				include: {
					sideSegments: true,
					joints: {
						select: {
							id: true,
							jointType: true,
							jointKm: true,
							locationKM: true,
							side: true,
							jointDate: true,
						},
						orderBy: { jointDate: "desc" },
					},
					supervisor: {
						select: { id: true, name: true, designation: true, role: true },
					},
					_count: {
						select: {
							cuts: true,
							joints: true,
							copperPairs: true,
							fibers: true,
							ecSockets: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			});
			res.status(200).json(cables);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 2) Get subsection cable details
	getCableDetails: async (req, res) => {
		try {
			const { id } = req.params;
			const subsectionScope = buildSubsectionVisibilityWhere(req);
			const cable = await prisma.cable.findFirst({
				where: {
					id,
					subsection: {
						...subsectionScope,
					},
				},
				include: {
					subsection: {
						select: { id: true, code: true, name: true, startKm: true, endKm: true },
					},
					supervisor: {
						select: { id: true, name: true, designation: true, role: true },
					},
					copperPairs: {
						orderBy: [{ quadNo: "asc" }, { pairNo: "asc" }],
						include: {
							circuits: {
								select: {
									id: true,
									circuitIdString: true,
									equipments: { select: { id: true, name: true } },
								},
							},
						},
					},
					fibers: {
						orderBy: [{ tubeNo: "asc" }, { fiberNo: "asc" }],
						include: {
							circuits: {
								select: {
									id: true,
									circuitIdString: true,
									equipments: { select: { id: true, name: true } },
								},
							},
						},
					},
					ecSockets: {
						orderBy: { poleKm: "asc" },
					},
					sideSegments: {
						orderBy: { fromKm: "asc" },
					},
					cuts: {
						orderBy: { cutDateTime: "desc" },
						include: { reportedBy: { select: { name: true } } },
					},
					joints: {
						orderBy: { jointDate: "desc" },
						include: {
							ecSocket: { select: { id: true, poleKm: true } },
							createdBy: { select: { id: true, name: true, designation: true } },
						},
					},
					testReports: {
						orderBy: { testDate: "desc" },
						include: {
							testedBy: {
								select: { id: true, name: true, designation: true, role: true },
							},
							measuredAtStation: {
								select: { id: true, name: true, code: true },
							},
							ackByInchargeBy: {
								select: { id: true, name: true, designation: true },
							},
							measuredValues: {
								orderBy: { srNo: "asc" },
							},
						},
					},
				},
			});

			if (!cable) {
				return res.status(404).json({ message: "Cable record not found" });
			}

			res.status(200).json(cable);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 3) Add EC socket
	createEcSocket: async (req, res) => {
		try {
			const { id } = req.params;
			const { poleKm } = req.body;
			const { divisionId, role } = req.user;

			if (!poleKm || !String(poleKm).trim()) {
				return res.status(400).json({ message: "Pole KM is required." });
			}

			const cable = await prisma.cable.findFirst({
				where: {
					id,
					...(role === "SUPER_ADMIN" ? {} : { subsection: { divisionId } }),
				},
				include: { subsection: { select: { startKm: true, endKm: true } } },
			});

			if (!cable) {
				return res.status(404).json({ message: "Cable not found." });
			}

			const rangeStart = cable.subsection?.startKm;
			const rangeEnd = cable.subsection?.endKm;
			const kmMatch = String(poleKm).match(/^\s*(\d+(\.\d+)?)/);
			if (
				rangeStart !== null &&
				rangeStart !== undefined &&
				rangeEnd !== null &&
				rangeEnd !== undefined &&
				kmMatch
			) {
				const kmValue = Number.parseFloat(kmMatch[1]);
				if (kmValue < rangeStart || kmValue > rangeEnd) {
					return res.status(400).json({
						message: `Pole KM must be within subsection range ${rangeStart}-${rangeEnd}.`,
					});
				}
			}

			const socket = await prisma.ecSocket.create({
				data: {
					poleKm: String(poleKm).trim(),
					cableId: id,
				},
			});

			res.status(201).json(socket);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 4) Add cable joint / EC joint
	createJoint: async (req, res) => {
		try {
			const { id } = req.params;
			const {
				jointType = "NORMAL",
				jointKm,
				locationKM,
				side,
				jointDate,
				remarks,
				coordinatesX,
				coordinatesY,
				ecSocketId,
			} = req.body;
			const { divisionId, role, id: userId } = req.user;

			if (!JOINT_TYPES.has(jointType)) {
				return res.status(400).json({ message: "Invalid joint type. Use NORMAL or EC." });
			}

			if (side && !TRACK_SIDES.has(side)) {
				return res.status(400).json({ message: "Invalid side. Use UP or DOWN." });
			}

			const cable = await prisma.cable.findFirst({
				where: {
					id,
					...(role === "SUPER_ADMIN" ? {} : { subsection: { divisionId } }),
				},
				include: {
					subsection: { select: { startKm: true, endKm: true } },
				},
			});

			if (!cable) {
				return res.status(404).json({ message: "Cable not found." });
			}

			const parsedJointKm =
				jointKm !== undefined && jointKm !== null && jointKm !== ""
					? Number.parseFloat(jointKm)
					: null;
			if (parsedJointKm !== null && !Number.isFinite(parsedJointKm)) {
				return res.status(400).json({ message: "jointKm must be a valid number." });
			}

			const rangeStart = cable.subsection?.startKm;
			const rangeEnd = cable.subsection?.endKm;
			if (
				parsedJointKm !== null &&
				rangeStart !== null &&
				rangeStart !== undefined &&
				rangeEnd !== null &&
				rangeEnd !== undefined &&
				(parsedJointKm < rangeStart || parsedJointKm > rangeEnd)
			) {
				return res.status(400).json({
					message: `Joint KM must be within subsection range ${rangeStart}-${rangeEnd}.`,
				});
			}

			if (jointType === "EC" && !ecSocketId) {
				return res.status(400).json({ message: "ecSocketId is required for EC joint." });
			}

			if (ecSocketId) {
				const socket = await prisma.ecSocket.findFirst({
					where: { id: ecSocketId, cableId: id },
					select: { id: true, poleKm: true },
				});
				if (!socket) {
					return res.status(400).json({ message: "Invalid EC socket for selected cable." });
				}
			}

			const created = await prisma.joint.create({
				data: {
					cableId: id,
					jointType,
					jointKm: parsedJointKm,
					locationKM:
						locationKM && String(locationKM).trim()
							? String(locationKM).trim()
							: parsedJointKm !== null
								? `KM ${parsedJointKm}`
								: null,
					side: side || null,
					jointDate: jointDate ? new Date(jointDate) : new Date(),
					remarks: remarks ? String(remarks).trim() : null,
					coordinatesX: coordinatesX ? String(coordinatesX).trim() : null,
					coordinatesY: coordinatesY ? String(coordinatesY).trim() : null,
					ecSocketId: ecSocketId || null,
					createdById: userId || null,
				},
				include: {
					ecSocket: { select: { id: true, poleKm: true } },
					createdBy: { select: { id: true, name: true, designation: true } },
				},
			});

			return res.status(201).json(created);
		} catch (error) {
			return res.status(500).json({ error: error.message });
		}
	},

	// 5) Add cable testing report
	createCableTestReport: async (req, res) => {
		try {
			const { id } = req.params;
			const subsectionScope = buildSubsectionVisibilityWhere(req);
			const { divisionId, role, id: testedById } = req.user;
			const {
				testDate,
				measuredOn,
				testCause,
				sectionName,
				blockSectionName,
				cableRouteDistanceKm,
				sectionLengthKm,
				measuredAtStationId,
				calculatedLoopResistance,
				calculatedAttenuation,
				insulationRes,
				dbLoss,
				overallRemarks,
				measuredValues,
			} = req.body;

			const cable = await prisma.cable.findFirst({
				where: {
					id,
					subsection: {
						...subsectionScope,
					},
				},
				select: { id: true },
			});
			if (!cable) {
				return res.status(404).json({ message: "Cable not found." });
			}

			const resolvedCause = testCause || "SCHEDULED";
			if (!TEST_CAUSES.has(resolvedCause)) {
				return res.status(400).json({
					message: "Invalid testCause. Use SCHEDULED, FAILURE, POST_RESTORATION, COMMISSIONING or OTHER.",
				});
			}

			if (measuredAtStationId) {
				const station = await prisma.station.findFirst({
					where: {
						id: measuredAtStationId,
						...(role === "SUPER_ADMIN" ? {} : { divisionId }),
					},
					select: { id: true },
				});
				if (!station) {
					return res.status(400).json({ message: "Invalid measured-at station." });
				}
			}

			const rows = Array.isArray(measuredValues) ? measuredValues : [];
			if (rows.length > 200) {
				return res.status(400).json({ message: "Too many measured rows in one test report." });
			}

			const parsedRows = rows
				.map((row, index) => ({
					srNo: Number.parseInt(row?.srNo ?? index + 1, 10),
					quadNo:
						row?.quadNo === undefined || row?.quadNo === null || row?.quadNo === ""
							? null
							: Number.parseInt(row.quadNo, 10),
					pairNo:
						row?.pairNo === undefined || row?.pairNo === null || row?.pairNo === ""
							? null
							: Number.parseInt(row.pairNo, 10),
					circuitName: row?.circuitName ? String(row.circuitName).trim() : null,
					transmissionLossDb: parseNullableFloat(row?.transmissionLossDb),
					loopResistanceOhm: parseNullableFloat(row?.loopResistanceOhm),
					insulationL1E: parseNullableFloat(row?.insulationL1E),
					insulationL2E: parseNullableFloat(row?.insulationL2E),
					insulationL1L2: parseNullableFloat(row?.insulationL1L2),
					remarks: row?.remarks ? String(row.remarks).trim() : null,
				}))
				.filter((row) => Number.isFinite(row.srNo));

			const report = await prisma.$transaction(async (tx) => {
				const createdReport = await tx.cableTestReport.create({
					data: {
						cableId: id,
						testedById,
						testDate: parseNullableDate(testDate) || new Date(),
						measuredOn: parseNullableDate(measuredOn),
						testCause: resolvedCause,
						sectionName: sectionName ? String(sectionName).trim() : null,
						blockSectionName: blockSectionName ? String(blockSectionName).trim() : null,
						cableRouteDistanceKm: parseNullableFloat(cableRouteDistanceKm),
						sectionLengthKm: parseNullableFloat(sectionLengthKm),
						measuredAtStationId: measuredAtStationId || null,
						calculatedLoopResistance: parseNullableFloat(calculatedLoopResistance),
						calculatedAttenuation: parseNullableFloat(calculatedAttenuation),
						insulationRes: insulationRes ? String(insulationRes).trim() : null,
						dbLoss: parseNullableFloat(dbLoss),
						overallRemarks: overallRemarks ? String(overallRemarks).trim() : null,
					},
				});

				if (parsedRows.length) {
					await tx.cableTestMeasuredValue.createMany({
						data: parsedRows.map((row) => ({
							reportId: createdReport.id,
							...row,
						})),
					});
				}

				return tx.cableTestReport.findUnique({
					where: { id: createdReport.id },
					include: {
						testedBy: {
							select: { id: true, name: true, designation: true, role: true },
						},
						measuredAtStation: {
							select: { id: true, name: true, code: true },
						},
						ackByInchargeBy: {
							select: { id: true, name: true, designation: true },
						},
						measuredValues: {
							orderBy: { srNo: "asc" },
						},
					},
				});
			});

			return res.status(201).json(report);
		} catch (error) {
			return res.status(500).json({ error: error.message });
		}
	},

	// 6) Connect pair/fiber to equipment
	connectMediaToEquipment: async (req, res) => {
		try {
			const { mediaType, mediaId, equipmentId, circuitIdString, description } = req.body;
			if (!mediaType || !mediaId || !equipmentId) {
				return res.status(400).json({ message: "mediaType, mediaId and equipmentId are required." });
			}

			const circuitCode =
				circuitIdString || `CIR-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 10000)}`;

			const circuit = await prisma.circuit.create({
				data: {
					circuitIdString: circuitCode,
					description: description || null,
					equipments: { connect: { id: equipmentId } },
					copperPairs: mediaType === "PAIR" ? { connect: { id: mediaId } } : undefined,
					fibers: mediaType === "FIBER" ? { connect: { id: mediaId } } : undefined,
				},
				include: {
					equipments: { select: { id: true, name: true } },
					copperPairs: { select: { id: true } },
					fibers: { select: { id: true } },
				},
			});

			res.status(201).json({ message: "Connected successfully", circuit });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 7) Create subsection cable + generate media
	createCable: async (req, res) => {
		try {
			const {
				type,
				subType,
				maintenanceBy,
				subsectionId,
				length,
				dateOfCommissioning,
				side,
				supervisorId,
				quadCount,
				pairCount,
				fiberCount,
				tubeCount,
				sideSegments,
			} = req.body;
			const { divisionId, role } = req.user;

			if (!subsectionId) {
				return res.status(400).json({ message: "subsectionId is required for subsection cable." });
			}

			const subsection = await prisma.subsection.findFirst({
				where: {
					id: subsectionId,
					...(role === "SUPER_ADMIN" ? {} : { divisionId }),
				},
				select: { startKm: true, endKm: true, supervisorId: true, divisionId: true },
			});
			if (!subsection) {
				return res.status(400).json({ message: "Invalid subsection for your division." });
			}
			const resolvedSupervisorId = supervisorId || subsection.supervisorId;
			if (resolvedSupervisorId) {
				const validSupervisor = await prisma.user.findFirst({
					where: {
						id: resolvedSupervisorId,
						role: { in: CABLE_SUPERVISOR_ROLES },
						...(role === "SUPER_ADMIN" ? {} : { divisionId: subsection.divisionId }),
					},
					select: { id: true },
				});
				if (!validSupervisor) {
					return res.status(400).json({
						message: "Invalid cable supervisor. Select JE/SSE/TCM supervisor from your division.",
					});
				}
			}

			const parsedSegments = parseSideSegments(sideSegments);
			if (parsedSegments.length) {
				const rangeStart = subsection.startKm;
				const rangeEnd = subsection.endKm;
				const invalid = parsedSegments.some((segment) => {
					const fromKm = Number.parseFloat(segment.fromKm);
					const toKm = Number.parseFloat(segment.toKm);
					if (!Number.isFinite(fromKm) || !Number.isFinite(toKm)) return true;
					if (fromKm >= toKm) return true;
					if (rangeStart !== null && rangeStart !== undefined && fromKm < rangeStart) return true;
					if (rangeEnd !== null && rangeEnd !== undefined && toKm > rangeEnd) return true;
					return false;
				});
				if (invalid) {
					return res.status(400).json({
						message: "Side segments must be within subsection KM range.",
					});
				}
			}

			const result = await prisma.$transaction(async (tx) => {
				const cable = await tx.cable.create({
					data: {
						type,
						subType,
						maintenanceBy,
						subsectionId,
						supervisorId: resolvedSupervisorId,
						length,
						dateOfCommissioning: dateOfCommissioning ? new Date(dateOfCommissioning) : null,
						side: side || "UP",
						quadCount: Number.parseInt(quadCount || 0),
						pairCount: Number.parseInt(pairCount || 0),
						fiberCount: Number.parseInt(fiberCount || 0),
						tubeCount: Number.parseInt(tubeCount || 0),
					},
				});

				if (parsedSegments.length) {
					const segmentRows = parsedSegments
						.map((segment) => ({
							cableId: cable.id,
							fromKm: Number.parseFloat(segment.fromKm),
							toKm: Number.parseFloat(segment.toKm),
							side: segment.side,
						}))
						.filter(
							(segment) =>
								Number.isFinite(segment.fromKm) &&
								Number.isFinite(segment.toKm) &&
								segment.fromKm < segment.toKm &&
								segment.side
						);
					if (segmentRows.length) {
						await tx.cableSideSegment.createMany({ data: segmentRows });
					}
				}

				if (type === "PIJF" || subType === "QUAD_6") {
					const copperData = [];
					const activeQuads = quadCount || 6;

					for (let q = 1; q <= activeQuads; q++) {
						const aWireColor = QUAD_A_WIRE_COLORS[q - 1];
						copperData.push({
							cableId: cable.id,
							quadNo: q,
							quadColor: aWireColor,
							pairNo: 1,
							pairColor: `${aWireColor} / White`,
						});
						copperData.push({
							cableId: cable.id,
							quadNo: q,
							quadColor: aWireColor,
							pairNo: 2,
							pairColor: "Red / Grey",
						});
					}
					if (copperData.length > 0) {
						await tx.copperPair.createMany({ data: copperData });
					}
				}

				if (type === "OFC" && fiberCount > 0) {
					const fiberData = [];
					const totalTubes = tubeCount || 6;
					const fibersPerTube = fiberCount / totalTubes;

					for (let t = 1; t <= totalTubes; t++) {
						for (let f = 1; f <= fibersPerTube; f++) {
							fiberData.push({
								cableId: cable.id,
								tubeNo: t,
								tubeColor: TUBE_COLORS[t - 1],
								fiberNo: (t - 1) * fibersPerTube + f,
								fiberColor: FIBER_COLORS[f - 1],
							});
						}
					}
					if (fiberData.length > 0) {
						await tx.fiber.createMany({ data: fiberData });
					}
				}

				return cable;
			});

			res.status(201).json(result);
		} catch (error) {
			console.error("Cable Creation Transaction Failed:", error);
			res.status(500).json({ error: error.message });
		}
	},

	// 8) Update subsection cable metadata
	updateCable: async (req, res) => {
		try {
			const { id } = req.params;
			const { divisionId, role } = req.user;
			const { maintenanceBy, length, side, dateOfCommissioning, supervisorId } = req.body;
			const existingCable = await prisma.cable.findFirst({
				where: {
					id,
					...(role === "SUPER_ADMIN" ? {} : { subsection: { divisionId } }),
				},
				select: {
					id: true,
					subsection: { select: { divisionId: true } },
				},
			});
			if (!existingCable) {
				return res.status(404).json({ message: "Cable not found" });
			}

			if (supervisorId) {
				const validSupervisor = await prisma.user.findFirst({
					where: {
						id: supervisorId,
						role: { in: CABLE_SUPERVISOR_ROLES },
						...(role === "SUPER_ADMIN"
							? {}
							: { divisionId: existingCable.subsection.divisionId }),
					},
					select: { id: true },
				});
				if (!validSupervisor) {
					return res.status(400).json({
						message: "Invalid cable supervisor. Select JE/SSE/TCM supervisor from your division.",
					});
				}
			}
			const updated = await prisma.cable.update({
				where: { id },
				data: {
					maintenanceBy,
					length,
					side,
					supervisorId: supervisorId !== undefined ? supervisorId || null : undefined,
					dateOfCommissioning: dateOfCommissioning ? new Date(dateOfCommissioning) : undefined,
				},
			});
			res.status(200).json(updated);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 9) Delete subsection cable
	deleteCable: async (req, res) => {
		try {
			const { id } = req.params;
			await prisma.cable.delete({ where: { id } });
			res.status(204).send();
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},
};
