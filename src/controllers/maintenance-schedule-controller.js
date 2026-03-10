import prisma from "../lib/prisma.js";
import { addFrequency, normalizeRemindBeforeDays } from "../lib/maintenance.js";
import { runMaintenanceRemindersJob } from "../lib/maintenance-runner.js";

const SUPERVISOR_ROLES = new Set([
	"JE_SSE_TELE_SECTIONAL",
	"JE_SECTIONAL",
	"SSE_SECTIONAL",
	"FIELD_ENGINEER",
]);

const assertValidSupervisor = async (supervisorId, divisionId) => {
	const supervisor = await prisma.user.findFirst({
		where: {
			id: supervisorId,
			divisionId,
			role: { in: Array.from(SUPERVISOR_ROLES) },
		},
		select: { id: true },
	});
	return Boolean(supervisor);
};

export const createMaintenanceSchedule = async (req, res) => {
	const {
		title,
		description,
		frequency,
		nextDueDate,
		remindBeforeDays,
		stationId,
		equipmentId,
		locationId,
		supervisorId,
	} = req.body;

	const createdById = req.user.id;
	const divisionId = req.user.divisionId;

	if (!title || !stationId || !nextDueDate || !supervisorId) {
		return res.status(400).json({ message: "title, stationId, nextDueDate and supervisorId are required" });
	}

	try {
		const validSupervisor = await assertValidSupervisor(supervisorId, divisionId);
		if (!validSupervisor) {
			return res.status(400).json({ message: "Supervisor must be a JE/SSE of your division." });
		}

		const dueDate = new Date(nextDueDate);

		const schedule = await prisma.$transaction(async (tx) => {
			const created = await tx.maintenanceSchedule.create({
				data: {
					title,
					description: description || null,
					frequency: frequency || "MONTHLY",
					nextDueDate: dueDate,
					remindBeforeDays: normalizeRemindBeforeDays(remindBeforeDays),
					station: { connect: { id: stationId } },
					equipment: equipmentId ? { connect: { id: equipmentId } } : undefined,
					location: locationId ? { connect: { id: locationId } } : undefined,
					createdBy: { connect: { id: createdById } },
					supervisor: { connect: { id: supervisorId } },
				},
			});

			await tx.maintenanceOccurrence.create({
				data: {
					scheduleId: created.id,
					dueDate,
					status: "OPEN",
				},
			});

			return created;
		});

		res.status(201).json(schedule);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const listMaintenanceSchedules = async (req, res) => {
	const { mine } = req.query;
	const { id: userId } = req.user;
	try {
		const schedules = await prisma.maintenanceSchedule.findMany({
			where: mine === "true" ? { supervisorId: userId } : undefined,
			include: {
				station: { select: { id: true, name: true, code: true } },
				equipment: { select: { id: true, name: true } },
				location: { select: { id: true, name: true } },
				createdBy: { select: { id: true, name: true } },
				supervisor: { select: { id: true, name: true, role: true, designation: true } },
				occurrences: {
					select: { id: true, status: true, dueDate: true, completedAt: true, completedById: true },
					orderBy: { createdAt: "desc" },
				},
			},
			orderBy: { nextDueDate: "asc" },
		});
		res.status(200).json(schedules);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const updateMaintenanceSchedule = async (req, res) => {
	const { id } = req.params;
	const {
		title,
		description,
		frequency,
		nextDueDate,
		remindBeforeDays,
		stationId,
		equipmentId,
		locationId,
		status,
		supervisorId,
	} = req.body;

	try {
		if (supervisorId !== undefined) {
			const validSupervisor = await assertValidSupervisor(supervisorId, req.user.divisionId);
			if (!validSupervisor) {
				return res.status(400).json({ message: "Supervisor must be a JE/SSE of your division." });
			}
		}

		const updated = await prisma.maintenanceSchedule.update({
			where: { id },
			data: {
				title: title ?? undefined,
				description: description ?? undefined,
				frequency: frequency ?? undefined,
				nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
				remindBeforeDays: remindBeforeDays !== undefined ? normalizeRemindBeforeDays(remindBeforeDays) : undefined,
				status: status ?? undefined,
				station: stationId ? { connect: { id: stationId } } : undefined,
				equipment: equipmentId ? { connect: { id: equipmentId } } : undefined,
				location: locationId ? { connect: { id: locationId } } : undefined,
				supervisor: supervisorId ? { connect: { id: supervisorId } } : undefined,
			},
		});

		res.status(200).json(updated);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const toggleMaintenanceScheduleStatus = async (req, res) => {
	const { id } = req.params;

	try {
		const schedule = await prisma.maintenanceSchedule.findUnique({
			where: { id },
		});
		if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

		const nextStatus = schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
		const updated = await prisma.maintenanceSchedule.update({
			where: { id },
			data: { status: nextStatus },
		});

		res.status(200).json(updated);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const createMaintenanceOccurrence = async (req, res) => {
	const { scheduleId } = req.params;

	try {
		const schedule = await prisma.maintenanceSchedule.findUnique({
			where: { id: scheduleId },
		});
		if (!schedule) return res.status(404).json({ message: "Schedule not found" });

		const occurrence = await prisma.maintenanceOccurrence.create({
			data: {
				schedule: { connect: { id: scheduleId } },
				dueDate: schedule.nextDueDate,
				status: "OPEN",
			},
		});

		res.status(201).json(occurrence);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const markMaintenanceCompleted = async (req, res) => {
	const { id } = req.params; // occurrence id
	const { remarks, proofUrls = [] } = req.body;
	const userId = req.user.id;

	try {
		const occurrence = await prisma.maintenanceOccurrence.findUnique({
			where: { id },
			include: { schedule: true },
		});
		if (!occurrence) return res.status(404).json({ message: "Occurrence not found" });

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
				},
			});

			const nextDue = addFrequency(occurrence.schedule.nextDueDate, occurrence.schedule.frequency);
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

		res.status(200).json(updated);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const myMaintenanceSummary = async (req, res) => {
	const userId = req.user.id;
	try {
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
							location: { select: { id: true, name: true } },
							equipment: { select: { id: true, name: true } },
						},
					},
				},
				orderBy: { dueDate: "asc" },
				take: 100,
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
							location: { select: { id: true, name: true } },
							equipment: { select: { id: true, name: true } },
						},
					},
					completedBy: { select: { id: true, name: true } },
				},
				orderBy: { completedAt: "desc" },
				take: 100,
			}),
		]);

		res.status(200).json({
			pendingCount: pending.length,
			completedCount: completed.length,
			pending,
			completed,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const listOverdueMaintenance = async (req, res) => {
	const now = new Date();
	try {
		const overdue = await prisma.maintenanceOccurrence.findMany({
			where: {
				status: { in: ["OPEN", "OVERDUE"] },
				dueDate: { lt: now },
			},
			include: {
				schedule: {
					include: {
						station: { select: { name: true, code: true } },
						equipment: { select: { name: true } },
						location: { select: { name: true } },
					},
				},
			},
			orderBy: { dueDate: "asc" },
		});

		res.status(200).json(overdue);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const runMaintenanceReminders = async (req, res) => {
	try {
		const result = await runMaintenanceRemindersJob(new Date());
		// NOTE: Notification hooks (email/SMS/WhatsApp) should be added here.
		res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
