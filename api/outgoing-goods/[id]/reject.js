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

    if (!status || !reason) {
      return jsonError(res, 400, "status and reason are required");
    }

    const existing = await prisma.outgoingGood.findUnique({ where: { id } });
    if (!existing) return jsonError(res, 404, "Outgoing good not found");
    if (existing.status !== "WAITING_APPROVAL") {
      return jsonError(
        res,
        400,
        "Only WAITING_APPROVAL outgoing goods can be rejected"
      );
    }

    const updated = await prisma.outgoingGood.update({
      where: { id },
      data: {
        status,
        rejectReason: reason,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === "P2025") {
      return jsonError(res, 404, "Outgoing good not found");
    }
    return jsonError(res, 500, "Internal server error");
  }
};
