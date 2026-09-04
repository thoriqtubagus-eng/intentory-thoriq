const { prisma } = require("../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../_lib/auth");
const { parseBody } = require("../../_lib/utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed");
  }

  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "warehouse_staff", "head_of_warehouse")) {
      return jsonError(res, 403, "Forbidden");
    }

    const { id } = req.query;
    const body = await parseBody(req);
    const { status, reason } = body;

    const existing = await prisma.itemRequest.findUnique({ where: { id } });
    if (!existing) return jsonError(res, 404, "Item request not found");
    if (existing.status !== "WAITING_APPROVAL") {
      return jsonError(res, 400, "Only WAITING_APPROVAL requests can be rejected");
    }

    const updated = await prisma.itemRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectReason: reason || null,
      },
      include: {
        createdBy: true,
        approvedBy: true,
        items: { include: { item: true } },
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    return jsonError(res, 500, "Internal server error");
  }
};
