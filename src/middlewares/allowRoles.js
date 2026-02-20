export const allowRoles = (...roles) => {
	const allowed = new Set(roles.flat());
	return (req, res, next) => {
		const role = req.user?.role;
		if (!role) {
			return res.status(403).json({ message: 'Forbidden: Missing role' });
		}
		if (role === 'SUPER_ADMIN') return next();
		if (!allowed.has(role)) {
			return res.status(403).json({ message: 'Forbidden: Insufficient role' });
		}
		return next();
	};
};
