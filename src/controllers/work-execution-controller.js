import prisma from "../lib/prisma.js";

const MANAGER_ROLES = new Set([
	"SUPER_ADMIN",
	"ADMIN",
	"TESTROOM",
	"SR_DSTE",
	"SR_DSTE_CO",
	"DSTE",
	"ADSTE",
]);
const WORK_MASTER_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "TESTROOM"]);

const FIELD_ROLES = new Set([
	"JE_SSE_TELE_SECTIONAL",
	"SSE_TELE_INCHARGE",
	"TCM",
	"TECHNICIAN",
	"FIELD_ENGINEER",
	"JE_SECTIONAL",
	"SSE_SECTIONAL",
]);

const DEFAULT_WORK_STATUS = "DRAFT_ITEMS";

const getRole = (req) => req.user?.originalRole || req.user?.role || "";
const isSuperAdmin = (req) => getRole(req) === "SUPER_ADMIN";
const isManager = (req) => MANAGER_ROLES.has(getRole(req));
const isWorkMaster = (req) => WORK_MASTER_ROLES.has(getRole(req));
const isConsignee = (req, work) => work?.consigneeId && work.consigneeId === req.user.id;

const parseNumber = (value, fallback = null) => {
	if (value === null || value === undefined || value === "") return fallback;
	const num = Number.parseFloat(value);
	return Number.isFinite(num) ? num : fallback;
};

const parsePositive = (value, fallback = null) => {
	const num = parseNumber(value, fallback);
	if (num === null) return fallback;
	return num >= 0 ? num : fallback;
};

const sumBy = (rows = [], key) =>
	rows.reduce((acc, row) => acc + Number.parseFloat(row?.[key] || 0), 0);

const scopedDivisionId = (req, bodyOrQuery = {}) => {
	if (isSuperAdmin(req)) {
		return bodyOrQuery.divisionId || req.user.divisionId;
	}
	return req.user.divisionId;
};

const ensureWorkAccess = async (req, workId) => {
	const work = await prisma.workExecution.findUnique({
		where: { id: workId },
		select: {
			id: true,
			divisionId: true,
			consigneeId: true,
			status: true,
		},
	});

	if (!work) return null;
	if (!isSuperAdmin(req) && work.divisionId !== req.user.divisionId) {
		return "FORBIDDEN";
	}
	return work;
};

const validateScope = async ({ req, stationId, subsectionId }) => {
	const divisionId = req.user.divisionId;
	if (stationId) {
		const station = await prisma.station.findFirst({
			where: {
				id: stationId,
				...(isSuperAdmin(req) ? {} : { divisionId }),
			},
			select: { id: true },
		});
		if (!station) {
			return "Invalid station selected for this division.";
		}
	}
	if (subsectionId) {
		const subsection = await prisma.subsection.findFirst({
			where: {
				id: subsectionId,
				...(isSuperAdmin(req) ? {} : { divisionId }),
			},
			select: { id: true },
		});
		if (!subsection) {
			return "Invalid subsection selected for this division.";
		}
	}
	return null;
};

const getWorkScopeSets = async (workId) => {
	const [stationScopes, subsectionScopes] = await Promise.all([
		prisma.workExecutionStationScope.findMany({
			where: { workId },
			select: { stationId: true },
		}),
		prisma.workExecutionSubsectionScope.findMany({
			where: { workId },
			select: { subsectionId: true },
		}),
	]);

	const stationIds = new Set(stationScopes.map((row) => row.stationId));
	const subsectionIds = new Set(subsectionScopes.map((row) => row.subsectionId));

	return {
		stationIds,
		subsectionIds,
		hasStationScope: stationIds.size > 0,
		hasSubsectionScope: subsectionIds.size > 0,
		hasAnyScope: stationIds.size > 0 || subsectionIds.size > 0,
	};
};

const validateTargetAgainstWorkScope = ({ stationId, subsectionId, scope }) => {
	if (!stationId && !subsectionId) {
		return "Select at least one target: station or subsection.";
	}

	if (!scope?.hasAnyScope) return null;

	if (scope.hasStationScope && !scope.hasSubsectionScope && !stationId) {
		return "This work is scoped station-wise. Please select a station in scope.";
	}
	if (scope.hasSubsectionScope && !scope.hasStationScope && !subsectionId) {
		return "This work is scoped subsection-wise. Please select a subsection in scope.";
	}

	if (stationId && !scope.hasStationScope) {
		return "Station is not configured in this work scope.";
	}
	if (subsectionId && !scope.hasSubsectionScope) {
		return "Subsection is not configured in this work scope.";
	}

	if (stationId && !scope.stationIds.has(stationId)) {
		return "Selected station is outside work scope.";
	}
	if (subsectionId && !scope.subsectionIds.has(subsectionId)) {
		return "Selected subsection is outside work scope.";
	}

	return null;
};

const buildScopeWhere = (scope) => {
	if (!scope?.hasAnyScope) return null;

	const or = [];
	if (scope.hasStationScope) {
		or.push({ stationId: { in: [...scope.stationIds] } });
	}
	if (scope.hasSubsectionScope) {
		or.push({ subsectionId: { in: [...scope.subsectionIds] } });
	}
	if (!or.length) return null;
	return { OR: or };
};

