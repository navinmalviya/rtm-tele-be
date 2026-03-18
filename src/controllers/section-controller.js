import prisma from "../lib/prisma.js";
import { isFieldScopedRole, isSuperAdmin } from "../lib/access-scope.js";

export const createSection = async (req, res) => {
	try {
		const { name, code, subsectionIds = [] } = req.body;
		const divisionId = isSuperAdmin(req)
			? req.body.divisionId || req.user.divisionId
			: req.user.divisionId;

		if (!name || !code) {
			return res.status(400).json({ message: "name and code are required." });
		}

		if (Array.isArray(subsectionIds) && subsectionIds.length > 0) {
			const validSubs = await prisma.subsection.count({
				where: {
					id: { in: subsectionIds },
					divisionId,
				},
			});
			if (validSubs !== subsectionIds.length) {
				return res.status(400).json({ message: "Invalid subsection list for division." });
			}
		}

		const section = await prisma.$transaction(async (tx) => {
			const created = await tx.section.create({
				data: {
					name: String(name).trim(),
					code: String(code).trim(),
					divisionId,
				},
			});

			if (Array.isArray(subsectionIds) && subsectionIds.length > 0) {
				await tx.subsection.updateMany({
					where: {
						id: { in: subsectionIds },
						divisionId,
					},
					data: { sectionId: created.id },
				});
			}

			return tx.section.findUnique({
				where: { id: created.id },
				include: {
					subsections: {
						select: { id: true, code: true, name: true },
					},
				},
			});
		});

		return res.status(201).json(section);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const findAllSections = async (req, res) => {
	try {
		const where = isSuperAdmin(req) ? {} : { divisionId: req.user.divisionId };

		if (isFieldScopedRole(req)) {
			where.subsections = {
				some: { supervisorId: req.user.id },
			};
		}

		const sections = await prisma.section.findMany({
			where,
			include: {
				subsections: {
					where: isFieldScopedRole(req) ? { supervisorId: req.user.id } : undefined,
					select: {
						id: true,
						name: true,
						code: true,
						fromStationId: true,
						toStationId: true,
					},
				},
			},
			orderBy: { code: "asc" },
		});

		return res.status(200).json(sections);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const getSectionDetails = async (req, res) => {
	try {
		const { id } = req.params;

		const where = {
			id,
			...(isSuperAdmin(req) ? {} : { divisionId: req.user.divisionId }),
		};

		if (isFieldScopedRole(req)) {
			where.subsections = { some: { supervisorId: req.user.id } };
		}

		const section = await prisma.section.findFirst({
			where,
			include: {
				subsections: {
					where: isFieldScopedRole(req) ? { supervisorId: req.user.id } : undefined,
					select: {
						id: true,
						name: true,
						code: true,
						fromStation: { select: { id: true, code: true, name: true } },
						toStation: { select: { id: true, code: true, name: true } },
					},
				},
			},
		});

		if (!section) {
			return res.status(404).json({ message: "Section not found." });
		}

		return res.status(200).json(section);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const deleteSection = async (req, res) => {
	try {
		const { id } = req.params;
		const section = await prisma.section.findFirst({
			where: {
				id,
				...(isSuperAdmin(req) ? {} : { divisionId: req.user.divisionId }),
			},
			select: { id: true },
		});

		if (!section) {
			return res.status(404).json({ message: "Section not found." });
		}

		await prisma.$transaction(async (tx) => {
			await tx.subsection.updateMany({
				where: { sectionId: id },
				data: { sectionId: null },
			});
			await tx.section.delete({ where: { id } });
		});

		return res.status(200).json({ message: "Section deleted." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};
