import prisma from "../lib/prisma";

const updateProjectProgress = async (projectId) => {
	const tasks = await prisma.task.findMany({
		where: { projectId },
		select: { weight: true, status: true },
	});

	if (tasks.length === 0) {
		return await prisma.project.update({
			where: { id: projectId },
			data: { totalProgress: 0 },
		});
	}

	const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || 0), 0);
	const closedWeight = tasks
		.filter((t) => t.status === "CLOSED")
		.reduce((sum, t) => sum + (t.weight || 0), 0);

	const progress = totalWeight > 0 ? (closedWeight / totalWeight) * 100 : 0;

	return await prisma.project.update({
		where: { id: projectId },
		data: { totalProgress: Math.round(progress * 100) / 100 },
	});
};

/**
 * CREATE PROJECT
 */
export const createProject = async (req, res) => {
	try {
		const { name, description, startDate, endDate } = req.body;
		const ownerId = req.user.id;

		const project = await prisma.project.create({
			data: {
				name,
				description,
				startDate: new Date(startDate),
				endDate: endDate ? new Date(endDate) : null,
				ownerId,
			},
		});

		res
			.status(201)
			.json({ message: "Project initiated successfully", project });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * GET ALL PROJECTS (With Summary)
 */
export const getProjects = async (req, res) => {
	try {
		const projects = await prisma.project.findMany({
			include: {
				_count: {
					select: { tasks: true },
				},
				owner: {
					select: {
						name: true,
						username: true, // Changed from employeeId to username
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});
		res.status(200).json(projects);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * GET PROJECT DETAILS (With Tasks)
 */
export const getProjectDetails = async (req, res) => {
	try {
		const { id } = req.params;
		const project = await prisma.project.findUnique({
			where: { id },
			include: {
				tasks: {
					include: {
						assignedTo: { select: { name: true } },
						failure: true,
						maintenance: true,
					},
					orderBy: { createdAt: "desc" },
				},
				owner: { select: { name: true } },
			},
		});

		if (!project) return res.status(404).json({ message: "Project not found" });

		res.status(200).json(project);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * UPDATE PROJECT STATUS
 */
export const updateProject = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, name, description, endDate } = req.body;

		const updatedProject = await prisma.project.update({
			where: { id },
			data: {
				status,
				name,
				description,
				endDate: endDate ? new Date(endDate) : undefined,
			},
		});

		res.status(200).json(updatedProject);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * RECALCULATE PROGRESS (Manual Trigger)
 */
export const syncProjectProgress = async (req, res) => {
	try {
		const { id } = req.params;
		const project = await updateProjectProgress(id);
		res.status(200).json({
			message: "Progress synchronized",
			progress: project.totalProgress,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
