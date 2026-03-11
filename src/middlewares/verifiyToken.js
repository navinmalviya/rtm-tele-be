import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

export const verifyToken = async (req, res, next) => {
	// 1. Get token from the Authorization header (Bearer <token>)
	const authHeader = req.headers.authorization;
	const token = authHeader?.split(" ")[1];

	if (!token) {
		return res
			.status(403)
			.json({ message: "No token provided. Access Denied." });
	}

	try {
		// 2. Verify the JWT
		const decoded = jwt.verify(token, process.env.API_SECRET);
		const user = await prisma.user.findUnique({
			where: { id: decoded.id },
			select: {
				id: true,
				role: true,
				divisionId: true,
				username: true,
			},
		});
		if (!user) {
			return res
				.status(401)
				.json({ message: "Unauthorized! User no longer exists." });
		}

		// 3. Attach the user info to the request object
		// Keep token role (FIELD_ENGINEER mapping) but always refresh division/user context from DB.
		req.user = {
			...decoded,
			id: user.id,
			username: user.username,
			divisionId: user.divisionId,
			originalRole: user.role,
		};

		next(); // Move to the controller
	} catch (_error) {
		return res
			.status(401)
			.json({ message: "Unauthorized! Invalid or expired token." });
	}
};
