const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const request = await prisma.itemRequest.findUnique({
        where: { id },
        include: {
          createdBy: true,
          approvedBy: true,
          items: { include: { item: true } },
        },
      });
      if (!request) return jsonError(res, 404, "Item request not found");

      return res.status(200).json(request);
    } catch (error) {
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "PUT") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const existing = await prisma.itemRequest.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Item request not found");
      if (existing.status !== "DRAFT") {
        return jsonError(res, 400, "Only DRAFT requests can be edited");
      }

      const body = await parseBody(req);
      const { reason, items, requestedBy, department, requiredDate, notes } = body;

      const updated = await prisma.$transaction(async (tx) => {
        if (items && Array.isArray(items)) {
          await tx.itemRequestItem.deleteMany({ where: { itemRequestId: id } });
          await tx.itemRequestItem.createMany({
            data: items.map((item) => ({
              itemRequestId: id,
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          });
        }

        return tx.itemRequest.update({
          where: { id },
          data: {
            ...(reason !== undefined && { reason }),
            ...(requestedBy !== undefined && { requestedBy }),
            ...(department !== undefined && { department }),
            ...(requiredDate !== undefined && { requiredDate: new Date(requiredDate) }),
            ...(notes !== undefined && { notes }),
          },
          include: {
            createdBy: true,
            approvedBy: true,
            items: { include: { item: true } },
          },
        });
      });

      return res.status(200).json(updated);
    } catch (error) {
      if (error.code === "P2003") {
        return jsonError(res, 400, "Invalid item reference");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "DELETE") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      await prisma.itemRequest.delete({ where: { id } });

      return res.status(200).json({ message: "Item request deleted successfully" });
    } catch (error) {
      if (error.code === "P2025") {
        return jsonError(res, 404, "Item request not found");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
