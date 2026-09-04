const jwt = require("jsonwebtoken");
const { prisma } = require("./prisma");

async function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    return user;
  } catch {
    return null;
  }
}

function authorize(user, ...roles) {
  if (!roles.includes(user.role)) {
    return false;
  }
  return true;
}

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = { authenticate, authorize, jsonError };
