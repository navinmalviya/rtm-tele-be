import prisma from "../lib/prisma.js";
import {
	buildStationVisibilityWhere,
	buildSubsectionVisibilityWhere,
	buildTaskVisibilityOr,
	isFieldScopedRole,
	isSuperAdmin,
} from "../lib/access-scope.js";

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

const parseBoolean = (value, fallback = undefined) => {
	if (value === true || value === "true" || value === 1 || value === "1") return true;
	if (value === false || value === "false" || value === 0 || value === "0") return false;
	return fallback;
};

const getScopedStationAndSubsectionIds = async (req) => {
	if (!isFieldScopedRole(req)) {
		return { stationIds: [], subsectionIds: [] };
	}

	const [stations, subsections] = await Promise.all([
		prisma.station.findMany({
			where: buildStationVisibilityWhere(req),
			select: { id: true },
		}),
		prisma.subsection.findMany({
			where: buildSubsectionVisibilityWhere(req),
			select: { id: true },
		}),
	]);

	return {
		stationIds: stations.map((row) => row.id),
		subsectionIds: subsections.map((row) => row.id),
	};
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

	if (type === "FAILURE") {
		if (!failureData?.failureInTime) {
			return res.status(400).json({ message: "failureInTime is required for failure tasks." });
		}
		const parsedFailureInTime = new Date(failureData.failureInTime);
		if (Number.isNaN(parsedFailureInTime.getTime())) {
			return res.status(400).json({ message: "Invalid failureInTime value." });
		}
	}

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
				const parsedFailureInTime = new Date(failureData.failureInTime);
				await tx.failure.create({
					data: {
						taskId: task.id,
						type: failureData.type || null,
						cause: failureData.cause || null,
						locationId: failureData.locationId || null,
						stationId: failureData.stationId || null,
						cableCutId: failureData.cableCutId || null,
						failureInTime: parsedFailureInTime,
						isHqRepeated: parseBoolean(failureData.isHqRepeated, false),
						isIcmsRepeated: parseBoolean(failureData.isIcmsRepeated, false),
						restorationTime: failureData.restorationTime
							? new Date(failureData.restorationTime)
							: null,
						remarks: failureData.remarks || null,
					},
				});
				await appendTaskHistory(tx, {
					taskId: task.id,
					actorId: ownerId,
					action: "FAILURE_DETAILS_CREATED",
					details: "Failure details initialized by testroom",
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
 * UPDATE TASK CORE DETAILS (owner/testroom/admin)
 */
export const updateTask = async (req, res) => {
	const { id } = req.params;
	const actorId = req.user.id;
	const { title, description, priority, assignedToId } = req.body || {};

	try {
		const task = await prisma.task.findUnique({
			where: { id },
			include: {
				owner: { select: { divisionId: true } },
			},
		});

		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		if (!isSuperAdmin(req) && task.owner?.divisionId !== req.user.divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const canEdit =
			req.user.role === "SUPER_ADMIN" ||
			req.user.role === "ADMIN" ||
			req.user.role === "TESTROOM" ||
			task.ownerId === actorId;

		if (!canEdit) {
			return res.status(403).json({ message: "Only owner/Testroom/Admin can edit task." });
		}

		const updatePayload = {};

		if (title !== undefined) {
			const cleanTitle = String(title || "").trim();
			if (!cleanTitle) {
				return res.status(400).json({ message: "Title is required." });
			}
			updatePayload.title = cleanTitle;
		}

		if (description !== undefined) {
			const cleanDescription = String(description || "").trim();
			if (!cleanDescription) {
				return res.status(400).json({ message: "Description is required." });
			}
			updatePayload.description = cleanDescription;
		}

		if (priority !== undefined) {
			updatePayload.priority = String(priority || "").trim().toUpperCase();
		}

		if (assignedToId !== undefined) {
			updatePayload.assignedToId = assignedToId || null;
		}

		if (Object.keys(updatePayload).length === 0) {
			return res.status(400).json({ message: "No valid fields provided for update." });
		}

		const updatedTask = await prisma.$transaction(async (tx) => {
			const nextTask = await tx.task.update({
				where: { id },
				data: updatePayload,
			});

			if (task.title !== nextTask.title) {
				await appendTaskHistory(tx, {
					taskId: id,
					actorId,
					action: "TASK_TITLE_UPDATED",
					fromValue: task.title,
					toValue: nextTask.title,
					details: "Task title updated",
				});
			}

			if (task.description !== nextTask.description) {
				await appendTaskHistory(tx, {
					taskId: id,
					actorId,
					action: "TASK_DESCRIPTION_UPDATED",
					details: "Task description updated",
				});
			}

			if (task.priority !== nextTask.priority) {
				await appendTaskHistory(tx, {
					taskId: id,
					actorId,
					action: "PRIORITY_CHANGED",
					fromValue: task.priority,
					toValue: nextTask.priority,
					details: `Priority changed from ${task.priority} to ${nextTask.priority}`,
				});
			}

			if ((task.assignedToId || null) !== (nextTask.assignedToId || null)) {
				await appendTaskHistory(tx, {
					taskId: id,
					actorId,
					action: "ASSIGNEE_UPDATED",
					fromValue: task.assignedToId || "UNASSIGNED",
					toValue: nextTask.assignedToId || "UNASSIGNED",
					details: "Task assignee updated",
				});
			}

			return nextTask;
		});

		return res.status(200).json({ message: "Task updated successfully", task: updatedTask });
	} catch (error) {
		return res.status(500).json({ error: error.message });
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
		const where = {
			projectId: projectId || undefined,
			OR: stationId
				? [
						{ failure: { location: { stationId } } },
						{ failure: { stationId } },
						{ maintenance: { location: { stationId } } },
						{ maintenance: { stationId } },
					]
				: undefined,
		};

		if (!isSuperAdmin(req)) {
			where.AND = [
				...(where.AND || []),
				{
					owner: {
						divisionId: req.user.divisionId,
					},
				},
			];
		}

		if (isFieldScopedRole(req)) {
			const { stationIds, subsectionIds } = await getScopedStationAndSubsectionIds(req);
			const fieldVisibility = buildTaskVisibilityOr({
				req,
				stationIds,
				subsectionIds,
			});
			where.AND = [...(where.AND || []), { OR: fieldVisibility }];
		}

		const tasks = await prisma.task.findMany({
			where,
			include: {
				owner: { select: { name: true, username: true } },
				assignedTo: { select: { name: true, username: true } },
				failure: {
					include: { location: true, cableCut: true },
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
		const { stationIds, subsectionIds } = await getScopedStationAndSubsectionIds(req);
		const fieldVisibility = buildTaskVisibilityOr({
			req,
			stationIds,
			subsectionIds,
		});

		const task = await prisma.task.findUnique({
			where: { id },
			include: {
				owner: { select: { id: true, name: true, username: true, divisionId: true } },
				assignedTo: { select: { name: true, username: true } },
				failure: {
					include: { location: true, cableCut: true, station: true },
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

		if (!isSuperAdmin(req) && task.owner?.divisionId !== req.user.divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		if (isFieldScopedRole(req)) {
			const inScope = fieldVisibility.some((clause) => {
				if (clause.assignedToId) return clause.assignedToId === task.assignedToId;
				if (clause.ownerId) return clause.ownerId === task.ownerId;
				if (clause.failure?.stationId?.in?.length) {
					return clause.failure.stationId.in.includes(task.failure?.stationId);
				}
				if (clause.failure?.location?.stationId?.in?.length) {
					return clause.failure.location.stationId.in.includes(task.failure?.location?.stationId);
				}
				if (clause.maintenance?.stationId?.in?.length) {
					return clause.maintenance.stationId.in.includes(task.maintenance?.stationId);
				}
				if (clause.maintenance?.location?.stationId?.in?.length) {
					return clause.maintenance.location.stationId.in.includes(
						task.maintenance?.location?.stationId,
					);
				}
				if (clause.trcRequest?.equipment?.stationId?.in?.length) {
					return clause.trcRequest.equipment.stationId.in.includes(
						task.trcRequest?.equipment?.stationId,
					);
				}
				if (clause.maintenance?.subsectionId?.in?.length) {
					return clause.maintenance.subsectionId.in.includes(task.maintenance?.subsectionId);
				}
				return false;
			});

			if (!inScope) {
				return res.status(403).json({ message: "Forbidden" });
			}
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
			type: failureData.type ?? undefined,
			cause: failureData.cause ?? undefined,
			locationId: failureData.locationId !== undefined ? (failureData.locationId || null) : undefined,
			stationId: failureData.stationId !== undefined ? (failureData.stationId || null) : undefined,
			restorationTime:
				failureData.restorationTime !== undefined
					? failureData.restorationTime
						? new Date(failureData.restorationTime)
						: null
					: undefined,
			remarks: failureData.remarks !== undefined ? (failureData.remarks || null) : undefined,
			cableCutId: failureData.cableCutId !== undefined ? (failureData.cableCutId || null) : undefined,
			failureInTime:
				failureData.failureInTime !== undefined
					? failureData.failureInTime
						? new Date(failureData.failureInTime)
						: null
					: undefined,
			isHqRepeated:
				parseBoolean(failureData.isHqRepeated, undefined),
			isIcmsRepeated:
				parseBoolean(failureData.isIcmsRepeated, undefined),
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
				"failureInTime",
				"isHqRepeated",
				"isIcmsRepeated",
				"restorationTime",
				"remarks",
				"cableCutId",
			];

			const changedFields = trackedFields.filter(
				(key) => (before[key] ?? null) !== (failure[key] ?? null)
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
					isHqRepeated:
						typeof cleanedFailureData.isHqRepeated === "boolean"
							? cleanedFailureData.isHqRepeated
							: false,
					isIcmsRepeated:
						typeof cleanedFailureData.isIcmsRepeated === "boolean"
							? cleanedFailureData.isIcmsRepeated
							: false,
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
 * DELETE TASK
 */
export const deleteTask = async (req, res) => {
	const { id } = req.params;
	try {
		const task = await prisma.task.findUnique({
			where: { id },
			include: {
				owner: { select: { divisionId: true } },
			},
		});

		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		if (!isSuperAdmin(req) && task.owner?.divisionId !== req.user.divisionId) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const canDelete =
			req.user.role === "SUPER_ADMIN" ||
			req.user.role === "ADMIN" ||
			req.user.role === "TESTROOM" ||
			task.ownerId === req.user.id;
		if (!canDelete) {
			return res.status(403).json({ message: "Only owner/Testroom/Admin can delete task." });
		}

		await prisma.$transaction(async (tx) => {
			await tx.failure.deleteMany({ where: { taskId: id } });
			await tx.maintenance.deleteMany({ where: { taskId: id } });
			await tx.tRCRequest.deleteMany({ where: { taskId: id } });
			await tx.task.delete({ where: { id } });
		});

		if (task.projectId) {
			await syncProjectProgress(task.projectId);
		}

		return res.status(200).json({ message: "Task deleted successfully" });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

/**
 * Escalate overdue failure tickets
 * This should be called by a scheduler/cron (e.g., every 30 minutes)
 */
export const escalateOverdueFailures = async (req, res) => {
	return res.status(501).json({ message: "SLA escalation is not enabled in current schema." });
};
