const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          createdBy: true,
          supplier: true,
          items: { include: { item: true } },
          approvedBy: true,
        },
      });
      if (!order) return jsonError(res, 404, "Purchase order not found");

      return res.status(200).json(order);
    } catch (error) {
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "PUT") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin", "divisi")) {
        return jsonError(res, 403, "Forbidden");
      }

      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Purchase order not found");
      if (existing.status !== "DRAFT") {
        return jsonError(res, 400, "Only DRAFT orders can be edited");
      }

      const body = await parseBody(req);
      const { supplierId, items, notes, expectedDate } = body;

      if (supplierId) {
        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) return jsonError(res, 400, "Supplier not found");
      }

      if (items && Array.isArray(items)) {
        for (const item of items) {
          const exists = await prisma.item.findUnique({ where: { id: item.itemId } });
          if (!exists) return jsonError(res, 400, `Item ${item.itemId} not found`);
        }
      }

      const totalAmount = items
        ? items.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0)
        : existing.totalAmount;

      const updated = await prisma.$transaction(async (tx) => {
        if (items && Array.isArray(items)) {
          await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
          await tx.purchaseOrderItem.createMany({
            data: items.map((item) => ({
              purchaseOrderId: id,
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          });
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            ...(supplierId && { supplierId }),
            ...(totalAmount !== undefined && { totalAmount }),
            ...(notes !== undefined && { notes }),
            ...(expectedDate && { expectedDate: new Date(expectedDate) }),
          },
          include: {
            createdBy: true,
            supplier: true,
            items: { include: { item: true } },
          },
        });
      });

      return res.status(200).json(updated);
    } catch (error) {
      if (error.code === "P2025") {
        return jsonError(res, 404, "Purchase order not found");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "DELETE") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin", "divisi")) {
        return jsonError(res, 403, "Forbidden");
      }

      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Purchase order not found");

      await prisma.purchaseOrder.delete({ where: { id } });

      return res.status(200).json({ message: "Purchase order deleted successfully" });
    } catch (error) {
      if (error.code === "P2025") {
        return jsonError(res, 404, "Purchase order not found");
      }
      if (error.code === "P2003") {
        return jsonError(res, 400, "Cannot delete order with existing references");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
