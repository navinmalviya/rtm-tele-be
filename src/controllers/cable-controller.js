import prisma from "../lib/prisma.js";

const QUAD_A_WIRE_COLORS = ["Orange", "Blue", "Brown", "Green", "Yellow", "Black"];
const TUBE_COLORS = ["Blue", "Orange", "Green", "Brown", "Slate", "White"];
const FIBER_COLORS = ["Blue", "Orange", "Green", "Natural"];

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

export const cableController = {
	// 1) Get all subsection cables
	getCablesBySubsection: async (req, res) => {
		try {
			const { subsectionId } = req.params;
			const { divisionId, role } = req.user;

			const cables = await prisma.cable.findMany({
				where: {
					subsectionId,
					...(role === "SUPER_ADMIN" ? {} : { subsection: { divisionId } }),
				},
				include: {
					sideSegments: true,
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
			const { divisionId, role } = req.user;
			const cable = await prisma.cable.findFirst({
				where: {
					id,
					...(role === "SUPER_ADMIN" ? {} : { subsection: { divisionId } }),
				},
				include: {
					subsection: {
						select: { id: true, code: true, name: true, startKm: true, endKm: true },
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
						orderBy: { id: "desc" },
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

	// 4) Connect pair/fiber to equipment
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

	// 5) Create subsection cable + generate media
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
				select: { startKm: true, endKm: true },
			});
			if (!subsection) {
				return res.status(400).json({ message: "Invalid subsection for your division." });
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

	// 6) Update subsection cable metadata
	updateCable: async (req, res) => {
		try {
			const { id } = req.params;
			const { maintenanceBy, length, side, dateOfCommissioning } = req.body;
			const updated = await prisma.cable.update({
				where: { id },
				data: {
					maintenanceBy,
					length,
					side,
					dateOfCommissioning: dateOfCommissioning ? new Date(dateOfCommissioning) : undefined,
				},
			});
			res.status(200).json(updated);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 7) Delete subsection cable
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
