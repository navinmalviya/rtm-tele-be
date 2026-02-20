import prisma from "./prisma.js";

export const runMaintenanceRemindersJob = async (now = new Date()) => {
	const schedules = await prisma.maintenanceSchedule.findMany({
		where: { status: "ACTIVE" },
	});

	const createdOccurrences = [];

	for (const schedule of schedules) {
		const existing = await prisma.maintenanceOccurrence.findFirst({
			where: {
				scheduleId: schedule.id,
				dueDate: schedule.nextDueDate,
				status: { in: ["OPEN", "OVERDUE"] },
			},
		});

		if (!existing) {
			const occurrence = await prisma.maintenanceOccurrence.create({
				data: {
					schedule: { connect: { id: schedule.id } },
					dueDate: schedule.nextDueDate,
					status: "OPEN",
				},
			});
			createdOccurrences.push(occurrence.id);
		}
	}

	await prisma.maintenanceOccurrence.updateMany({
		where: {
			status: "OPEN",
			dueDate: { lt: now },
		},
		data: { status: "OVERDUE" },
	});

	return { createdOccurrences: createdOccurrences.length };
};
