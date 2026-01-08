import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

// Create and Save a new user
const create = async (req, res) => {
	if (
		!req.body.email &&
		!req.body.name &&
		!req.body.designation &&
		!req.body.password
	) {
		res.status(400).send({ message: "Content can not be empty!" });
	}

	const { email, name, designation, password, role, username } = req.body;

	try {
		const user = await prisma.user.create({
			data: {
				name: name,
				email: email,
				username: username,
				password: bcrypt.hashSync(password, 8),
				designation: designation,
				role: role,
			},
		});

		res.status(201).json({
			message: "User registered successfully!!",
			user,
		});
		res.status(201).json({
			message: "User registered successfully!!",
			user,
		});
	} catch (error) {
		res.status(500).json(error.message);
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
		});

		if (!user) {
			return res.status(404).json({ message: "User not found." });
		}

		const passwordIsValid = bcrypt.compareSync(password, user.password);
		if (!passwordIsValid) {
			return res.status(401).json({ message: "Invalid Password!" });
		}

		const token = jwt.sign(
			{ id: user.id, role: user.role, username: user.username },
			process.env.API_SECRET,
			{ expiresIn: "24h" },
		);

		return res.status(200).json({
			user: {
				id: user.id,
				username: user.username,
				fullName: user.name,
				role: user.role,
			},
			message: "Login successful",
			accessToken: token,
		});
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
};

export { create, signin };
