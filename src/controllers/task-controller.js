import prisma from "../lib/prisma";

/**
 * HELPER: Trigger project progress recalculation
 */
const syncProjectProgress = async (projectId) => {
	if (!projectId) return;

	const tasks = await prisma.task.findMany({
		where: { projectId },
		select: { weight: true, status: true },
	});

	const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || 0), 0);
	const closedWeight = tasks
		.filter((t) => t.status === "CLOSED")
		.reduce((sum, t) => sum + (t.weight || 0), 0);

	const progress = totalWeight > 0 ? (closedWeight / totalWeight) * 100 : 0;

	await prisma.project.update({
		where: { id: projectId },
		data: { totalProgress: Math.round(progress * 100) / 100 },
	});
};

/**
 * CREATE TASK (Polymorphic)
 */
export const createTask = async (req, res) => {
	const {
		title,
		type,
		description,
		priority,
		weight,
		projectId,
		assignedToId,
		// Specialized Data
		failureData,
		maintenanceData,
		trcData,
	} = req.body;

	const ownerId = req.user.id;

	try {
		const result = await prisma.$transaction(async (tx) => {
			// 1. Create the Base Task
			const task = await tx.task.create({
				data: {
					title,
					type,
					description,
					priority,
					weight: weight ? parseFloat(weight) : null,
					projectId,
					ownerId,
					assignedToId,
				},
			});

			// 2. Create the Specialized Sub-entry
			if (type === "FAILURE" && failureData) {
				await tx.failure.create({
					data: {
						...failureData,
						taskId: task.id,
					},
				});
			} else if (type === "MAINTENANCE" && maintenanceData) {
				await tx.maintenance.create({
					data: {
						...maintenanceData,
						taskId: task.id,
					},
				});
			} else if (type === "TRC" && trcData) {
				await tx.tRCRequest.create({
					data: {
						...trcData,
						taskId: task.id,
					},
				});
			}

			return task;
		});

		// 3. Sync project progress if linked
		if (projectId) await syncProjectProgress(projectId);

		res
			.status(201)
			.json({ message: "Task created successfully", task: result });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * UPDATE TASK STATUS & SYNC PROGRESS
 */
export const updateTaskStatus = async (req, res) => {
	const { id } = req.params;
	const { status } = req.body;

	try {
		const task = await prisma.task.update({
			where: { id },
			data: { status },
		});

		// If this task belongs to a project, update the project's total progress
		if (task.projectId) {
			await syncProjectProgress(task.projectId);
		}

		res.status(200).json({ message: `Task status updated to ${status}`, task });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * GET ALL TASKS (With specialized includes)
 */
export const getTasks = async (req, res) => {
	const { projectId, stationId } = req.query;

	try {
		const tasks = await prisma.task.findMany({
			where: {
				projectId: projectId || undefined,
				OR: stationId
					? [
							{ failure: { location: { stationId } } },
							{ maintenance: { location: { stationId } } },
						]
					: undefined,
			},
			include: {
				owner: { select: { name: true, username: true } },
				assignedTo: { select: { name: true, username: true } },
				failure: {
					include: { location: true, subsection: true, cableCut: true },
				},
				maintenance: { include: { location: true, equipment: true } },
				trcRequest: { include: { equipment: true } },
				_count: { select: { comments: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		res.status(200).json(tasks);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * ADD COMMENT TO TASK
 */
export const addTaskComment = async (req, res) => {
	const { id: taskId } = req.params;
	const { content } = req.body;
	const authorId = req.user.id;

	try {
		const comment = await prisma.comment.create({
			data: {
				content,
				taskId,
				authorId,
			},
			include: { author: { select: { name: true } } },
		});

		res.status(201).json(comment);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
