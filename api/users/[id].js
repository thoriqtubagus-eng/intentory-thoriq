const bcrypt = require("bcryptjs");
const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function handler(req, res) {
  try {
    const { id } = req.query;

    if (req.method === "GET") {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const foundUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!foundUser) return jsonError(res, 404, "User not found");
      return res.status(200).json(foundUser);
    }

    if (req.method === "PUT") {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");

      const body = await parseBody(req);
      const { username, password, role } = body;

      const existing = await prisma.user.findUnique({
        where: { id },
      });
      if (!existing) return jsonError(res, 404, "User not found");

      if (username && username !== existing.username) {
        const duplicate = await prisma.user.findUnique({
          where: { username },
        });
        if (duplicate) return jsonError(res, 409, "Username already exists");
      }

      const updateData = {};
      if (username) updateData.username = username;
      if (role) updateData.role = role;
      if (password) updateData.password = await bcrypt.hash(password, 10);

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json(updatedUser);
    }

    if (req.method === "DELETE") {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");

      const existing = await prisma.user.findUnique({
        where: { id },
      });
      if (!existing) return jsonError(res, 404, "User not found");

      await prisma.user.delete({ where: { id } });
      return res.status(204).end();
    }

    return jsonError(res, 405, "Method not allowed");
  } catch (error) {
    return jsonError(res, 500, error.message);
  }
};
