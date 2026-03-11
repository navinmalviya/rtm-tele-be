import { addFrequency, normalizeRemindBeforeDays } from "../lib/maintenance.js";
import { runMaintenanceRemindersJob } from "../lib/maintenance-runner.js";
import prisma from "../lib/prisma.js";

const FIELD_SUPERVISOR_ROLES = new Set([
	"JE_SSE_TELE_SECTIONAL",
	"SSE_TELE_INCHARGE",
]);
const DEFAULT_SCOPE_BY_TYPE = {
	STATION_INSPECTION_MAINTENANCE: "STATION",
	CABLE_TESTING: "SUBSECTION",
	EC_SOCKET_TESTING: "SUBSECTION",
	CUSTOM: "STATION",
};
const TYPE_LABELS = {
	STATION_INSPECTION_MAINTENANCE: "Station Inspection & Maintenance",
	CABLE_TESTING: "Cable Testing",
	EC_SOCKET_TESTING: "EC Socket Testing",
	CUSTOM: "Custom Schedule",
};
const DEFAULT_ESCALATION_ROLE = "SSE_TELE_INCHARGE";
const APPROVER_ROLES = new Set(["TESTROOM", "ADMIN", "SUPER_ADMIN"]);

const parseDate = (value) => {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

const toInt = (value, fallback) => {
	if (value === undefined || value === null || value === "") return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeChecklistResponses = (responses) =>
	Array.isArray(responses) ? responses : [];

const isMissingRequiredValue = (fieldType, value) => {
	if (fieldType === "BOOLEAN") return value !== true && value !== false;
	if (value === null || value === undefined) return true;
	if (typeof value === "string" && value.trim() === "") return true;
	return false;
};

const normalizeScope = (scheduleType, scope) => {
	if (scope) return scope;
	return DEFAULT_SCOPE_BY_TYPE[scheduleType] || "STATION";
};

const buildTitle = ({ title, scheduleType, stationName, subsectionCode }) => {
	if (title?.trim()) return title.trim();
	const base = TYPE_LABELS[scheduleType] || "Maintenance Schedule";
	if (subsectionCode) return `${base} • ${subsectionCode}`;
	if (stationName) return `${base} • ${stationName}`;
	return base;
};

const assertValidSupervisor = async (supervisorId, divisionId) => {
	const supervisor = await prisma.user.findFirst({
		where: {
			id: supervisorId,
			divisionId,
			role: { in: Array.from(FIELD_SUPERVISOR_ROLES) },
		},
		select: { id: true },
	});
	return Boolean(supervisor);
};

const createScheduleWithFirstOccurrence = async (tx, data, dueDate) => {
	const created = await tx.maintenanceSchedule.create({ data });
	await tx.maintenanceOccurrence.create({
		data: {
			scheduleId: created.id,
			dueDate,
			status: "OPEN",
		},
	});
	return created;
};

const ensureScheduleDivisionAccess = async (scheduleId, reqUser) => {
	const schedule = await prisma.maintenanceSchedule.findUnique({
		where: { id: scheduleId },
		include: { station: { select: { divisionId: true } } },
	});
	if (!schedule) return null;
	if (
		reqUser.role !== "SUPER_ADMIN" &&
		schedule.station?.divisionId !== reqUser.divisionId
	) {
		return "FORBIDDEN";
	}
	return schedule;
};

const createOneScheduleFromPayload = async ({ payload, reqUser, dueDate }) => {
	const {
		title,
		description,
		scheduleType,
		targetScope,
		frequency,
		jointFrequency,
		isJointSchedule,
		jointDepartment,
		remindBeforeDays,
		stationId,
		subsectionId,
		equipmentId,
		locationId,
		supervisorId,
		allowedVarianceDays,
		escalationRole,
	} = payload;

	let resolvedStationId = stationId || null;
	let resolvedSubsectionId = subsectionId || null;
	let resolvedSupervisorId = supervisorId || null;
	let stationName = null;
	let subsectionCode = null;

	if (targetScope === "SUBSECTION") {
		if (!resolvedSubsectionId) {
			throw new Error("subsectionId is required for subsection schedules.");
		}
		const subsection = await prisma.subsection.findFirst({
			where: {
				id: resolvedSubsectionId,
				divisionId:
					reqUser.role === "SUPER_ADMIN" ? undefined : reqUser.divisionId,
			},
			select: { id: true, code: true, fromStationId: true, supervisorId: true },
		});
		if (!subsection) {
			throw new Error("Invalid subsection for your division.");
		}
		resolvedStationId = subsection.fromStationId;
		resolvedSupervisorId = resolvedSupervisorId || subsection.supervisorId;
		subsectionCode = subsection.code;
	} else {
		if (!resolvedStationId) {
			throw new Error("stationId is required for station schedules.");
		}
		const station = await prisma.station.findFirst({
			where: {
				id: resolvedStationId,
				divisionId:
					reqUser.role === "SUPER_ADMIN" ? undefined : reqUser.divisionId,
			},
			select: { id: true, name: true, supervisorId: true },
		});
		if (!station) {
			throw new Error("Invalid station for your division.");
		}
		stationName = station.name;
		resolvedSupervisorId = resolvedSupervisorId || station.supervisorId;
		resolvedSubsectionId = null;
	}

	if (!resolvedSupervisorId) {
		throw new Error("Supervisor is required for schedule assignment.");
	}

	const validSupervisor = await assertValidSupervisor(
		resolvedSupervisorId,
		reqUser.divisionId,
	);
	if (!validSupervisor) {
		throw new Error(
			"Supervisor must be JE/SSE sectional user of your division.",
		);
	}

	const scheduleTitle = buildTitle({
		title,
		scheduleType,
		stationName,
		subsectionCode,
	});

	const scheduleData = {
		title: scheduleTitle,
		description: description || null,
		scheduleType,
		targetScope,
		frequency,
		jointFrequency: isJointSchedule ? jointFrequency || frequency : null,
		isJointSchedule: Boolean(isJointSchedule),
		jointDepartment: isJointSchedule ? jointDepartment || null : null,
		nextDueDate: dueDate,
		allowedVarianceDays,
		remindBeforeDays: normalizeRemindBeforeDays(remindBeforeDays),
		escalationRole: escalationRole || DEFAULT_ESCALATION_ROLE,
		station: { connect: { id: resolvedStationId } },
		subsection: resolvedSubsectionId
			? { connect: { id: resolvedSubsectionId } }
			: undefined,
		equipment: equipmentId ? { connect: { id: equipmentId } } : undefined,
		location: locationId ? { connect: { id: locationId } } : undefined,
		createdBy: { connect: { id: reqUser.id } },
		supervisor: { connect: { id: resolvedSupervisorId } },
	};

	return prisma.$transaction(async (tx) =>
		createScheduleWithFirstOccurrence(tx, scheduleData, dueDate),
	);
};

const createSchedulesForAllTargets = async ({ payload, reqUser, dueDate }) => {
	const {
		title,
		description,
		scheduleType,
		targetScope,
		frequency,
		jointFrequency,
		isJointSchedule,
		jointDepartment,
		remindBeforeDays,
		allowedVarianceDays,
		escalationRole,
	} = payload;

	const scopeWhere =
		reqUser.role === "SUPER_ADMIN" ? {} : { divisionId: reqUser.divisionId };

	const targets =
		targetScope === "SUBSECTION"
			? await prisma.subsection.findMany({
					where: scopeWhere,
					select: {
						id: true,
						code: true,
						fromStationId: true,
						supervisorId: true,
					},
				})
			: await prisma.station.findMany({
					where: scopeWhere,
					select: {
						id: true,
						name: true,
						supervisorId: true,
					},
				});

	if (targets.length === 0) {
		throw new Error(
			targetScope === "SUBSECTION"
				? "No subsections found in this division."
				: "No stations found in this division.",
		);
	}

	const created = [];
	const skipped = [];

	await prisma.$transaction(async (tx) => {
		for (const target of targets) {
			const supervisorId = target.supervisorId;
			const validSupervisor = supervisorId
				? await assertValidSupervisor(supervisorId, reqUser.divisionId)
				: false;

			if (!validSupervisor) {
				skipped.push({
					id: target.id,
					reason: "No valid JE/SSE supervisor mapped",
				});
				continue;
			}

			const existing = await tx.maintenanceSchedule.findFirst({
				where: {
					scheduleType,
					targetScope,
					stationId:
						targetScope === "STATION" ? target.id : target.fromStationId,
					subsectionId: targetScope === "SUBSECTION" ? target.id : null,
					supervisorId,
					status: "ACTIVE",
				},
				select: { id: true },
			});
			if (existing) {
				skipped.push({
					id: target.id,
					reason: "Active schedule already exists",
				});
				continue;
			}

			const scheduleData = {
				title: buildTitle({
					title,
					scheduleType,
					stationName: target.name,
					subsectionCode: target.code,
				}),
				description: description || null,
				scheduleType,
				targetScope,
				frequency,
				jointFrequency: isJointSchedule ? jointFrequency || frequency : null,
				isJointSchedule: Boolean(isJointSchedule),
				jointDepartment: isJointSchedule ? jointDepartment || null : null,
				nextDueDate: dueDate,
				allowedVarianceDays,
				remindBeforeDays: normalizeRemindBeforeDays(remindBeforeDays),
				escalationRole: escalationRole || DEFAULT_ESCALATION_ROLE,
				station: {
					connect: {
						id: targetScope === "STATION" ? target.id : target.fromStationId,
					},
				},
				subsection:
					targetScope === "SUBSECTION"
						? { connect: { id: target.id } }
						: undefined,
				createdBy: { connect: { id: reqUser.id } },
				supervisor: { connect: { id: supervisorId } },
			};

			const schedule = await createScheduleWithFirstOccurrence(
				tx,
				scheduleData,
				dueDate,
			);
			created.push(schedule.id);
		}
	});

	return { createdCount: created.length, skipped };
};

export const createMaintenanceSchedule = async (req, res) => {
	const {
		title,
		description,
		scheduleType = "CUSTOM",
		targetScope: requestedScope,
		frequency = "MONTHLY",
		jointFrequency,
		isJointSchedule = false,
		jointDepartment,
		nextDueDate,
		remindBeforeDays,
		stationId,
		subsectionId,
		equipmentId,
		locationId,
		supervisorId,
		applyToAll = false,
		allowedVarianceDays: varianceInput,
		escalationRole,
	} = req.body;

	const dueDate = parseDate(nextDueDate);
	if (!dueDate) {
		return res.status(400).json({ message: "Valid nextDueDate is required." });
	}

	const targetScope = normalizeScope(scheduleType, requestedScope);
	const allowedVarianceDays = Math.max(
		0,
		Math.min(15, toInt(varianceInput, 5)),
	);
	const shouldApplyToAll = applyToAll === true || applyToAll === "true";

	if (isJointSchedule && !jointDepartment?.trim()) {
		return res
			.status(400)
			.json({ message: "jointDepartment is required when schedule is joint." });
	}

	try {
		if (shouldApplyToAll) {
			const result = await createSchedulesForAllTargets({
				payload: {
					title,
					description,
					scheduleType,
					targetScope,
					frequency,
					jointFrequency,
					isJointSchedule,
					jointDepartment,
					remindBeforeDays,
					allowedVarianceDays,
					escalationRole,
				},
				reqUser: req.user,
				dueDate,
			});

			if (result.createdCount === 0) {
				return res.status(400).json({
					message:
						"No schedules created. Please verify supervisor mapping on stations/subsections.",
					skipped: result.skipped,
				});
			}

			return res.status(201).json({
				message: `Created ${result.createdCount} schedules.`,
				...result,
			});
		}

		const created = await createOneScheduleFromPayload({
			payload: {
				title,
				description,
				scheduleType,
				targetScope,
				frequency,
				jointFrequency,
				isJointSchedule,
				jointDepartment,
				nextDueDate,
				remindBeforeDays,
				stationId,
				subsectionId,
				equipmentId,
				locationId,
				supervisorId,
				allowedVarianceDays,
				escalationRole,
			},
			reqUser: req.user,
			dueDate,
		});

		return res.status(201).json(created);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listMaintenanceSchedules = async (req, res) => {
	const { mine } = req.query;
	const { id: userId, role, divisionId } = req.user;

	const where = {
		...(role === "SUPER_ADMIN" ? {} : { station: { divisionId } }),
		...(mine === "true" ? { supervisorId: userId } : {}),
	};

	try {
		const schedules = await prisma.maintenanceSchedule.findMany({
			where,
			include: {
				station: { select: { id: true, name: true, code: true } },
				subsection: {
					select: {
						id: true,
						name: true,
						code: true,
						startKm: true,
						endKm: true,
					},
				},
				equipment: { select: { id: true, name: true } },
				location: { select: { id: true, name: true } },
				createdBy: { select: { id: true, name: true } },
				supervisor: {
					select: { id: true, name: true, role: true, designation: true },
				},
				occurrences: {
					select: {
						id: true,
						status: true,
						dueDate: true,
						completedAt: true,
						completedById: true,
						escalatedAt: true,
						escalatedToId: true,
					},
					orderBy: { createdAt: "desc" },
				},
			},
			orderBy: { nextDueDate: "asc" },
		});
		return res.status(200).json(schedules);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const updateMaintenanceSchedule = async (req, res) => {
	const { id } = req.params;
	const {
		title,
		description,
		scheduleType,
		targetScope,
		frequency,
		jointFrequency,
		isJointSchedule,
		jointDepartment,
		nextDueDate,
		allowedVarianceDays,
		remindBeforeDays,
		stationId,
		subsectionId,
		equipmentId,
		locationId,
		status,
		supervisorId,
		escalationRole,
	} = req.body;

	try {
		const schedule = await ensureScheduleDivisionAccess(id, req.user);
		if (!schedule)
			return res.status(404).json({ message: "Schedule not found" });
		if (schedule === "FORBIDDEN")
			return res.status(403).json({ message: "Forbidden" });

		if (supervisorId !== undefined) {
			const validSupervisor = await assertValidSupervisor(
				supervisorId,
				req.user.divisionId,
			);
			if (!validSupervisor) {
				return res
					.status(400)
					.json({ message: "Supervisor must be JE/SSE sectional user." });
			}
		}

		let resolvedStationId = stationId;
		if (subsectionId) {
			const subsection = await prisma.subsection.findFirst({
				where: {
					id: subsectionId,
					divisionId:
						req.user.role === "SUPER_ADMIN" ? undefined : req.user.divisionId,
				},
				select: { fromStationId: true },
			});
			if (!subsection) {
				return res
					.status(400)
					.json({ message: "Invalid subsection for this division." });
			}
			resolvedStationId = subsection.fromStationId;
		}

		const updated = await prisma.maintenanceSchedule.update({
			where: { id },
			data: {
				title: title ?? undefined,
				description: description ?? undefined,
				scheduleType: scheduleType ?? undefined,
				targetScope: targetScope ?? undefined,
				frequency: frequency ?? undefined,
				jointFrequency:
					isJointSchedule === false
						? null
						: jointFrequency !== undefined
							? jointFrequency
							: undefined,
				isJointSchedule: isJointSchedule ?? undefined,
				jointDepartment:
					isJointSchedule === false
						? null
						: jointDepartment !== undefined
							? jointDepartment || null
							: undefined,
				nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
				allowedVarianceDays:
					allowedVarianceDays !== undefined
						? Math.max(0, Math.min(15, toInt(allowedVarianceDays, 5)))
						: undefined,
				remindBeforeDays:
					remindBeforeDays !== undefined
						? normalizeRemindBeforeDays(remindBeforeDays)
						: undefined,
				status: status ?? undefined,
				escalationRole: escalationRole ?? undefined,
				station: resolvedStationId
					? { connect: { id: resolvedStationId } }
					: undefined,
				subsection:
					subsectionId === undefined
						? undefined
						: subsectionId
							? { connect: { id: subsectionId } }
							: { disconnect: true },
				equipment:
					equipmentId === undefined
						? undefined
						: equipmentId
							? { connect: { id: equipmentId } }
							: { disconnect: true },
				location:
					locationId === undefined
						? undefined
						: locationId
							? { connect: { id: locationId } }
							: { disconnect: true },
				supervisor: supervisorId
					? { connect: { id: supervisorId } }
					: undefined,
			},
		});

		return res.status(200).json(updated);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const toggleMaintenanceScheduleStatus = async (req, res) => {
	const { id } = req.params;

	try {
		const schedule = await ensureScheduleDivisionAccess(id, req.user);
		if (!schedule)
			return res.status(404).json({ message: "Schedule not found" });
		if (schedule === "FORBIDDEN")
			return res.status(403).json({ message: "Forbidden" });

		const nextStatus = schedule.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
		const updated = await prisma.maintenanceSchedule.update({
			where: { id },
			data: { status: nextStatus },
		});

		return res.status(200).json(updated);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const createMaintenanceOccurrence = async (req, res) => {
	const { scheduleId } = req.params;

	try {
		const schedule = await ensureScheduleDivisionAccess(scheduleId, req.user);
		if (!schedule)
			return res.status(404).json({ message: "Schedule not found" });
		if (schedule === "FORBIDDEN")
			return res.status(403).json({ message: "Forbidden" });

		const occurrence = await prisma.maintenanceOccurrence.create({
			data: {
				schedule: { connect: { id: scheduleId } },
				dueDate: schedule.nextDueDate,
				status: "OPEN",
			},
		});

		return res.status(201).json(occurrence);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const getOccurrenceInspectionForm = async (req, res) => {
	const { id } = req.params;
	const userId = req.user.id;
	try {
		const occurrence = await prisma.maintenanceOccurrence.findUnique({
			where: { id },
			include: {
				schedule: {
					include: {
						station: {
							select: { id: true, name: true, code: true, divisionId: true },
						},
					},
				},
			},
		});
		if (!occurrence)
			return res.status(404).json({ message: "Occurrence not found" });

		const hasAccess =
			req.user.role === "SUPER_ADMIN" ||
			APPROVER_ROLES.has(req.user.role) ||
			occurrence.schedule.supervisorId === userId;
		if (!hasAccess) {
			return res.status(403).json({
				message:
					"Only assigned JE/SSE or Testroom/Admin can view this inspection form.",
			});
		}

		if (occurrence.schedule.scheduleType !== "STATION_INSPECTION_MAINTENANCE") {
			return res.status(200).json({
				occurrenceId: occurrence.id,
				scheduleType: occurrence.schedule.scheduleType,
				station: occurrence.schedule.station,
				sections: [],
				existingResponses: occurrence.inspectionChecklistResponses || [],
			});
		}

		const stationCircuits = await prisma.stationCircuit.findMany({
			where: {
				stationId: occurrence.schedule.stationId,
				status: "APPROVED",
			},
			include: {
				location: { select: { id: true, name: true } },
				circuitMaster: {
					select: {
						id: true,
						code: true,
						name: true,
						description: true,
						checklistSchema: true,
					},
				},
				maintainedBy: { select: { id: true, name: true, designation: true } },
			},
			orderBy: [{ createdAt: "asc" }],
		});

		const sections = stationCircuits.map((circuit) => ({
			stationCircuitId: circuit.id,
			circuitMasterId: circuit.circuitMasterId,
			circuitCode: circuit.circuitMaster.code,
			circuitName: circuit.circuitMaster.name,
			circuitDescription: circuit.circuitMaster.description,
			identifier: circuit.identifier,
			location: circuit.location,
			maintainedBy: circuit.maintainedBy,
			fields: Array.isArray(circuit.circuitMaster.checklistSchema)
				? circuit.circuitMaster.checklistSchema
				: [],
		}));

		return res.status(200).json({
			occurrenceId: occurrence.id,
			scheduleType: occurrence.schedule.scheduleType,
			station: occurrence.schedule.station,
			sections,
			existingResponses: occurrence.inspectionChecklistResponses || [],
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const markMaintenanceCompleted = async (req, res) => {
	const { id } = req.params;
	const {
		remarks,
		proofUrls = [],
		jointDoneWithName,
		jointDoneWithDesignation,
		jointDoneWithDepartment,
		inspectionChecklistResponses = [],
	} = req.body;
	const userId = req.user.id;

	try {
		const occurrence = await prisma.maintenanceOccurrence.findUnique({
			where: { id },
			include: { schedule: true },
		});
		if (!occurrence)
			return res.status(404).json({ message: "Occurrence not found" });
		if (occurrence.status === "COMPLETED") {
			return res.status(400).json({ message: "Occurrence already completed." });
		}

		const hasAccess =
			req.user.role === "SUPER_ADMIN" ||
			userId === occurrence.schedule.supervisorId;
		if (!hasAccess) {
			return res
				.status(403)
				.json({ message: "Only assigned JE/SSE can complete this schedule." });
		}

		if (
			occurrence.schedule.isJointSchedule &&
			(!jointDoneWithName?.trim() || !jointDoneWithDesignation?.trim())
		) {
			return res.status(400).json({
				message: "Joint completion requires partner name and designation.",
			});
		}

		let inspectionChecklistSnapshot = null;
		let normalizedInspectionResponses = null;
		if (occurrence.schedule.scheduleType === "STATION_INSPECTION_MAINTENANCE") {
			const approvedCircuits = await prisma.stationCircuit.findMany({
				where: {
					stationId: occurrence.schedule.stationId,
					status: "APPROVED",
				},
				include: {
					location: { select: { id: true, name: true } },
					circuitMaster: {
						select: { id: true, code: true, name: true, checklistSchema: true },
					},
				},
			});

			const responseRows = normalizeChecklistResponses(
				inspectionChecklistResponses,
			);
			const responseMap = new Map(
				responseRows
					.filter((row) => row?.stationCircuitId)
					.map((row) => [
						row.stationCircuitId,
						{
							stationCircuitId: row.stationCircuitId,
							values:
								row.values &&
								typeof row.values === "object" &&
								!Array.isArray(row.values)
									? row.values
									: {},
						},
					]),
			);

			if (approvedCircuits.length > 0 && responseMap.size === 0) {
				return res.status(400).json({
					message:
						"Inspection checklist responses are required for station inspection schedule.",
				});
			}

			const missingFields = [];
			for (const circuit of approvedCircuits) {
				const response = responseMap.get(circuit.id);
				if (!response) {
					missingFields.push(
						`${circuit.circuitMaster.name}: checklist not filled`,
					);
					continue;
				}
				const fields = Array.isArray(circuit.circuitMaster.checklistSchema)
					? circuit.circuitMaster.checklistSchema
					: [];
				for (const field of fields) {
					if (!field?.required) continue;
					if (isMissingRequiredValue(field.type, response.values[field.key])) {
						missingFields.push(
							`${circuit.circuitMaster.name} - ${field.label || field.key}`,
						);
					}
				}
			}
			if (missingFields.length > 0) {
				return res.status(400).json({
					message: "Required inspection fields are missing.",
					missingFields,
				});
			}

			inspectionChecklistSnapshot = approvedCircuits.map((circuit) => ({
				stationCircuitId: circuit.id,
				circuitMasterId: circuit.circuitMasterId,
				code: circuit.circuitMaster.code,
				name: circuit.circuitMaster.name,
				identifier: circuit.identifier,
				location: circuit.location,
				fields: Array.isArray(circuit.circuitMaster.checklistSchema)
					? circuit.circuitMaster.checklistSchema
					: [],
			}));
			normalizedInspectionResponses = responseRows
				.filter((row) => row?.stationCircuitId)
				.map((row) => ({
					stationCircuitId: row.stationCircuitId,
					values:
						row.values &&
						typeof row.values === "object" &&
						!Array.isArray(row.values)
							? row.values
							: {},
				}));
		}

		const now = new Date();
		const updated = await prisma.$transaction(async (tx) => {
			const completed = await tx.maintenanceOccurrence.update({
				where: { id },
				data: {
					status: "COMPLETED",
					completedAt: now,
					completedBy: { connect: { id: userId } },
					remarks: remarks || null,
					proofUrls,
					jointDoneWithName: jointDoneWithName?.trim() || null,
					jointDoneWithDesignation: jointDoneWithDesignation?.trim() || null,
					jointDoneWithDepartment:
						jointDoneWithDepartment?.trim() ||
						occurrence.schedule.jointDepartment ||
						null,
					inspectionChecklistSnapshot,
					inspectionChecklistResponses: normalizedInspectionResponses,
				},
			});

			const nextDue = addFrequency(
				occurrence.schedule.nextDueDate,
				occurrence.schedule.frequency,
			);
			await tx.maintenanceSchedule.update({
				where: { id: occurrence.scheduleId },
				data: { nextDueDate: nextDue },
			});

			await tx.maintenanceOccurrence.create({
				data: {
					scheduleId: occurrence.scheduleId,
					dueDate: nextDue,
					status: "OPEN",
				},
			});

			return completed;
		});

		return res.status(200).json(updated);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const myMaintenanceSummary = async (req, res) => {
	const userId = req.user.id;
	try {
		await runMaintenanceRemindersJob(new Date());

		const [pending, completed] = await Promise.all([
			prisma.maintenanceOccurrence.findMany({
				where: {
					status: { in: ["OPEN", "OVERDUE"] },
					schedule: { supervisorId: userId, status: "ACTIVE" },
				},
				include: {
					schedule: {
						include: {
							station: { select: { id: true, name: true, code: true } },
							subsection: {
								select: {
									id: true,
									name: true,
									code: true,
									startKm: true,
									endKm: true,
								},
							},
							location: { select: { id: true, name: true } },
							equipment: { select: { id: true, name: true } },
						},
					},
				},
				orderBy: { dueDate: "asc" },
				take: 200,
			}),
			prisma.maintenanceOccurrence.findMany({
				where: {
					status: "COMPLETED",
					schedule: { supervisorId: userId },
				},
				include: {
					schedule: {
						include: {
							station: { select: { id: true, name: true, code: true } },
							subsection: {
								select: {
									id: true,
									name: true,
									code: true,
									startKm: true,
									endKm: true,
								},
							},
							location: { select: { id: true, name: true } },
							equipment: { select: { id: true, name: true } },
						},
					},
					completedBy: { select: { id: true, name: true } },
				},
				orderBy: { completedAt: "desc" },
				take: 200,
			}),
		]);

		return res.status(200).json({
			pendingCount: pending.length,
			completedCount: completed.length,
			pending,
			completed,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listOverdueMaintenance = async (_req, res) => {
	try {
		await runMaintenanceRemindersJob(new Date());

		const overdue = await prisma.maintenanceOccurrence.findMany({
			where: { status: "OVERDUE" },
			include: {
				escalatedTo: { select: { id: true, name: true, role: true } },
				schedule: {
					include: {
						station: { select: { id: true, name: true, code: true } },
						subsection: {
							select: {
								id: true,
								name: true,
								code: true,
								startKm: true,
								endKm: true,
							},
						},
						equipment: { select: { id: true, name: true } },
						location: { select: { id: true, name: true } },
					},
				},
			},
			orderBy: { dueDate: "asc" },
		});

		return res.status(200).json(overdue);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const runMaintenanceReminders = async (_req, res) => {
	try {
		const result = await runMaintenanceRemindersJob(new Date());
		return res.status(200).json(result);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};
