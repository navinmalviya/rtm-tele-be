import prisma from "../lib/prisma.js";

const MAX_DURATION_MINUTES = 60 * 24 * 30;
const MIN_DURATION_MINUTES = 1;

const ESCALATION_TARGET_ROLES = new Set([
	"TCM",
	"TECHNICIAN",
	"JE_SSE_TELE_SECTIONAL",
	"SSE_TELE_INCHARGE",
	"ADSTE",
	"DSTE",
	"SR_DSTE",
	"ADMIN",
	"TESTROOM",
]);

const toPositiveInt = (value) => {
	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getScopedDivisionId = (req) => {
	if (req.user.role === "SUPER_ADMIN") {
		return req.query.divisionId || req.body.divisionId || req.user.divisionId;
	}
	return req.user.divisionId;
};

const validatePayload = ({ level, targetRole, durationMinutes }) => {
	const normalizedRole = String(targetRole || "").trim().toUpperCase();
	const parsedLevel = toPositiveInt(level);
	const parsedDuration = toPositiveInt(durationMinutes);

	if (!parsedLevel) {
		return { error: "level must be a positive integer." };
	}

	if (!ESCALATION_TARGET_ROLES.has(normalizedRole)) {
		return { error: "Invalid targetRole for escalation." };
	}

	if (!parsedDuration) {
		return { error: "durationMinutes must be a positive integer." };
	}

	if (
		parsedDuration < MIN_DURATION_MINUTES ||
		parsedDuration > MAX_DURATION_MINUTES
	) {
		return {
			error: `durationMinutes must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}.`,
		};
	}

	return {
		parsed: {
			level: parsedLevel,
			targetRole: normalizedRole,
			durationMinutes: parsedDuration,
		},
	};
};

export const listEscalationMatrix = async (req, res) => {
	try {
		const divisionId = getScopedDivisionId(req);
		if (!divisionId) {
			return res.status(400).json({ message: "divisionId is required." });
		}

		const rows = await prisma.escalationMatrix.findMany({
			where: { divisionId },
			include: {
				createdBy: {
					select: {
						id: true,
						name: true,
						designation: true,
						role: true,
					},
				},
			},
			orderBy: [{ level: "asc" }, { createdAt: "asc" }],
		});

		return res.status(200).json(rows);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const createEscalationMatrix = async (req, res) => {
	const divisionId = getScopedDivisionId(req);
	const { level, targetRole, durationMinutes, isActive } = req.body;

	if (!divisionId) {
		return res.status(400).json({ message: "divisionId is required." });
	}

	const { error, parsed } = validatePayload({
		level,
		targetRole,
		durationMinutes,
	});
	if (error) {
		return res.status(400).json({ message: error });
	}

	try {
		const created = await prisma.escalationMatrix.create({
			data: {
				divisionId,
				level: parsed.level,
				targetRole: parsed.targetRole,
				durationMinutes: parsed.durationMinutes,
				isActive: typeof isActive === "boolean" ? isActive : true,
				createdById: req.user.id,
			},
			include: {
				createdBy: {
					select: {
						id: true,
						name: true,
						designation: true,
						role: true,
					},
				},
			},
		});
		return res.status(201).json(created);
	} catch (error) {
		if (error.code === "P2002") {
			return res
				.status(409)
				.json({ message: "Escalation level already exists for this division." });
		}
		return res.status(500).json({ error: error.message });
	}
};

export const updateEscalationMatrix = async (req, res) => {
	const { id } = req.params;
	const { level, targetRole, durationMinutes, isActive } = req.body;
	const divisionId = getScopedDivisionId(req);

	if (!divisionId) {
		return res.status(400).json({ message: "divisionId is required." });
	}

	const payload = {};

	if (
		level !== undefined ||
		targetRole !== undefined ||
		durationMinutes !== undefined
	) {
		const { error, parsed } = validatePayload({
			level,
			targetRole,
			durationMinutes,
		});
		if (error) {
			return res.status(400).json({ message: error });
		}
		payload.level = parsed.level;
		payload.targetRole = parsed.targetRole;
		payload.durationMinutes = parsed.durationMinutes;
	}

	if (typeof isActive === "boolean") {
		payload.isActive = isActive;
	}

	try {
		const existing = await prisma.escalationMatrix.findFirst({
			where: { id, divisionId },
			select: { id: true },
		});
		if (!existing) {
			return res.status(404).json({ message: "Escalation entry not found." });
		}

		const updated = await prisma.escalationMatrix.update({
			where: { id },
			data: payload,
			include: {
				createdBy: {
					select: {
						id: true,
						name: true,
						designation: true,
						role: true,
					},
				},
			},
		});
		return res.status(200).json(updated);
	} catch (error) {
		if (error.code === "P2002") {
			return res
				.status(409)
				.json({ message: "Escalation level already exists for this division." });
		}
		return res.status(500).json({ error: error.message });
	}
};

export const deleteEscalationMatrix = async (req, res) => {
	const { id } = req.params;
	const divisionId = getScopedDivisionId(req);

	if (!divisionId) {
		return res.status(400).json({ message: "divisionId is required." });
	}

	try {
		const existing = await prisma.escalationMatrix.findFirst({
			where: { id, divisionId },
			select: { id: true },
		});
		if (!existing) {
			return res.status(404).json({ message: "Escalation entry not found." });
		}

		await prisma.escalationMatrix.delete({ where: { id } });
		return res
			.status(200)
			.json({ message: "Escalation entry deleted successfully." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};
