import prisma from "./prisma.js";

const addDays = (date, days) => {
	const output = new Date(date);
	output.setDate(output.getDate() + days);
	return output;
};

const pickEscalationTarget = async (divisionId, escalationRole) => {
	const user = await prisma.user.findFirst({
		where: {
			divisionId,
			role: escalationRole || "SSE_TELE_INCHARGE",
		},
		select: { id: true },
	});
	if (user) return user;

	// Fallback when exact role is not present.
	return prisma.user.findFirst({
		where: {
			divisionId,
			role: "ADMIN",
		},
		select: { id: true },
	});
};

export const runMaintenanceRemindersJob = async (now = new Date()) => {
	const schedules = await prisma.maintenanceSchedule.findMany({
		where: { status: "ACTIVE" },
		select: {
			id: true,
			nextDueDate: true,
			allowedVarianceDays: true,
			escalationRole: true,
			station: { select: { divisionId: true } },
		},
	});

	const createdOccurrenceIds = [];
	let overdueMarked = 0;
	let escalatedCount = 0;

	for (const schedule of schedules) {
		const existing = await prisma.maintenanceOccurrence.findFirst({
			where: {
				scheduleId: schedule.id,
				dueDate: schedule.nextDueDate,
				status: { in: ["OPEN", "OVERDUE"] },
			},
			select: { id: true },
		});

		if (!existing) {
			const created = await prisma.maintenanceOccurrence.create({
				data: {
					schedule: { connect: { id: schedule.id } },
					dueDate: schedule.nextDueDate,
					status: "OPEN",
				},
				select: { id: true },
			});
			createdOccurrenceIds.push(created.id);
		}
	}

	const openOccurrences = await prisma.maintenanceOccurrence.findMany({
		where: { status: "OPEN" },
		select: {
			id: true,
			dueDate: true,
			escalatedAt: true,
			schedule: {
				select: {
					allowedVarianceDays: true,
					escalationRole: true,
					station: { select: { divisionId: true } },
				},
			},
		},
	});

	for (const occurrence of openOccurrences) {
		const dueDeadline = addDays(
			occurrence.dueDate,
			occurrence.schedule?.allowedVarianceDays ?? 5,
		);
		if (dueDeadline >= now) continue;

		overdueMarked += 1;

		let escalationData = {};
		if (!occurrence.escalatedAt) {
			const target = await pickEscalationTarget(
				occurrence.schedule.station.divisionId,
				occurrence.schedule.escalationRole,
			);
			if (target) {
				escalationData = {
					escalatedAt: now,
					escalatedTo: { connect: { id: target.id } },
				};
				escalatedCount += 1;
			}
		}

		await prisma.maintenanceOccurrence.update({
			where: { id: occurrence.id },
			data: {
				status: "OVERDUE",
				...escalationData,
			},
		});
	}

	return {
		createdOccurrences: createdOccurrenceIds.length,
		overdueMarked,
		escalatedCount,
	};
};
