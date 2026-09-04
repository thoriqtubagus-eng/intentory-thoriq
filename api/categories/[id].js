const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function (req, res) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");

    const { id } = req.query;

    if (req.method === "GET") {
      const category = await prisma.category.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!category) return jsonError(res, 404, "Category not found");
      return res.status(200).json(category);
    }

    if (req.method === "PUT") {
      if (!authorize(user, "admin", "warehouse_staff"))
        return jsonError(res, 403, "Forbidden");

      const body = await parseBody(req);
      const { name, description } = body;
      const category = await prisma.category.update({
        where: { id },
        data: { name, description },
      });
      return res.status(200).json(category);
    }

    if (req.method === "DELETE") {
      if (!authorize(user, "admin"))
        return jsonError(res, 403, "Forbidden");

      await prisma.category.delete({ where: { id } });
      return res.status(204).end();
    }

    return jsonError(res, 405, "Method not allowed");
  } catch (error) {
    return jsonError(res, 500, error.message);
  }
};
