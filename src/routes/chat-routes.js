import express from "express";
import {
	addChatMessage,
	createOrGetConversation,
	getChatUsers,
	getConversationMessages,
	getMyConversations,
	getUnreadCount,
} from "../controllers/chat-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = express.Router();

router.get(
	"/users",
	verifyToken,
	getChatUsers,
);

router.get(
	"/conversations",
	verifyToken,
	getMyConversations,
);

router.get(
	"/unread-count",
	verifyToken,
	getUnreadCount,
);

router.post(
	"/conversations",
	verifyToken,
	createOrGetConversation,
);

router.get(
	"/conversations/:conversationId/messages",
	verifyToken,
	getConversationMessages,
);

router.post(
	"/conversations/:conversationId/messages",
	verifyToken,
	addChatMessage,
);

export default router;
