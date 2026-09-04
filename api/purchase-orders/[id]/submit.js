const { prisma } = require("../../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed");

  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "divisi")) {
      return jsonError(res, 403, "Forbidden");
    }

    const { id } = req.query;

    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) return jsonError(res, 404, "Purchase order not found");
    if (order.status !== "DRAFT") {
      return jsonError(res, 400, "Only DRAFT orders can be submitted");
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "WAITING_APPROVAL" },
      include: {
        createdBy: true,
        supplier: true,
        items: { include: { item: true } },
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    return jsonError(res, 500, "Internal server error");
  }
};