const validateSupervisorTargetAccess = async ({ req, stationId, subsectionId }) => {
	if (isSuperAdmin(req) || isManager(req)) return null;
	if (!FIELD_ROLES.has(getRole(req))) return null;

	const divisionId = req.user.divisionId;
	const userId = req.user.id;

	if (stationId) {
		const station = await prisma.station.findFirst({
			where: {
				id: stationId,
				...(isSuperAdmin(req) ? {} : { divisionId }),
			},
			select: { supervisorId: true },
		});
		if (!station) {
			return "Invalid station selected for this division.";
		}
		if (!station.supervisorId || station.supervisorId !== userId) {
			return "You can submit only for stations where you are mapped as supervisor.";
		}
	}

	if (subsectionId) {
		const subsection = await prisma.subsection.findFirst({
			where: {
				id: subsectionId,
				...(isSuperAdmin(req) ? {} : { divisionId }),
			},
			select: { supervisorId: true },
		});
		if (!subsection) {
			return "Invalid subsection selected for this division.";
		}
		if (!subsection.supervisorId || subsection.supervisorId !== userId) {
			return "You can submit only for subsections where you are mapped as supervisor.";
		}
	}

	return null;
};

export const createWorkExecution = async (req, res) => {
	if (!isWorkMaster(req)) {
		return res.status(403).json({ message: "Only testroom/admin can create works." });
	}

	const {
		divisionId,
		loaNo,
		loaDate,
		title,
		description,
		contractorName,
		acceptedValue,
		completionPeriodMonths,
		plannedStartDate,
		plannedEndDate,
		engineerIncharge,
		consigneeId,
		status,
		items,
	} = req.body;

	const scopedDivision = scopedDivisionId(req, { divisionId });

	if (!scopedDivision || !loaNo || !title || !consigneeId) {
		return res.status(400).json({
			message: "divisionId, loaNo, title and consigneeId are required.",
		});
	}

	try {
		const consignee = await prisma.user.findFirst({
			where: {
				id: consigneeId,
				divisionId: scopedDivision,
			},
			select: { id: true },
		});

		if (!consignee) {
			return res.status(400).json({ message: "Invalid consignee for selected division." });
		}

		const created = await prisma.$transaction(async (tx) => {
			const work = await tx.workExecution.create({
				data: {
					divisionId: scopedDivision,
					loaNo: String(loaNo).trim(),
					loaDate: loaDate ? new Date(loaDate) : null,
					title: String(title).trim(),
					description: description || null,
					contractorName: contractorName || null,
					acceptedValue: parsePositive(acceptedValue),
					completionPeriodMonths: completionPeriodMonths
						? Number.parseInt(completionPeriodMonths, 10)
						: null,
					plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
					plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
					engineerIncharge: engineerIncharge || null,
					consigneeId,
					createdById: req.user.id,
					status: status || DEFAULT_WORK_STATUS,
				},
			});

			if (Array.isArray(items) && items.length > 0) {
				await tx.workExecutionItem.createMany({
					data: items
						.filter((item) => item?.itemName && item?.uom)
						.map((item) => ({
							workId: work.id,
							lineNo: item.lineNo ? Number.parseInt(item.lineNo, 10) : null,
							scheduleCode: item.scheduleCode || null,
							itemCode: item.itemCode || null,
							itemName: String(item.itemName).trim(),
							rawDescription: item.rawDescription || null,
							category: item.category || "OTHER",
							uom: String(item.uom).trim(),
							plannedQty: parsePositive(item.plannedQty, 0),
							unitRate: parsePositive(item.unitRate),
							plannedAmount: parsePositive(item.plannedAmount),
						})),
				});
			}

			return work;
		});

		return res.status(201).json(created);
	} catch (error) {
		if (error.code === "P2002") {
			return res.status(409).json({ message: "Work with same LoA number already exists in division." });
		}
		return res.status(500).json({ error: error.message });
	}
};

