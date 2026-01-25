import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
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

		// 3. Attach the user info to the request object
		// This makes req.user.id and req.user.divisionId available in your controllers
		req.user = decoded;

		next(); // Move to the controller
	} catch (error) {
		return res
			.status(401)
			.json({ message: "Unauthorized! Invalid or expired token." });
	}
};
