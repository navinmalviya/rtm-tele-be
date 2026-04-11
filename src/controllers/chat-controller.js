import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import prisma from "../lib/prisma.js";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const CHAT_UPLOAD_DIR = path.resolve("uploads", "chat");

const buildPairKey = (userAId, userBId) => [userAId, userBId].sort().join(":");

const sanitizeFileName = (name = "document") =>
	String(name)
		.replace(/[^a-zA-Z0-9._-]/g, "_")
		.replace(/_+/g, "_")
		.slice(-120);

const toAbsoluteAttachmentUrl = (req, attachmentPath) => {
	if (!attachmentPath) return null;
	if (/^https?:\/\//i.test(attachmentPath)) return attachmentPath;
	return `${req.protocol}://${req.get("host")}${attachmentPath}`;
};

const ensureTargetUserAccessible = async (req, targetUserId) => {
	const where = { id: targetUserId };
	if (req.user.role !== "SUPER_ADMIN" && req.user.divisionId) {
		where.divisionId = req.user.divisionId;
	}
	return prisma.user.findFirst({
		where,
		select: { id: true, name: true, username: true, designation: true, role: true },
	});
};

const ensureConversationAccess = async (conversationId, userId) => {
	return prisma.chatConversation.findFirst({
		where: {
			id: conversationId,
			OR: [{ participantAId: userId }, { participantBId: userId }],
		},
		select: {
			id: true,
			participantAId: true,
			participantBId: true,
			participantALastReadAt: true,
			participantBLastReadAt: true,
		},
	});
};

const getConversationReadAt = (conversation, userId) =>
	conversation.participantAId === userId
		? conversation.participantALastReadAt
		: conversation.participantBLastReadAt;

const buildReadUpdateData = (conversation, userId, at = new Date()) =>
	conversation.participantAId === userId
		? { participantALastReadAt: at }
		: { participantBLastReadAt: at };

const getUnreadCountForConversation = async (conversation, userId) => {
	const readAt = getConversationReadAt(conversation, userId) || new Date(0);
	return prisma.chatMessage.count({
		where: {
			conversationId: conversation.id,
			senderId: { not: userId },
			createdAt: { gt: readAt },
		},
	});
};

const mapConversation = (conversation, userId, req, unreadCount = 0) => {
	const peer =
		conversation.participantAId === userId
			? conversation.participantB
			: conversation.participantA;
	const lastMessage = conversation.messages?.[0] || null;

	return {
		id: conversation.id,
		lastMessageAt: conversation.lastMessageAt,
		createdAt: conversation.createdAt,
		unreadCount,
		peer,
		lastMessage: lastMessage
			? {
					id: lastMessage.id,
					text: lastMessage.text,
					createdAt: lastMessage.createdAt,
					senderId: lastMessage.senderId,
					sender: lastMessage.sender,
					attachmentName: lastMessage.attachmentName,
					attachmentType: lastMessage.attachmentType,
					attachmentSize: lastMessage.attachmentSize,
					attachmentPath: lastMessage.attachmentPath,
					attachmentUrl: toAbsoluteAttachmentUrl(req, lastMessage.attachmentPath),
				}
			: null,
	};
};

const getChatUsers = async (req, res) => {
	const q = String(req.query.q || "").trim();
	const where = {
		id: { not: req.user.id },
	};

	if (req.user.role !== "SUPER_ADMIN" && req.user.divisionId) {
		where.divisionId = req.user.divisionId;
	}
	if (q) {
		where.OR = [
			{ name: { contains: q, mode: "insensitive" } },
			{ username: { contains: q, mode: "insensitive" } },
			{ designation: { contains: q, mode: "insensitive" } },
			{ email: { contains: q, mode: "insensitive" } },
		];
	}

	try {
		const users = await prisma.user.findMany({
			where,
			select: {
				id: true,
				name: true,
				username: true,
				designation: true,
				unit: true,
				role: true,
			},
			orderBy: { name: "asc" },
			take: 100,
		});
		return res.status(200).json(users);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

const getMyConversations = async (req, res) => {
	try {
		const conversations = await prisma.chatConversation.findMany({
			where: {
				OR: [{ participantAId: req.user.id }, { participantBId: req.user.id }],
			},
			include: {
				participantA: {
					select: { id: true, name: true, username: true, designation: true, role: true },
				},
				participantB: {
					select: { id: true, name: true, username: true, designation: true, role: true },
				},
				messages: {
					orderBy: { createdAt: "desc" },
					take: 1,
					select: {
						id: true,
						text: true,
						createdAt: true,
						senderId: true,
						attachmentName: true,
						attachmentType: true,
						attachmentSize: true,
						attachmentPath: true,
						sender: { select: { id: true, name: true } },
					},
				},
			},
			orderBy: { lastMessageAt: "desc" },
		});

		const unreadCounts = await Promise.all(
			conversations.map((conversation) => getUnreadCountForConversation(conversation, req.user.id))
		);

		return res.status(200).json(
			conversations.map((conversation, index) =>
				mapConversation(conversation, req.user.id, req, unreadCounts[index] || 0)
			)
		);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

const getUnreadCount = async (req, res) => {
	try {
		const conversations = await prisma.chatConversation.findMany({
			where: {
				OR: [{ participantAId: req.user.id }, { participantBId: req.user.id }],
			},
			select: {
				id: true,
				participantAId: true,
				participantBId: true,
				participantALastReadAt: true,
				participantBLastReadAt: true,
			},
		});

		const counts = await Promise.all(
			conversations.map((conversation) => getUnreadCountForConversation(conversation, req.user.id))
		);
		const total = counts.reduce((sum, value) => sum + Number(value || 0), 0);

		return res.status(200).json({ total });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

const createOrGetConversation = async (req, res) => {
	const targetUserId = String(req.body?.targetUserId || "").trim();
	if (!targetUserId) {
		return res.status(400).json({ message: "targetUserId is required." });
	}
	if (targetUserId === req.user.id) {
		return res.status(400).json({ message: "You cannot start a conversation with yourself." });
	}

	try {
		const targetUser = await ensureTargetUserAccessible(req, targetUserId);
		if (!targetUser) {
			return res.status(404).json({ message: "Target user not found." });
		}

		const pairKey = buildPairKey(req.user.id, targetUserId);
		const [participantAId, participantBId] = [req.user.id, targetUserId].sort();

		const conversation = await prisma.chatConversation.upsert({
			where: { pairKey },
			update: {},
			create: {
				pairKey,
				createdById: req.user.id,
				participantAId,
				participantBId,
			},
			include: {
				participantA: {
					select: { id: true, name: true, username: true, designation: true, role: true },
				},
				participantB: {
					select: { id: true, name: true, username: true, designation: true, role: true },
				},
				messages: {
					orderBy: { createdAt: "desc" },
					take: 1,
					select: {
						id: true,
						text: true,
						createdAt: true,
						senderId: true,
						attachmentName: true,
						attachmentType: true,
						attachmentSize: true,
						attachmentPath: true,
						sender: { select: { id: true, name: true } },
					},
				},
			},
		});

		return res.status(200).json(mapConversation(conversation, req.user.id, req));
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

const getConversationMessages = async (req, res) => {
	const { conversationId } = req.params;
	const take = Math.min(Number.parseInt(req.query.take || "200", 10), 500);

	try {
		const conversation = await ensureConversationAccess(conversationId, req.user.id);
		if (!conversation) {
			return res.status(404).json({ message: "Conversation not found." });
		}

		await prisma.chatConversation.update({
			where: { id: conversationId },
			data: buildReadUpdateData(conversation, req.user.id, new Date()),
		});

		const messages = await prisma.chatMessage.findMany({
			where: { conversationId },
			orderBy: { createdAt: "asc" },
			take,
			select: {
				id: true,
				text: true,
				createdAt: true,
				attachmentName: true,
				attachmentType: true,
				attachmentSize: true,
				attachmentPath: true,
				senderId: true,
				sender: { select: { id: true, name: true, username: true } },
			},
		});

		return res.status(200).json(
			messages.map((msg) => ({
				...msg,
				attachmentUrl: toAbsoluteAttachmentUrl(req, msg.attachmentPath),
			}))
		);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

const addChatMessage = async (req, res) => {
	const { conversationId } = req.params;
	const text = String(req.body?.text || "").trim();
	const attachment = req.body?.attachment || null;

	try {
		const conversation = await ensureConversationAccess(conversationId, req.user.id);
		if (!conversation) {
			return res.status(404).json({ message: "Conversation not found." });
		}

		let attachmentRecord = null;
		if (attachment) {
			const fileName = sanitizeFileName(attachment.fileName || "document");
			const mimeType = String(attachment.mimeType || "application/octet-stream");
			const base64Raw = String(attachment.contentBase64 || "");
			const cleanBase64 = base64Raw.replace(/^data:.*;base64,/, "");
			const fileBuffer = Buffer.from(cleanBase64, "base64");

			if (!fileBuffer?.length) {
				return res.status(400).json({ message: "Attachment content is invalid." });
			}
			if (fileBuffer.length > MAX_ATTACHMENT_BYTES) {
				return res
					.status(400)
					.json({ message: "Attachment exceeds 10 MB limit." });
			}

			await fs.mkdir(CHAT_UPLOAD_DIR, { recursive: true });
			const ext = path.extname(fileName) || "";
			const storedFileName = `${Date.now()}-${randomUUID()}${ext}`;
			const absoluteFilePath = path.join(CHAT_UPLOAD_DIR, storedFileName);
			await fs.writeFile(absoluteFilePath, fileBuffer);

			attachmentRecord = {
				attachmentName: fileName,
				attachmentType: mimeType,
				attachmentSize: fileBuffer.length,
				attachmentPath: `/uploads/chat/${storedFileName}`,
			};
		}

		if (!text && !attachmentRecord) {
			return res.status(400).json({ message: "Message text or attachment is required." });
		}

		const [message] = await prisma.$transaction([
			prisma.chatMessage.create({
				data: {
					conversationId,
					senderId: req.user.id,
					text: text || null,
					...(attachmentRecord || {}),
				},
				select: {
					id: true,
					text: true,
					createdAt: true,
					senderId: true,
					attachmentName: true,
					attachmentType: true,
					attachmentSize: true,
					attachmentPath: true,
					sender: { select: { id: true, name: true, username: true } },
				},
			}),
			prisma.chatConversation.update({
				where: { id: conversationId },
				data: {
					lastMessageAt: new Date(),
					...buildReadUpdateData(conversation, req.user.id, new Date()),
				},
			}),
		]);

		return res.status(201).json({
			...message,
			attachmentUrl: toAbsoluteAttachmentUrl(req, message.attachmentPath),
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export {
	addChatMessage,
	createOrGetConversation,
	getChatUsers,
	getConversationMessages,
	getMyConversations,
	getUnreadCount,
};
