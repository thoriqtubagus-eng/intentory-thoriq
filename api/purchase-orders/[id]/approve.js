const { prisma } = require("../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../_lib/auth");
const { parseBody } = require("../../_lib/utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed");

  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "head_of_warehouse")) {
      return jsonError(res, 403, "Forbidden");
    }

    const { id } = req.query;
    const body = await parseBody(req);
    const { items: rejectedItems, signatureImage } = body;

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) return jsonError(res, 404, "Purchase order not found");
    if (order.status !== "WAITING_APPROVAL") {
      return jsonError(res, 400, "Only WAITING_APPROVAL orders can be approved");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (rejectedItems && Array.isArray(rejectedItems) && rejectedItems.length > 0) {
        await tx.purchaseOrderItem.deleteMany({
          where: {
            purchaseOrderId: id,
            id: { in: rejectedItems },
          },
        });
      }

      const remainingItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      for (const poItem of remainingItems) {
        const item = await tx.item.findUnique({ where: { id: poItem.itemId } });
        if (!item) continue;

        const previousStock = item.currentStock;
        const newStock = previousStock + poItem.quantity;

        await tx.item.update({
          where: { id: poItem.itemId },
          data: { currentStock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            itemId: poItem.itemId,
            type: "in",
            quantity: poItem.quantity,
            previousStock,
            newStock,
            reference: order.orderNumber,
            notes: `Purchase order ${order.orderNumber} approved`,
            performedById: user.id,
          },
        });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          signatureImage: signatureImage || null,
        },
        include: {
          createdBy: true,
          supplier: true,
          items: { include: { item: true } },
          approvedBy: true,
        },
      });
    }, { timeout: 15000 });

    return res.status(200).json(updated);
  } catch (error) {
    return jsonError(res, 500, "Internal server error");
  }
};
