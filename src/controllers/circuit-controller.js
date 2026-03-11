import prisma from "../lib/prisma.js";

const ENGINEER_ROLES = new Set(["JE_SSE_TELE_SECTIONAL", "SSE_TELE_INCHARGE"]);
const APPROVER_ROLES = new Set(["TESTROOM", "ADMIN", "SUPER_ADMIN"]);
const FIELD_TYPES = new Set(["TEXT", "NUMBER", "BOOLEAN", "SELECT"]);

const ensureCircuitPrismaDelegates = (res) => {
	if (!prisma.divisionCircuitMaster || !prisma.stationCircuit) {
		res.status(500).json({
			message:
				"Prisma client is out of date for circuit models. Run `npx prisma generate` and restart backend.",
		});
		return false;
	}
	return true;
};

const normalizeCode = (value = "") =>
	String(value)
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

const slugify = (value = "") =>
	String(value)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

const normalizeChecklistSchema = (rawSchema) => {
	if (!Array.isArray(rawSchema) || rawSchema.length === 0) {
		throw new Error("checklistSchema must be a non-empty array.");
	}

	const seenKeys = new Set();
	return rawSchema.map((item, index) => {
		const label = String(item?.label || "").trim();
		if (!label) throw new Error(`Field label is required at row ${index + 1}.`);

		const key = slugify(item?.key || label);
		if (!key) throw new Error(`Field key is invalid at row ${index + 1}.`);
		if (seenKeys.has(key))
			throw new Error(`Duplicate field key "${key}" in checklistSchema.`);
		seenKeys.add(key);

		const type = String(item?.type || "TEXT")
			.trim()
			.toUpperCase();
		if (!FIELD_TYPES.has(type)) {
			throw new Error(`Unsupported field type "${type}" for ${label}.`);
		}

		const options =
			type === "SELECT"
				? Array.isArray(item?.options)
					? item.options.map((opt) => String(opt).trim()).filter(Boolean)
					: []
				: [];
		if (type === "SELECT" && options.length === 0) {
			throw new Error(`SELECT field "${label}" must define options.`);
		}

		return {
			key,
			label,
			type,
			required: Boolean(item?.required),
			unit: item?.unit ? String(item.unit).trim() : null,
			options,
			order: index + 1,
		};
	});
};

const assertEngineerUser = async (userId, divisionId) => {
	const user = await prisma.user.findFirst({
		where: {
			id: userId,
			divisionId,
			role: { in: Array.from(ENGINEER_ROLES) },
		},
		select: { id: true },
	});
	return Boolean(user);
};

const resolveActiveDivisionId = async (
	req,
	{ allowBodyOverride = false } = {},
) => {
	const dbUser = await prisma.user.findUnique({
		where: { id: req.user.id },
		select: { id: true, divisionId: true, role: true },
	});

	if (!dbUser) {
		return { error: "Session user not found. Please login again." };
	}

	const role = req.user.role || dbUser.role;
	const divisionId =
		allowBodyOverride && role === "SUPER_ADMIN"
			? req.body?.divisionId || req.user?.divisionId || dbUser.divisionId
			: dbUser.divisionId || req.user?.divisionId;

	if (!divisionId) {
		return { error: "Division is not mapped to current user." };
	}

	const division = await prisma.division.findUnique({
		where: { id: divisionId },
		select: { id: true },
	});

	if (!division) {
		return {
			error:
				"Invalid division context. Please login again or select a valid division.",
		};
	}

	return { divisionId };
};

