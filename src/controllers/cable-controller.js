import prisma from "../lib/prisma.js";

/**
 * Official Railway Color Coding Constants
 * Based on provided technical charts for 6-Quad and 24F OFC
 */

// Quad Identification based on A-Wire Color
const QUAD_A_WIRE_COLORS = [
	"Orange",
	"Blue",
	"Brown",
	"Green",
	"Yellow",
	"Black",
];

// OFC Tube Sequence (1-6)
const TUBE_COLORS = ["Blue", "Orange", "Green", "Brown", "Slate", "White"];

// OFC Fiber Sequence within each tube (1-4)
const FIBER_COLORS = ["Blue", "Orange", "Green", "Natural"];

export const cableController = {
	// 1. Get all cables for a specific Subsection with inventory counts
	getCablesBySubsection: async (req, res) => {
		try {
			const { subsectionId } = req.params;
			const cables = await prisma.cable.findMany({
				where: { subsectionId },
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

	// 2. Get full details including all generated transmission media
	getCableDetails: async (req, res) => {
		try {
			const { id } = req.params;
			const cable = await prisma.cable.findUnique({
				where: { id },
				include: {
					subsection: {
						select: { id: true, startKm: true, endKm: true },
					},
					copperPairs: {
						orderBy: [{ quadNo: "asc" }, { pairNo: "asc" }],
					},
					fibers: {
						orderBy: [{ tubeNo: "asc" }, { fiberNo: "asc" }],
					},
					ecSockets: {
						orderBy: { poleKm: "asc" },
					},
					sideSegments: {
						orderBy: { fromKm: "asc" },
					},
					cuts: {
						// FIX: Use cutDateTime instead of createdAt
						orderBy: { cutDateTime: "desc" },
						include: { reportedBy: { select: { name: true } } },
					},
					joints: {
						// FIX: Use id or another existing field if createdAt is missing
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

	createEcSocket: async (req, res) => {
		try {
			const { id } = req.params;
			const { poleKm } = req.body;

			if (!poleKm || !String(poleKm).trim()) {
				return res.status(400).json({ message: "Pole KM is required." });
			}

			const cable = await prisma.cable.findUnique({
				where: { id },
				include: { subsection: { select: { startKm: true, endKm: true } } },
			});

			if (!cable) {
				return res.status(404).json({ message: "Cable not found." });
			}

			const rangeStart = cable.subsection?.startKm;
			const rangeEnd = cable.subsection?.endKm;
			const kmMatch = String(poleKm).match(/^\s*(\d+(\.\d+)?)/);
			if (rangeStart !== null && rangeEnd !== null && kmMatch) {
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

	// 3. Create Cable + Auto-generate Quads/Fibers based on provided logic
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

			const subsection = await prisma.subsection.findUnique({
				where: { id: subsectionId },
				select: { startKm: true, endKm: true },
			});

			let parsedSegments = [];
			if (typeof sideSegments === "string") {
				try {
					parsedSegments = JSON.parse(sideSegments);
				} catch {
					parsedSegments = [];
				}
			} else if (Array.isArray(sideSegments)) {
				parsedSegments = sideSegments;
			}

			if (parsedSegments.length) {
				const rangeStart = subsection?.startKm;
				const rangeEnd = subsection?.endKm;
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
				// A. Create Master Cable Entry
				const cable = await tx.cable.create({
					data: {
						type,
						subType,
						maintenanceBy,
						subsectionId,
						length,
						dateOfCommissioning: dateOfCommissioning
							? new Date(dateOfCommissioning)
							: null,
						side,
						quadCount: Number.parseInt(quadCount || 0),
						pairCount: Number.parseInt(pairCount || 0),
						fiberCount: Number.parseInt(fiberCount || 0),
						tubeCount: Number.parseInt(tubeCount || 0),
					},
				});

				// A2. Side Segments (optional)
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

				// B. Generate Copper Pairs (Standard Star-Quad Logic)
				if (type === "PIJF" || subType === "QUAD_6") {
					const copperData = [];
					const activeQuads = quadCount || 6;

					for (let q = 1; q <= activeQuads; q++) {
						const aWireColor = QUAD_A_WIRE_COLORS[q - 1];

						// Pair 1: A-Wire (Base Quad Color) & B-Wire (White)
						copperData.push({
							cableId: cable.id,
							quadNo: q,
							quadColor: aWireColor,
							pairNo: 1,
							pairColor: `${aWireColor} / White`,
						});

						// Pair 2: C-Wire (Red) & D-Wire (Grey)
						copperData.push({
							cableId: cable.id,
							quadNo: q,
							quadColor: aWireColor,
							pairNo: 2,
							pairColor: "Red / Grey",
						});
					}
					if (copperData.length > 0)
						await tx.copperPair.createMany({ data: copperData });
				}

				// C. Generate Fibers (OFC 24F Sequence)
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
								// Continuous numbering (1-24)
								fiberNo: (t - 1) * fibersPerTube + f,
								fiberColor: FIBER_COLORS[f - 1], // Blue, Org, Green, Natural
							});
						}
					}
					if (fiberData.length > 0)
						await tx.fiber.createMany({ data: fiberData });
				}

				return cable;
			});

			res.status(201).json(result);
		} catch (error) {
			console.error("Cable Creation Transaction Failed:", error);
			res.status(500).json({ error: error.message });
		}
	},

	// 4. Update Cable basic information
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
					dateOfCommissioning: dateOfCommissioning
						? new Date(dateOfCommissioning)
						: undefined,
				},
			});
			res.status(200).json(updated);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 5. Delete a Cable record (Cascade takes care of children)
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
