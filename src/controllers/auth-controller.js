import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const create = async (req, res) => {
	const { email, name, designation, password, role, username, divisionId } =
		req.body;

	// Basic validation
	if (!email || !name || !password || !username || !divisionId) {
		return res.status(400).send({
			message:
				"Required fields are missing! (Email, Name, Password, Username, DivisionId)",
		});
	}

	try {
		const user = await prisma.user.create({
			data: {
				name,
				email,
				username,
				password: bcrypt.hashSync(password, 8),
				designation,
				role,
				divisionId, // Now linking user to their Railway Division
			},
		});

		return res.status(201).json({
			message: "User registered successfully!!",
			user: {
				id: user.id,
				username: user.username,
				divisionId: user.divisionId,
			},
		});
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
};

const signin = async (req, res) => {
	const { username, password } = req.body;

	if (!username || !password) {
		return res
			.status(400)
			.json({ message: "Username and password are required!" });
	}

	try {
		const user = await prisma.user.findUnique({
			where: { username: username },
			include: {
				division: true, // This fetches the full Division object
			},
		});

		// ... (keep your password validation logic)

		const token = jwt.sign(
			{
				id: user.id,
				role: user.role,
				username: user.username,
				divisionId: user.divisionId, // This is the UUID string from the User table
			},
			process.env.API_SECRET,
			{ expiresIn: "24h" },
		);

		return res.status(200).json({
			user: {
				id: user.id,
				username: user.username,
				fullName: user.name,
				role: user.role,
				// Accessing the ID directly from the user record
				divisionId: user.divisionId,
				// Accessing the code from the nested 'division' object fetched via 'include'
				divisionCode: user.division?.code || "N/A",
				divisionName: user.division?.name || "N/A",
			},
			message: "Login successful",
			accessToken: token,
		});
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
};

export { create, signin };
