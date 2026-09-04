const { prisma } = require("../../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed");
  }

  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "head_of_warehouse")) {
      return jsonError(res, 403, "Forbidden");
    }

    const { id } = req.query;
    const { status, reason } = req.body;

    const existing = await prisma.incomingGoods.findUnique({ where: { id } });
    if (!existing) return jsonError(res, 404, "Incoming goods not found");
    if (existing.status !== "WAITING_APPROVAL") {
      return jsonError(res, 400, "Only WAITING_APPROVAL incoming goods can be rejected");
    }

    const updated = await prisma.incomingGoods.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectReason: reason || null,
      },
      include: {
        supplier: true,
        approvedBy: true,
        receivedBy: true,
        createdBy: true,
        items: { include: { item: true } },
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    return jsonError(res, 500, "Internal server error");
  }
};
