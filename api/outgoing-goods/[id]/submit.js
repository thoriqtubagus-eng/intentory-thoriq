const { prisma } = require("../../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed");
  }

  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "warehouse_staff")) {
      return jsonError(res, 403, "Forbidden");
    }

    const { id } = req.query;

    const existing = await prisma.outgoingGood.findUnique({ where: { id } });
    if (!existing) return jsonError(res, 404, "Outgoing good not found");
    if (existing.status !== "DRAFT") {
      return jsonError(res, 400, "Only DRAFT outgoing goods can be submitted");
    }

    const updated = await prisma.outgoingGood.update({
      where: { id },
      data: { status: "WAITING_APPROVAL" },
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === "P2025") {
      return jsonError(res, 404, "Outgoing good not found");
    }
    return jsonError(res, 500, "Internal server error");
  }
};
