const { prisma } = require("../../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../../_lib/auth");

module.exports = async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const incoming = await prisma.incomingGoods.findUnique({
        where: { id },
        include: {
          supplier: true,
          approvedBy: true,
          receivedBy: true,
          createdBy: true,
          items: { include: { item: true } },
        },
      });
      if (!incoming) return jsonError(res, 404, "Incoming goods not found");

      return res.status(200).json(incoming);
    } catch (error) {
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "PUT") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin", "warehouse_staff")) {
        return jsonError(res, 403, "Forbidden");
      }

      const existing = await prisma.incomingGoods.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Incoming goods not found");
      if (existing.status !== "DRAFT") {
        return jsonError(res, 400, "Only DRAFT incoming goods can be edited");
      }

      const { supplierId, items, notes, receivedAt, referenceNumber } = req.body;

      const updated = await prisma.$transaction(async (tx) => {
        if (items && Array.isArray(items)) {
          await tx.incomingGoodsItem.deleteMany({ where: { incomingGoodsId: id } });
          await tx.incomingGoodsItem.createMany({
            data: items.map((item) => ({
              incomingGoodsId: id,
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice || null,
            })),
          });
        }

        return tx.incomingGoods.update({
          where: { id },
          data: {
            ...(supplierId !== undefined && { supplierId }),
            ...(referenceNumber !== undefined && { referenceNumber }),
            ...(notes !== undefined && { notes }),
            ...(receivedAt !== undefined && { receivedAt: new Date(receivedAt) }),
          },
          include: {
            supplier: true,
            approvedBy: true,
            receivedBy: true,
            createdBy: true,
            items: { include: { item: true } },
          },
        });
      });

      return res.status(200).json(updated);
    } catch (error) {
      if (error.code === "P2003") {
        return jsonError(res, 400, "Invalid supplier or item reference");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "DELETE") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin", "warehouse_staff")) {
        return jsonError(res, 403, "Forbidden");
      }

      await prisma.incomingGoods.delete({ where: { id } });
      return res.status(200).json({ message: "Incoming goods deleted successfully" });
    } catch (error) {
      if (error.code === "P2025") {
        return jsonError(res, 404, "Incoming goods not found");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