export const listDivisionCircuitMasters = async (req, res) => {
	if (!ensureCircuitPrismaDelegates(res)) return;
	const includeInactive = req.query.includeInactive === "true";
	const { divisionId, role } = req.user;

	try {
		const masters = await prisma.divisionCircuitMaster.findMany({
			where: {
				...(role === "SUPER_ADMIN" ? {} : { divisionId }),
				...(includeInactive ? {} : { isActive: true }),
			},
			include: {
				createdBy: { select: { id: true, name: true, role: true } },
				_count: { select: { stationCircuits: true } },
			},
			orderBy: [{ code: "asc" }],
		});
		return res.status(200).json(masters);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const createDivisionCircuitMaster = async (req, res) => {
	if (!ensureCircuitPrismaDelegates(res)) return;
	const {
		code,
		name,
		description,
		checklistSchema,
		isActive = true,
	} = req.body;
	const normalizedCode = normalizeCode(code || name);
	if (!normalizedCode || !String(name || "").trim()) {
		return res.status(400).json({ message: "code and name are required." });
	}

	try {
		const divisionContext = await resolveActiveDivisionId(req, {
			allowBodyOverride: true,
		});
		if (divisionContext.error) {
			return res.status(400).json({ message: divisionContext.error });
		}

		const normalizedSchema = normalizeChecklistSchema(checklistSchema);
		const created = await prisma.divisionCircuitMaster.create({
			data: {
				code: normalizedCode,
				name: String(name).trim(),
				description: description ? String(description).trim() : null,
				checklistSchema: normalizedSchema,
				isActive: Boolean(isActive),
				divisionId: divisionContext.divisionId,
				createdById: req.user.id,
			},
			include: {
				createdBy: { select: { id: true, name: true } },
			},
		});
		return res.status(201).json(created);
	} catch (error) {
		if (error.code === "P2002") {
			return res
				.status(409)
				.json({ message: "Circuit code already exists in this division." });
		}
		return res.status(500).json({ error: error.message });
	}
};

export const updateDivisionCircuitMaster = async (req, res) => {
	if (!ensureCircuitPrismaDelegates(res)) return;
	const { id } = req.params;
	const { code, name, description, checklistSchema, isActive } = req.body;
	const { divisionId, role } = req.user;

	try {
		const existing = await prisma.divisionCircuitMaster.findUnique({
			where: { id },
		});
		if (!existing)
			return res.status(404).json({ message: "Circuit master not found." });
		if (role !== "SUPER_ADMIN" && existing.divisionId !== divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const data = {
			code: code ? normalizeCode(code) : undefined,
			name: name ? String(name).trim() : undefined,
			description:
				description !== undefined
					? String(description || "").trim() || null
					: undefined,
			isActive: isActive !== undefined ? Boolean(isActive) : undefined,
		};
		if (checklistSchema !== undefined) {
			data.checklistSchema = normalizeChecklistSchema(checklistSchema);
		}

		const updated = await prisma.divisionCircuitMaster.update({
			where: { id },
			data,
		});
		return res.status(200).json(updated);
	} catch (error) {
		if (error.code === "P2002") {
			return res
				.status(409)
				.json({ message: "Circuit code already exists in this division." });
		}
		return res.status(500).json({ error: error.message });
	}
};

export const deactivateDivisionCircuitMaster = async (req, res) => {
	if (!ensureCircuitPrismaDelegates(res)) return;
	const { id } = req.params;
	const { divisionId, role } = req.user;
	try {
		const existing = await prisma.divisionCircuitMaster.findUnique({
			where: { id },
		});
		if (!existing)
			return res.status(404).json({ message: "Circuit master not found." });
		if (role !== "SUPER_ADMIN" && existing.divisionId !== divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const updated = await prisma.divisionCircuitMaster.update({
			where: { id },
			data: { isActive: false },
		});
		return res.status(200).json(updated);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listStationCircuits = async (req, res) => {
	if (!ensureCircuitPrismaDelegates(res)) return;
	const { status, stationId } = req.query;
	const { divisionId, role, id: userId } = req.user;

	try {
		const where = {
			...(role === "SUPER_ADMIN" ? {} : { station: { divisionId } }),
			...(status ? { status } : {}),
			...(stationId ? { stationId } : {}),
		};

		if (!APPROVER_ROLES.has(role)) {
			where.OR = [
				{ maintainedById: userId },
				{ requestedById: userId },
				{ station: { supervisorId: userId } },
			];
		}

		const circuits = await prisma.stationCircuit.findMany({
			where,
			include: {
				station: {
					select: { id: true, name: true, code: true, supervisorId: true },
				},
				location: { select: { id: true, name: true } },
				circuitMaster: {
					select: {
						id: true,
						code: true,
						name: true,
						description: true,
						checklistSchema: true,
						isActive: true,
					},
				},
				maintainedBy: {
					select: { id: true, name: true, role: true, designation: true },
				},
				requestedBy: {
					select: { id: true, name: true, role: true, designation: true },
				},
				approvedBy: {
					select: { id: true, name: true, role: true, designation: true },
				},
			},
			orderBy: [{ createdAt: "desc" }],
		});

		return res.status(200).json(circuits);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const createStationCircuit = async (req, res) => {
	if (!ensureCircuitPrismaDelegates(res)) return;
	const { stationId, locationId, circuitMasterId, identifier, maintainedById } =
		req.body;
	const { id: userId, role, divisionId } = req.user;

	if (!stationId || !circuitMasterId) {
		return res
			.status(400)
			.json({ message: "stationId and circuitMasterId are required." });
	}

	try {
		const station = await prisma.station.findFirst({
			where: {
				id: stationId,
				divisionId: role === "SUPER_ADMIN" ? undefined : divisionId,
			},
			select: { id: true, supervisorId: true, divisionId: true },
		});
		if (!station)
			return res
				.status(400)
				.json({ message: "Invalid station for your division." });

		const master = await prisma.divisionCircuitMaster.findFirst({
			where: {
				id: circuitMasterId,
				divisionId: role === "SUPER_ADMIN" ? station.divisionId : divisionId,
				isActive: true,
			},
			select: { id: true },
		});
		if (!master) {
			return res
				.status(400)
				.json({ message: "Invalid or inactive circuit master." });
		}

		if (locationId) {
			const location = await prisma.location.findFirst({
				where: { id: locationId, stationId },
				select: { id: true },
			});
			if (!location)
				return res
					.status(400)
					.json({ message: "Location does not belong to selected station." });
		}

		const isApprover = APPROVER_ROLES.has(role);
		const isEngineer = ENGINEER_ROLES.has(role);
		if (!isApprover && !isEngineer) {
			return res
				.status(403)
				.json({ message: "Only JE/SSE or Testroom/Admin can add circuits." });
		}

		let resolvedMaintainedById = maintainedById || userId;
		if (isEngineer && maintainedById && maintainedById !== userId) {
			return res
				.status(400)
				.json({ message: "You can only assign circuits to yourself." });
		}

		if (isEngineer && station.supervisorId !== userId) {
			return res.status(403).json({
				message: "You can only add circuits for your supervised stations.",
			});
		}

		if (isApprover && !maintainedById) {
			resolvedMaintainedById = station.supervisorId || userId;
		}

		const validMaintainer = await assertEngineerUser(
			resolvedMaintainedById,
			station.divisionId,
		);
		if (!validMaintainer) {
			return res.status(400).json({
				message: "maintainedBy must be a JE/SSE user in this division.",
			});
		}

		const normalizedIdentifier = identifier ? String(identifier).trim() : null;
		const existing = await prisma.stationCircuit.findFirst({
			where: {
				stationId,
				circuitMasterId,
				identifier: normalizedIdentifier,
				status: { in: ["PENDING", "APPROVED"] },
			},
			select: { id: true },
		});
		if (existing) {
			return res.status(409).json({
				message:
					"Same circuit mapping already exists in pending/approved state.",
			});
		}

		const created = await prisma.stationCircuit.create({
			data: {
				stationId,
				locationId: locationId || null,
				circuitMasterId,
				identifier: normalizedIdentifier,
				maintainedById: resolvedMaintainedById,
				requestedById: userId,
				status: isApprover ? "APPROVED" : "PENDING",
				approvedById: isApprover ? userId : null,
				approvedAt: isApprover ? new Date() : null,
			},
			include: {
				station: { select: { id: true, name: true, code: true } },
				location: { select: { id: true, name: true } },
				circuitMaster: {
					select: {
						id: true,
						code: true,
						name: true,
						checklistSchema: true,
						isActive: true,
					},
				},
				maintainedBy: {
					select: { id: true, name: true, role: true, designation: true },
				},
				requestedBy: {
					select: { id: true, name: true, role: true, designation: true },
				},
				approvedBy: {
					select: { id: true, name: true, role: true, designation: true },
				},
			},
		});

		return res.status(201).json(created);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const approveStationCircuit = async (req, res) => {
	if (!ensureCircuitPrismaDelegates(res)) return;
	const { id } = req.params;
	const { maintainedById } = req.body;
	const { divisionId, role, id: approverId } = req.user;
	try {
		const circuit = await prisma.stationCircuit.findUnique({
			where: { id },
			include: { station: { select: { divisionId: true } } },
		});
		if (!circuit)
			return res.status(404).json({ message: "Station circuit not found." });
		if (role !== "SUPER_ADMIN" && circuit.station.divisionId !== divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}
		if (circuit.status === "APPROVED") {
			return res.status(400).json({ message: "Circuit already approved." });
		}

		const resolvedMaintainerId = maintainedById || circuit.maintainedById;
		const validMaintainer = await assertEngineerUser(
			resolvedMaintainerId,
			circuit.station.divisionId,
		);
		if (!validMaintainer) {
			return res.status(400).json({
				message: "maintainedBy must be a JE/SSE user in this division.",
			});
		}

		const updated = await prisma.stationCircuit.update({
			where: { id },
			data: {
				maintainedById: resolvedMaintainerId,
				status: "APPROVED",
				approvedById: approverId,
				approvedAt: new Date(),
				rejectionReason: null,
			},
		});
		return res.status(200).json(updated);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const rejectStationCircuit = async (req, res) => {
	if (!ensureCircuitPrismaDelegates(res)) return;
	const { id } = req.params;
	const { reason } = req.body;
	const { divisionId, role, id: approverId } = req.user;
	if (!String(reason || "").trim()) {
		return res
			.status(400)
			.json({ message: "reason is required for rejection." });
	}
	try {
		const circuit = await prisma.stationCircuit.findUnique({
			where: { id },
			include: { station: { select: { divisionId: true } } },
		});
		if (!circuit)
			return res.status(404).json({ message: "Station circuit not found." });
		if (role !== "SUPER_ADMIN" && circuit.station.divisionId !== divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const updated = await prisma.stationCircuit.update({
			where: { id },
			data: {
				status: "REJECTED",
				approvedById: approverId,
				approvedAt: new Date(),
				rejectionReason: String(reason).trim(),
			},
		});
		return res.status(200).json(updated);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};
