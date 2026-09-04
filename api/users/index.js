const bcrypt = require("bcryptjs");
const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return res.status(200).json(users);
    }

    if (req.method === "POST") {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");

      const body = await parseBody(req);
      const { username, password, role } = body;

      if (!username || !password) {
        return jsonError(res, 400, "Username and password are required");
      }

      const existing = await prisma.user.findUnique({
        where: { username },
      });
      if (existing) return jsonError(res, 409, "Username already exists");

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          role: role || "user",
        },
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(201).json(newUser);
    }

    return jsonError(res, 405, "Method not allowed");
  } catch (error) {
    return jsonError(res, 500, error.message);
  }
};
