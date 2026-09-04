const { prisma } = require("../_lib/prisma");
const { authenticate, jsonError } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return jsonError(res, 405, "Method not allowed");

  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");

    const { itemId } = req.query;

    const movements = await prisma.stockMovement.findMany({
      where: { itemId },
      include: {
        item: true,
        performedBy: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(movements);
  } catch (error) {
    return jsonError(res, 500, "Internal server error");
  }
};
