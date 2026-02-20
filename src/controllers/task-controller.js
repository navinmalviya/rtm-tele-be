import prisma from "../lib/prisma";
import {
	computeSlaDueAt,
	ESCALATION_INTERVAL_HOURS,
	ESCALATION_MAX_LEVEL,
} from "../lib/sla.js";

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
	const failureReportedAt = new Date();

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
				const slaDueAt = computeSlaDueAt(failureReportedAt, priority);
				await tx.failure.create({
					data: {
						...failureData,
						failureReportedAt,
						slaDueAt,
						escalationLevel: 1,
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
	const userId = req.user.id;

	try {
		const currentTask = await prisma.task.findUnique({
			where: { id },
			select: { assignedToId: true, type: true, failure: { select: { sseInchargeRemark: true } }, projectId: true },
		});

		if (!currentTask) {
			return res.status(404).json({ message: "Task not found" });
		}

		if (status === "CLOSED") {
			if (!currentTask.assignedToId || currentTask.assignedToId !== userId) {
				return res
					.status(403)
					.json({ message: "Only the assignee can close this task." });
			}
		}

		if (status === "CLOSED") {
			if (currentTask?.type === "FAILURE") {
				if (!currentTask.failure?.sseInchargeRemark) {
					return res.status(400).json({
						message:
							"Cannot close failure ticket without SSE (Incharge) remarks.",
					});
				}
			}
		}

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
 * GET SINGLE TASK (With specialized includes)
 */
export const getTaskById = async (req, res) => {
	const { id } = req.params;

	try {
		const task = await prisma.task.findUnique({
			where: { id },
			include: {
				owner: { select: { name: true, username: true } },
				assignedTo: { select: { name: true, username: true } },
				failure: {
					include: { location: true, subsection: true, cableCut: true, station: true },
				},
				maintenance: { include: { location: true, equipment: true } },
				trcRequest: { include: { equipment: true } },
				comments: {
					include: { author: { select: { name: true } } },
					orderBy: { createdAt: "desc" },
				},
				_count: { select: { comments: true } },
			},
		});

		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		res.status(200).json(task);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * UPSERT FAILURE DETAILS FOR A TASK
 */
export const upsertFailureForTask = async (req, res) => {
	const { id: taskId } = req.params;
	const failureData = req.body || {};

	try {
		const task = await prisma.task.findUnique({
			where: { id: taskId },
			include: { failure: true },
		});

		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		if (task.type !== "FAILURE") {
			return res.status(400).json({ message: "Task is not a FAILURE type." });
		}

		let failure;
		if (task.failure) {
			failure = await prisma.failure.update({
				where: { taskId },
				data: {
					...failureData,
				},
			});
		} else {
			const failureReportedAt = new Date();
			const slaDueAt = computeSlaDueAt(failureReportedAt, task.priority);
			failure = await prisma.failure.create({
				data: {
					...failureData,
					taskId,
					failureReportedAt,
					slaDueAt,
					escalationLevel: 1,
				},
			});
		}

		res.status(200).json({ message: "Failure details saved", failure });
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

/**
 * SSE (Incharge) remark before closure
 */
export const addSseInchargeRemark = async (req, res) => {
	const { id: taskId } = req.params;
	const { remark } = req.body;
	const userId = req.user.id;

	if (!remark || !remark.trim()) {
		return res.status(400).json({ message: "Remark is required." });
	}

	try {
		const failure = await prisma.failure.findUnique({
			where: { taskId },
		});

		if (!failure) {
			return res.status(404).json({ message: "Failure record not found." });
		}

		const updated = await prisma.failure.update({
			where: { taskId },
			data: {
				sseInchargeRemark: remark.trim(),
				sseInchargeRemarkAt: new Date(),
				sseInchargeById: userId,
			},
		});

		res.status(200).json(updated);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * Escalate overdue failure tickets
 * This should be called by a scheduler/cron (e.g., every 30 minutes)
 */
export const escalateOverdueFailures = async (req, res) => {
	const now = new Date();

	try {
		const overdueFailures = await prisma.failure.findMany({
			where: {
				slaDueAt: { lte: now },
				task: { status: { notIn: ["CLOSED", "RESOLVED"] } },
				escalationLevel: { lt: ESCALATION_MAX_LEVEL },
			},
			include: { task: true },
		});

		const updates = await prisma.$transaction(
			overdueFailures.map((failure) => {
				const nextLevel = failure.escalationLevel + 1;
				const shouldBreach = !failure.slaBreachedAt;
				return prisma.failure.update({
					where: { id: failure.id },
					data: {
						escalationLevel: nextLevel,
						lastEscalatedAt: now,
						slaBreachedAt: shouldBreach ? now : undefined,
					},
				});
			}),
		);

		await prisma.$transaction(
			overdueFailures.map((failure) =>
				prisma.taskEscalationLog.create({
					data: {
						taskId: failure.taskId,
						fromLevel: failure.escalationLevel,
						toLevel: failure.escalationLevel + 1,
						reason: `SLA breach escalation after ${ESCALATION_INTERVAL_HOURS}h interval`,
					},
				}),
			),
		);

		res.status(200).json({
			escalated: updates.length,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
