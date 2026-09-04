const { prisma } = require("../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../_lib/auth");

module.exports = async function (req, res) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");

    if (req.method === "GET") {
      const categories = await prisma.category.findMany({
        include: { _count: { select: { items: true } } },
      });
      return res.status(200).json(categories);
    }

    if (req.method === "POST") {
      if (!authorize(user, "admin", "warehouse_staff"))
        return jsonError(res, 403, "Forbidden");

      const { name, description } = req.body;
      if (!name) return jsonError(res, 400, "Name is required");

      const category = await prisma.category.create({
        data: { name, description },
      });
      return res.status(201).json(category);
    }

    return jsonError(res, 405, "Method not allowed");
  } catch (error) {
    return jsonError(res, 500, error.message);
  }
};
