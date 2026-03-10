import prisma from "../lib/prisma";
import {
	computeSlaDueAt,
	ESCALATION_INTERVAL_HOURS,
	ESCALATION_MAX_LEVEL,
} from "../lib/sla.js";

const appendTaskHistory = async (db, { taskId, actorId, action, fromValue, toValue, details }) => {
	return db.taskHistory.create({
		data: {
			taskId,
			actorId: actorId || null,
			action,
			fromValue: fromValue || null,
			toValue: toValue || null,
			details: details || null,
		},
	});
};

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

			await appendTaskHistory(tx, {
				taskId: task.id,
				actorId: ownerId,
				action: "TASK_CREATED",
				details: `Task created with priority ${priority || "MEDIUM"}`,
			});

			if (assignedToId) {
				await appendTaskHistory(tx, {
					taskId: task.id,
					actorId: ownerId,
					action: "ASSIGNEE_UPDATED",
					fromValue: "UNASSIGNED",
					toValue: assignedToId,
					details: "Task assigned during creation",
				});
			}

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
				await appendTaskHistory(tx, {
					taskId: task.id,
					actorId: ownerId,
					action: "FAILURE_DETAILS_CREATED",
					details: "Failure details initialized",
				});
			} else if (type === "MAINTENANCE" && maintenanceData) {
				await tx.maintenance.create({
					data: {
						...maintenanceData,
						taskId: task.id,
					},
				});
				await appendTaskHistory(tx, {
					taskId: task.id,
					actorId: ownerId,
					action: "MAINTENANCE_DETAILS_CREATED",
					details: "Maintenance details initialized",
				});
			} else if (type === "TRC" && trcData) {
				await tx.tRCRequest.create({
					data: {
						...trcData,
						taskId: task.id,
					},
				});
				await appendTaskHistory(tx, {
					taskId: task.id,
					actorId: ownerId,
					action: "TRC_DETAILS_CREATED",
					details: "TRC details initialized",
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
			select: { assignedToId: true, type: true, projectId: true, status: true },
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

		const task = await prisma.$transaction(async (tx) => {
			const updatedTask = await tx.task.update({
				where: { id },
				data: { status },
			});

			if (currentTask.status !== status) {
				await appendTaskHistory(tx, {
					taskId: id,
					actorId: userId,
					action: "STATUS_CHANGED",
					fromValue: currentTask.status,
					toValue: status,
					details: `Status moved from ${currentTask.status} to ${status}`,
				});
			}

			return updatedTask;
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
				history: {
					include: { actor: { select: { id: true, name: true, username: true } } },
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
	const actorId = req.user.id;

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

		const cleanedFailureData = {
			type: failureData.type,
			cause: failureData.cause,
			locationId: failureData.locationId || null,
			subsectionId: failureData.subsectionId || null,
			stationId: failureData.stationId || null,
			restorationTime: failureData.restorationTime || null,
			remarks: failureData.remarks || null,
			cableCutId: failureData.cableCutId || null,
		};

		let failure;
		if (task.failure) {
			const before = task.failure;
			failure = await prisma.failure.update({
				where: { taskId },
				data: {
					...cleanedFailureData,
				},
			});

			const trackedFields = [
				"type",
				"cause",
				"stationId",
				"locationId",
				"subsectionId",
				"restorationTime",
				"remarks",
				"cableCutId",
			];

			const changedFields = trackedFields.filter(
				(key) => (before[key] || null) !== (failure[key] || null)
			);

			await appendTaskHistory(prisma, {
				taskId,
				actorId,
				action: "FAILURE_DETAILS_UPDATED",
				details:
					changedFields.length > 0
						? `Updated fields: ${changedFields.join(", ")}`
						: "Failure details submitted",
			});
		} else {
			failure = await prisma.failure.create({
				data: {
					...cleanedFailureData,
					taskId,
				},
			});

			await appendTaskHistory(prisma, {
				taskId,
				actorId,
				action: "FAILURE_DETAILS_CREATED",
				details: "Failure details created",
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
		const comment = await prisma.$transaction(async (tx) => {
			const createdComment = await tx.comment.create({
				data: {
					content,
					taskId,
					authorId,
				},
				include: { author: { select: { name: true } } },
			});

			await appendTaskHistory(tx, {
				taskId,
				actorId: authorId,
				action: "COMMENT_ADDED",
				details:
					content && content.length > 140
						? `${content.slice(0, 140)}...`
						: content || "Comment added",
			});

			return createdComment;
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
		const comment = await prisma.$transaction(async (tx) => {
			const createdComment = await tx.comment.create({
				data: {
					content: `SSE Remark: ${remark.trim()}`,
					taskId,
					authorId: userId,
				},
			});

			await appendTaskHistory(tx, {
				taskId,
				actorId: userId,
				action: "SSE_REMARK_ADDED",
				details: remark.trim(),
			});

			return createdComment;
		});

		res.status(200).json(comment);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * Escalate overdue failure tickets
 * This should be called by a scheduler/cron (e.g., every 30 minutes)
 */
export const escalateOverdueFailures = async (req, res) => {
	return res.status(501).json({ message: "SLA escalation is not enabled in current schema." });
};