export const listWorkExecutions = async (req, res) => {
	const divisionId = scopedDivisionId(req, req.query);

	try {
		const where = {
			...(isSuperAdmin(req) ? {} : { divisionId }),
		};

		if (!isManager(req) && FIELD_ROLES.has(getRole(req))) {
			where.OR = [
				{ consigneeId: req.user.id },
				{ demands: { some: { requestedById: req.user.id } } },
				{ allocations: { some: { allocatedToId: req.user.id } } },
				{ progressEntries: { some: { reportedById: req.user.id } } },
				{ stationScopes: { some: { station: { supervisorId: req.user.id } } } },
				{ subsectionScopes: { some: { subsection: { supervisorId: req.user.id } } } },
			];
		}

		const works = await prisma.workExecution.findMany({
			where,
			include: {
				consignee: {
					select: { id: true, name: true, designation: true, role: true },
				},
				createdBy: {
					select: { id: true, name: true, designation: true, role: true },
				},
				_count: {
					select: {
						items: true,
						demandRounds: true,
						demands: true,
						allocations: true,
					},
				},
			},
			orderBy: [{ createdAt: "desc" }],
		});

		return res.status(200).json(works);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const getWorkExecutionById = async (req, res) => {
	const { id } = req.params;

	try {
		const access = await ensureWorkAccess(req, id);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const work = await prisma.workExecution.findUnique({
			where: { id },
			include: {
				consignee: {
					select: { id: true, name: true, designation: true, role: true },
				},
				createdBy: {
					select: { id: true, name: true, designation: true, role: true },
				},
				items: {
					where: { isActive: true },
					orderBy: [{ lineNo: "asc" }, { createdAt: "asc" }],
				},
				stationScopes: {
					include: {
						station: {
							select: {
								id: true,
								name: true,
								code: true,
								supervisor: {
									select: { id: true, name: true, designation: true, role: true },
								},
							},
						},
					},
					orderBy: { createdAt: "asc" },
				},
				subsectionScopes: {
					include: {
						subsection: {
							select: {
								id: true,
								name: true,
								code: true,
								supervisor: {
									select: { id: true, name: true, designation: true, role: true },
								},
							},
						},
					},
					orderBy: { createdAt: "asc" },
				},
				demandRounds: {
					orderBy: [{ createdAt: "desc" }],
					include: {
						createdBy: {
							select: { id: true, name: true, designation: true, role: true },
						},
						_count: {
							select: { demands: true, allocations: true },
						},
					},
				},
			},
		});

		return res.status(200).json(work);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const updateWorkExecution = async (req, res) => {
	if (!isWorkMaster(req)) {
		return res.status(403).json({ message: "Only testroom/admin can update works." });
	}

	const { id } = req.params;
	const {
		loaNo,
		loaDate,
		title,
		description,
		contractorName,
		acceptedValue,
		completionPeriodMonths,
		plannedStartDate,
		plannedEndDate,
		engineerIncharge,
		consigneeId,
		status,
	} = req.body;

	try {
		const access = await ensureWorkAccess(req, id);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		if (consigneeId) {
			const consignee = await prisma.user.findFirst({
				where: {
					id: consigneeId,
					divisionId: access.divisionId,
				},
				select: { id: true },
			});
			if (!consignee) {
				return res.status(400).json({ message: "Invalid consignee for selected division." });
			}
		}

		const updated = await prisma.workExecution.update({
			where: { id },
			data: {
				loaNo: loaNo ? String(loaNo).trim() : undefined,
				loaDate: loaDate ? new Date(loaDate) : undefined,
				title: title ? String(title).trim() : undefined,
				description: description !== undefined ? description || null : undefined,
				contractorName:
					contractorName !== undefined ? contractorName || null : undefined,
				acceptedValue: acceptedValue !== undefined ? parsePositive(acceptedValue) : undefined,
				completionPeriodMonths:
					completionPeriodMonths !== undefined
						? Number.parseInt(completionPeriodMonths, 10)
						: undefined,
				plannedStartDate:
					plannedStartDate !== undefined
						? plannedStartDate
							? new Date(plannedStartDate)
							: null
						: undefined,
				plannedEndDate:
					plannedEndDate !== undefined
						? plannedEndDate
							? new Date(plannedEndDate)
							: null
						: undefined,
				engineerIncharge:
					engineerIncharge !== undefined ? engineerIncharge || null : undefined,
				consigneeId: consigneeId || undefined,
				status: status || undefined,
			},
		});

		return res.status(200).json(updated);
	} catch (error) {
		if (error.code === "P2002") {
			return res.status(409).json({ message: "Work with same LoA number already exists in division." });
		}
		return res.status(500).json({ error: error.message });
	}
};

export const deleteWorkExecution = async (req, res) => {
	if (!isWorkMaster(req)) {
		return res.status(403).json({ message: "Only testroom/admin can delete works." });
	}

	const { id } = req.params;

	try {
		const access = await ensureWorkAccess(req, id);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		await prisma.workExecution.delete({ where: { id } });
		return res.status(200).json({ message: "Work deleted successfully." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const createWorkItem = async (req, res) => {
	const { workId } = req.params;
	const {
		lineNo,
		scheduleCode,
		itemCode,
		itemName,
		rawDescription,
		category,
		uom,
		plannedQty,
		unitRate,
		plannedAmount,
	} = req.body;

	if (!itemName || !uom) {
		return res.status(400).json({ message: "itemName and uom are required." });
	}

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}
		if (!isConsignee(req, access) && !isSuperAdmin(req)) {
			return res.status(403).json({ message: "Only assigned consignee can create work items." });
		}

		const item = await prisma.workExecutionItem.create({
			data: {
				workId,
				lineNo: lineNo ? Number.parseInt(lineNo, 10) : null,
				scheduleCode: scheduleCode || null,
				itemCode: itemCode || null,
				itemName: String(itemName).trim(),
				rawDescription: rawDescription || null,
				category: category || "OTHER",
				uom: String(uom).trim(),
				plannedQty: parsePositive(plannedQty, 0),
				unitRate: parsePositive(unitRate),
				plannedAmount: parsePositive(plannedAmount),
			},
		});

		return res.status(201).json(item);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listWorkItems = async (req, res) => {
	const { workId } = req.params;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const items = await prisma.workExecutionItem.findMany({
			where: { workId, isActive: true },
			orderBy: [{ lineNo: "asc" }, { createdAt: "asc" }],
		});

		return res.status(200).json(items);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listWorkScope = async (req, res) => {
	const { workId } = req.params;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const [stationScopes, subsectionScopes] = await Promise.all([
			prisma.workExecutionStationScope.findMany({
				where: { workId },
				include: {
					station: {
						select: {
							id: true,
							name: true,
							code: true,
							supervisor: {
								select: { id: true, name: true, designation: true, role: true },
							},
						},
					},
				},
				orderBy: { createdAt: "asc" },
			}),
			prisma.workExecutionSubsectionScope.findMany({
				where: { workId },
				include: {
					subsection: {
						select: {
							id: true,
							name: true,
							code: true,
							supervisor: {
								select: { id: true, name: true, designation: true, role: true },
							},
						},
					},
				},
				orderBy: { createdAt: "asc" },
			}),
		]);

		return res.status(200).json({ stationScopes, subsectionScopes });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const saveWorkScope = async (req, res) => {
	const { workId } = req.params;
	const { stationIds = [], subsectionIds = [] } = req.body;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		if (!isConsignee(req, access) && !isWorkMaster(req) && !isSuperAdmin(req)) {
			return res.status(403).json({ message: "Only consignee or testroom/admin can update work scope." });
		}

		const uniqueStationIds = [...new Set((Array.isArray(stationIds) ? stationIds : []).filter(Boolean))];
		const uniqueSubsectionIds = [...new Set((Array.isArray(subsectionIds) ? subsectionIds : []).filter(Boolean))];

		if (uniqueStationIds.length > 0) {
			const validStations = await prisma.station.findMany({
				where: {
					id: { in: uniqueStationIds },
					divisionId: access.divisionId,
				},
				select: { id: true },
			});
			if (validStations.length !== uniqueStationIds.length) {
				return res.status(400).json({ message: "Invalid station in scope list for this division." });
			}
		}

		if (uniqueSubsectionIds.length > 0) {
			const validSubsections = await prisma.subsection.findMany({
				where: {
					id: { in: uniqueSubsectionIds },
					divisionId: access.divisionId,
				},
				select: { id: true },
			});
			if (validSubsections.length !== uniqueSubsectionIds.length) {
				return res.status(400).json({ message: "Invalid subsection in scope list for this division." });
			}
		}

		await prisma.$transaction(async (tx) => {
			await tx.workExecutionStationScope.deleteMany({ where: { workId } });
			await tx.workExecutionSubsectionScope.deleteMany({ where: { workId } });

			if (uniqueStationIds.length > 0) {
				await tx.workExecutionStationScope.createMany({
					data: uniqueStationIds.map((stationId) => ({ workId, stationId })),
					skipDuplicates: true,
				});
			}

			if (uniqueSubsectionIds.length > 0) {
				await tx.workExecutionSubsectionScope.createMany({
					data: uniqueSubsectionIds.map((subsectionId) => ({ workId, subsectionId })),
					skipDuplicates: true,
				});
			}
		});

		const [savedStationScopes, savedSubsectionScopes] = await Promise.all([
			prisma.workExecutionStationScope.findMany({
				where: { workId },
				include: {
					station: {
						select: { id: true, name: true, code: true },
					},
				},
				orderBy: { createdAt: "asc" },
			}),
			prisma.workExecutionSubsectionScope.findMany({
				where: { workId },
				include: {
					subsection: {
						select: { id: true, name: true, code: true },
					},
				},
				orderBy: { createdAt: "asc" },
			}),
		]);

		return res.status(200).json({
			message: "Work scope saved successfully.",
			stationScopes: savedStationScopes,
			subsectionScopes: savedSubsectionScopes,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const updateWorkItem = async (req, res) => {
	const { workId, itemId } = req.params;
	const {
		lineNo,
		scheduleCode,
		itemCode,
		itemName,
		rawDescription,
		category,
		uom,
		plannedQty,
		unitRate,
		plannedAmount,
		isActive,
	} = req.body;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}
		if (!isConsignee(req, access) && !isSuperAdmin(req)) {
			return res.status(403).json({ message: "Only assigned consignee can update work items." });
		}

		const existing = await prisma.workExecutionItem.findFirst({
			where: { id: itemId, workId },
			select: { id: true },
		});
		if (!existing) {
			return res.status(404).json({ message: "Work item not found." });
		}

		const updated = await prisma.workExecutionItem.update({
			where: { id: itemId },
			data: {
				lineNo: lineNo !== undefined ? Number.parseInt(lineNo, 10) : undefined,
				scheduleCode: scheduleCode !== undefined ? scheduleCode || null : undefined,
				itemCode: itemCode !== undefined ? itemCode || null : undefined,
				itemName: itemName !== undefined ? String(itemName).trim() : undefined,
				rawDescription:
					rawDescription !== undefined ? rawDescription || null : undefined,
				category: category || undefined,
				uom: uom !== undefined ? String(uom).trim() : undefined,
				plannedQty:
					plannedQty !== undefined ? parsePositive(plannedQty, 0) : undefined,
				unitRate: unitRate !== undefined ? parsePositive(unitRate) : undefined,
				plannedAmount:
					plannedAmount !== undefined ? parsePositive(plannedAmount) : undefined,
				isActive: typeof isActive === "boolean" ? isActive : undefined,
			},
		});

		return res.status(200).json(updated);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const createDemandRound = async (req, res) => {
	const { workId } = req.params;
	const { name, notes, opensAt, closesAt, status } = req.body;

	if (!name) {
		return res.status(400).json({ message: "Round name is required." });
	}

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}
		if (!isConsignee(req, access) && !isSuperAdmin(req)) {
			return res.status(403).json({ message: "Only assigned consignee can create demand rounds." });
		}

		const round = await prisma.workDemandRound.create({
			data: {
				workId,
				name: String(name).trim(),
				notes: notes || null,
				status: status || "OPEN",
				opensAt: opensAt ? new Date(opensAt) : new Date(),
				closesAt: closesAt ? new Date(closesAt) : null,
				createdById: req.user.id,
			},
			include: {
				createdBy: {
					select: { id: true, name: true, designation: true, role: true },
				},
			},
		});

		await prisma.workExecution.update({
			where: { id: workId },
			data: {
				status: round.status === "OPEN" ? "DEMAND_OPEN" : "DEMAND_CLOSED",
			},
		});

		return res.status(201).json(round);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const updateDemandRound = async (req, res) => {
	const { workId, roundId } = req.params;
	const { name, notes, opensAt, closesAt, status } = req.body;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}
		if (!isConsignee(req, access) && !isSuperAdmin(req)) {
			return res.status(403).json({ message: "Only assigned consignee can update demand rounds." });
		}

		const existing = await prisma.workDemandRound.findFirst({
			where: { id: roundId, workId },
			select: { id: true, status: true },
		});
		if (!existing) {
			return res.status(404).json({ message: "Demand round not found." });
		}

		const updated = await prisma.workDemandRound.update({
			where: { id: roundId },
			data: {
				name: name !== undefined ? String(name).trim() : undefined,
				notes: notes !== undefined ? notes || null : undefined,
				opensAt: opensAt !== undefined ? (opensAt ? new Date(opensAt) : null) : undefined,
				closesAt:
					closesAt !== undefined ? (closesAt ? new Date(closesAt) : null) : undefined,
				status: status || undefined,
			},
		});

		if (status === "OPEN" || status === "CLOSED") {
			await prisma.workExecution.update({
				where: { id: workId },
				data: {
					status: status === "OPEN" ? "DEMAND_OPEN" : "DEMAND_CLOSED",
				},
			});
		}

		return res.status(200).json(updated);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listDemandRounds = async (req, res) => {
	const { workId } = req.params;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const rounds = await prisma.workDemandRound.findMany({
			where: { workId },
			orderBy: [{ createdAt: "desc" }],
			include: {
				createdBy: {
					select: { id: true, name: true, designation: true, role: true },
				},
				_count: {
					select: { demands: true, allocations: true },
				},
			},
		});

		return res.status(200).json(rounds);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const submitWorkDemands = async (req, res) => {
	const { workId } = req.params;
	const { roundId, stationId, subsectionId, entries } = req.body;

	if (!roundId || !Array.isArray(entries) || entries.length === 0) {
		return res.status(400).json({ message: "roundId and entries[] are required." });
	}

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const role = getRole(req);
		const allowedSubmitter = FIELD_ROLES.has(role) || isConsignee(req, access) || isSuperAdmin(req);
		if (!allowedSubmitter) {
			return res.status(403).json({ message: "Only consignee/JE/SSE/field roles can submit demands." });
		}

		const round = await prisma.workDemandRound.findFirst({
			where: { id: roundId, workId },
			select: { id: true, status: true },
		});
		if (!round) {
			return res.status(404).json({ message: "Demand round not found for this work." });
		}
		if (round.status !== "OPEN") {
			return res.status(400).json({ message: "Demand round is closed." });
		}

		const scopeError = await validateScope({ req, stationId, subsectionId });
		if (scopeError) {
			return res.status(400).json({ message: scopeError });
		}

		const workScope = await getWorkScopeSets(workId);
		const targetScopeError = validateTargetAgainstWorkScope({
			stationId: stationId || null,
			subsectionId: subsectionId || null,
			scope: workScope,
		});
		if (targetScopeError) {
			return res.status(400).json({ message: targetScopeError });
		}

		const supervisorError = await validateSupervisorTargetAccess({
			req,
			stationId: stationId || null,
			subsectionId: subsectionId || null,
		});
		if (supervisorError) {
			return res.status(403).json({ message: supervisorError });
		}

		const itemIds = entries
			.map((entry) => entry?.itemId)
			.filter(Boolean);
		if (itemIds.length === 0) {
			return res.status(400).json({ message: "At least one itemId is required in entries." });
		}

		const validItems = await prisma.workExecutionItem.findMany({
			where: {
				workId,
				id: { in: itemIds },
				isActive: true,
			},
			select: { id: true },
		});
		const validItemIds = new Set(validItems.map((item) => item.id));

		const prepared = entries
			.map((entry) => ({
				itemId: entry.itemId,
				requestedQty: parsePositive(entry.requestedQty),
				remarks: entry.remarks || null,
			}))
			.filter((entry) => validItemIds.has(entry.itemId) && entry.requestedQty !== null);

		if (prepared.length === 0) {
			return res.status(400).json({ message: "No valid demand entries found." });
		}

		await prisma.$transaction(async (tx) => {
			await tx.workDemandEntry.deleteMany({
				where: {
					workId,
					roundId,
					requestedById: req.user.id,
					stationId: stationId || null,
					subsectionId: subsectionId || null,
				},
			});

			await tx.workDemandEntry.createMany({
				data: prepared.map((entry) => ({
					workId,
					roundId,
					itemId: entry.itemId,
					requestedById: req.user.id,
					stationId: stationId || null,
					subsectionId: subsectionId || null,
					requestedQty: entry.requestedQty,
					remarks: entry.remarks,
				})),
			});
		});

		return res.status(200).json({ message: "Demands submitted successfully." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listWorkDemands = async (req, res) => {
	const { workId } = req.params;
	const { roundId } = req.query;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const where = {
			workId,
			...(roundId ? { roundId } : {}),
		};

		const workScope = await getWorkScopeSets(workId);
		const scopeWhere = buildScopeWhere(workScope);
		if (scopeWhere) {
			where.AND = [...(where.AND || []), scopeWhere];
		}

		const canViewAll = isWorkMaster(req) || isConsignee(req, access) || isSuperAdmin(req);
		if (!canViewAll && FIELD_ROLES.has(getRole(req))) {
			where.requestedById = req.user.id;
		}

		const demands = await prisma.workDemandEntry.findMany({
			where,
			include: {
				item: { select: { id: true, itemName: true, uom: true, plannedQty: true } },
				requestedBy: {
					select: { id: true, name: true, designation: true, role: true },
				},
				station: { select: { id: true, name: true, code: true } },
				subsection: { select: { id: true, name: true, code: true } },
			},
			orderBy: [{ createdAt: "desc" }],
		});

		return res.status(200).json(demands);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const saveWorkAllocations = async (req, res) => {
	const { workId } = req.params;
	const { roundId, allocatedToId, stationId, subsectionId, entries } = req.body;

	if (!roundId || !allocatedToId || !Array.isArray(entries) || entries.length === 0) {
		return res.status(400).json({
			message: "roundId, allocatedToId and entries[] are required.",
		});
	}

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}
		if (!isConsignee(req, access) && !isSuperAdmin(req)) {
			return res.status(403).json({ message: "Only assigned consignee can save allocations." });
		}

		const round = await prisma.workDemandRound.findFirst({
			where: { id: roundId, workId },
			select: { id: true },
		});
		if (!round) {
			return res.status(404).json({ message: "Demand round not found for this work." });
		}

		const assignee = await prisma.user.findFirst({
			where: {
				id: allocatedToId,
				divisionId: access.divisionId,
			},
			select: { id: true },
		});
		if (!assignee) {
			return res.status(400).json({ message: "Allocated user is invalid for this division." });
		}

		const scopeError = await validateScope({ req, stationId, subsectionId });
		if (scopeError) {
			return res.status(400).json({ message: scopeError });
		}

		const workScope = await getWorkScopeSets(workId);
		const targetScopeError = validateTargetAgainstWorkScope({
			stationId: stationId || null,
			subsectionId: subsectionId || null,
			scope: workScope,
		});
		if (targetScopeError) {
			return res.status(400).json({ message: targetScopeError });
		}

		const itemIds = entries.map((entry) => entry?.itemId).filter(Boolean);
		const validItems = await prisma.workExecutionItem.findMany({
			where: { workId, id: { in: itemIds }, isActive: true },
			select: { id: true },
		});
		const validItemIds = new Set(validItems.map((item) => item.id));

		const prepared = entries
			.map((entry) => ({
				itemId: entry.itemId,
				allocatedQty: parsePositive(entry.allocatedQty),
				remarks: entry.remarks || null,
			}))
			.filter((entry) => validItemIds.has(entry.itemId) && entry.allocatedQty !== null);

		if (prepared.length === 0) {
			return res.status(400).json({ message: "No valid allocation entries found." });
		}

		await prisma.$transaction(async (tx) => {
			await tx.workAllocationEntry.deleteMany({
				where: {
					workId,
					roundId,
					allocatedToId,
					stationId: stationId || null,
					subsectionId: subsectionId || null,
				},
			});

			await tx.workAllocationEntry.createMany({
				data: prepared.map((entry) => ({
					workId,
					roundId,
					itemId: entry.itemId,
					allocatedToId,
					allocatedById: req.user.id,
					stationId: stationId || null,
					subsectionId: subsectionId || null,
					allocatedQty: entry.allocatedQty,
					remarks: entry.remarks,
				})),
			});
		});

		await prisma.workExecution.update({
			where: { id: workId },
			data: { status: "ALLOCATED" },
		});

		return res.status(200).json({ message: "Allocations saved successfully." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listWorkAllocations = async (req, res) => {
	const { workId } = req.params;
	const { roundId } = req.query;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const where = {
			workId,
			...(roundId ? { roundId } : {}),
		};

		const workScope = await getWorkScopeSets(workId);
		const scopeWhere = buildScopeWhere(workScope);
		if (scopeWhere) {
			where.AND = [...(where.AND || []), scopeWhere];
		}

		const canViewAll = isWorkMaster(req) || isConsignee(req, access) || isSuperAdmin(req);
		if (!canViewAll && FIELD_ROLES.has(getRole(req))) {
			where.allocatedToId = req.user.id;
		}

		const allocations = await prisma.workAllocationEntry.findMany({
			where,
			include: {
				item: { select: { id: true, itemName: true, uom: true, plannedQty: true } },
				allocatedTo: {
					select: { id: true, name: true, designation: true, role: true },
				},
				allocatedBy: {
					select: { id: true, name: true, designation: true, role: true },
				},
				station: { select: { id: true, name: true, code: true } },
				subsection: { select: { id: true, name: true, code: true } },
			},
			orderBy: [{ createdAt: "desc" }],
		});

		return res.status(200).json(allocations);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listWorkProgress = async (req, res) => {
	const { workId } = req.params;
	const { roundId } = req.query;

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const where = {
			workId,
			...(roundId ? { roundId } : {}),
		};

		const workScope = await getWorkScopeSets(workId);
		const scopeWhere = buildScopeWhere(workScope);
		if (scopeWhere) {
			where.AND = [...(where.AND || []), scopeWhere];
		}

		const canViewAll = isWorkMaster(req) || isConsignee(req, access) || isSuperAdmin(req);
		if (!canViewAll && FIELD_ROLES.has(getRole(req))) {
			where.reportedById = req.user.id;
		}

		const progress = await prisma.workProgressEntry.findMany({
			where,
			include: {
				item: { select: { id: true, itemName: true, category: true, uom: true, plannedQty: true } },
				reportedBy: { select: { id: true, name: true, designation: true, role: true } },
				station: { select: { id: true, name: true, code: true } },
				subsection: { select: { id: true, name: true, code: true } },
				linkedEquipment: {
					select: {
						id: true,
						name: true,
						serialNumber: true,
						template: { select: { id: true, modelName: true } },
						station: { select: { id: true, name: true, code: true } },
					},
				},
			},
			orderBy: [{ progressDate: "desc" }, { createdAt: "desc" }],
		});

		return res.status(200).json(progress);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const addWorkProgress = async (req, res) => {
	const { workId } = req.params;
	const {
		roundId,
		itemId,
		stationId,
		subsectionId,
		quantity,
		remarks,
		progressDate,
		equipment,
	} = req.body;

	if (!itemId || quantity === undefined || quantity === null) {
		return res.status(400).json({ message: "itemId and quantity are required." });
	}

	try {
		const access = await ensureWorkAccess(req, workId);
		if (!access) {
			return res.status(404).json({ message: "Work not found." });
		}
		if (access === "FORBIDDEN") {
			return res.status(403).json({ message: "Forbidden: this work does not belong to your division." });
		}

		const role = getRole(req);
		const allowedSubmitter = FIELD_ROLES.has(role) || isConsignee(req, access) || isSuperAdmin(req);
		if (!allowedSubmitter) {
			return res.status(403).json({ message: "Only consignee/JE/SSE/field roles can add progress." });
		}

		const parsedQty = parsePositive(quantity);
		if (parsedQty === null || parsedQty <= 0) {
			return res.status(400).json({ message: "quantity must be greater than 0." });
		}

		const scopeError = await validateScope({ req, stationId, subsectionId });
		if (scopeError) {
			return res.status(400).json({ message: scopeError });
		}

		const workScope = await getWorkScopeSets(workId);
		const targetScopeError = validateTargetAgainstWorkScope({
			stationId: stationId || null,
			subsectionId: subsectionId || null,
			scope: workScope,
		});
		if (targetScopeError) {
			return res.status(400).json({ message: targetScopeError });
		}

		const supervisorError = await validateSupervisorTargetAccess({
			req,
			stationId: stationId || null,
			subsectionId: subsectionId || null,
		});
		if (supervisorError) {
			return res.status(403).json({ message: supervisorError });
		}

		const workItem = await prisma.workExecutionItem.findFirst({
			where: {
				id: itemId,
				workId,
				isActive: true,
			},
			select: { id: true, category: true, plannedQty: true, uom: true },
		});

		if (!workItem) {
			return res.status(404).json({ message: "Work item not found for selected work." });
		}

		if (roundId) {
			const round = await prisma.workDemandRound.findFirst({
				where: { id: roundId, workId },
				select: { id: true },
			});
			if (!round) {
				return res.status(404).json({ message: "Demand round not found for this work." });
			}
		}

		if (equipment && workItem.category !== "EQUIPMENT") {
			return res.status(400).json({ message: "Equipment details are only allowed for EQUIPMENT category." });
		}
		if (equipment && parsedQty !== 1) {
			return res.status(400).json({ message: "For equipment installation, quantity must be 1 per entry." });
		}
		if (equipment?.rackId) {
			const validRack = await prisma.rack.findFirst({
				where: {
					id: equipment.rackId,
					location: stationId ? { stationId } : undefined,
				},
				select: { id: true },
			});
			if (!validRack) {
				return res.status(400).json({
					message: "Selected rack does not belong to the selected station.",
				});
			}
		}

		const targetWhere = {
			stationId: stationId || null,
			subsectionId: subsectionId || null,
		};

		const [allocationRows, allocationCount] = await Promise.all([
			prisma.workAllocationEntry.findMany({
				where: {
					workId,
					itemId,
					...(roundId ? { roundId } : {}),
					...targetWhere,
				},
				select: { allocatedQty: true },
			}),
			prisma.workAllocationEntry.count({
				where: {
					workId,
					itemId,
					...(roundId ? { roundId } : {}),
				},
			}),
		]);

		let finalizedQty = 0;
		if (allocationRows.length > 0) {
			finalizedQty = sumBy(allocationRows, "allocatedQty");
		} else if (allocationCount === 0 && !workScope.hasAnyScope) {
			finalizedQty = Number(workItem.plannedQty || 0);
		}

		const progressRows = await prisma.workProgressEntry.findMany({
			where: {
				workId,
				itemId,
				...(roundId ? { roundId } : {}),
				...targetWhere,
			},
			select: { quantity: true },
		});
		const executedQty = sumBy(progressRows, "quantity");
		if (finalizedQty > 0 && executedQty + parsedQty > finalizedQty + 0.0001) {
			return res.status(400).json({
				message: `Progress exceeds finalized quantity. Executed: ${executedQty}, Finalized: ${finalizedQty}.`,
			});
		}
		if (finalizedQty <= 0) {
			return res.status(400).json({
				message:
					"No finalized quantity found for the selected station/subsection. Save allocation first.",
			});
		}

		const created = await prisma.$transaction(async (tx) => {
			let linkedEquipmentId = null;

			if (equipment) {
				const {
					name,
					description,
					providedBy,
					serialNumber,
					templateId,
					rackId,
					uPosition,
					installationDate,
				} = equipment;

				if (!templateId || !stationId || !name) {
					throw new Error("For equipment progress, templateId, stationId and name are required.");
				}

				const template = await tx.equipmentTemplate.findUnique({
					where: { id: templateId },
					include: {
						portConfigs: {
							include: { portTemplate: true },
						},
					},
				});
				if (!template) {
					throw new Error("Equipment template not found.");
				}

				const createData = {
					name: String(name).trim(),
					description: description || "",
					providedBy: providedBy || "Indian Railways",
					serialNumber: serialNumber || null,
					uPosition: uPosition ? Number.parseInt(uPosition, 10) : null,
					installationDate: installationDate ? new Date(installationDate) : null,
					status: "OPERATIONAL",
					mapX: null,
					mapY: null,
					template: { connect: { id: templateId } },
					station: { connect: { id: stationId } },
					createdBy: { connect: { id: req.user.id } },
				};

				if (rackId) {
					createData.rack = { connect: { id: rackId } };
				}

				const equipmentRow = await tx.equipment.create({ data: createData });
				linkedEquipmentId = equipmentRow.id;

				const portData = [];
				template.portConfigs.forEach((config) => {
					for (let i = 1; i <= config.quantity; i += 1) {
						portData.push({
							name: `${config.portTemplate.name} ${i}`,
							equipmentId: equipmentRow.id,
							templateId: config.portTemplateId,
							status: "FREE",
						});
					}
				});

				if (portData.length > 0) {
					await tx.port.createMany({ data: portData });
				}
			}

			return tx.workProgressEntry.create({
				data: {
					workId,
					roundId: roundId || null,
					itemId,
					reportedById: req.user.id,
					stationId: stationId || null,
					subsectionId: subsectionId || null,
					quantity: parsedQty,
					remarks: remarks || null,
					progressDate: progressDate ? new Date(progressDate) : new Date(),
					linkedEquipmentId,
				},
				include: {
					item: { select: { id: true, itemName: true, category: true, uom: true } },
					reportedBy: { select: { id: true, name: true, designation: true, role: true } },
					station: { select: { id: true, name: true, code: true } },
					subsection: { select: { id: true, name: true, code: true } },
					linkedEquipment: {
						select: {
							id: true,
							name: true,
							serialNumber: true,
							template: { select: { id: true, modelName: true } },
						},
					},
				},
			});
		});

		return res.status(201).json(created);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};
