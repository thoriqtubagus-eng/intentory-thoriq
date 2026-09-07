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
    if (!authorize(user, "admin", "head_of_warehouse")) {
      return jsonError(res, 403, "Forbidden");
    }

    const { id } = req.query;
    const body = await parseBody(req);
    const { items: rejectedItemIds, signatureImage } = body;

    const incoming = await prisma.incomingGoods.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!incoming) return jsonError(res, 404, "Incoming goods not found");
    if (incoming.status !== "WAITING_APPROVAL") {
      return jsonError(res, 400, "Only WAITING_APPROVAL incoming goods can be approved");
    }

    const result = await prisma.$transaction(async (tx) => {
      if (rejectedItemIds && Array.isArray(rejectedItemIds) && rejectedItemIds.length > 0) {
        await tx.incomingGoodsItem.deleteMany({
          where: {
            incomingGoodsId: id,
            id: { in: rejectedItemIds },
          },
        });
      }

      const approvedItems = await tx.incomingGoodsItem.findMany({
        where: { incomingGoodsId: id },
      });

      for (const incomingItem of approvedItems) {
        const item = await tx.item.findUnique({ where: { id: incomingItem.itemId } });
        if (!item) throw new Error(`Item ${incomingItem.itemId} not found`);

        const previousStock = item.currentStock;
        const newStock = previousStock + incomingItem.quantity;

        await tx.item.update({
          where: { id: incomingItem.itemId },
          data: { currentStock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            itemId: incomingItem.itemId,
            type: "in",
            quantity: incomingItem.quantity,
            previousStock,
            newStock,
            reference: incoming.transactionNumber,
            notes: `Incoming goods approved: ${incoming.transactionNumber}`,
            performedById: user.id,
          },
        });
      }

      const updatedIncoming = await tx.incomingGoods.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: user.id,
          signatureImage: signatureImage || null,
        },
        include: {
          supplier: true,
          approvedBy: true,
          receivedBy: true,
          createdBy: true,
          items: { include: { item: true } },
        },
      });

      return {
        incoming: updatedIncoming,
        approvedItemCount: approvedItems.length,
        rejectedItemCount: rejectedItemIds ? rejectedItemIds.length : 0,
      };
    }, { timeout: 15000 });

    return res.status(200).json({
      incomingId: result.incoming.id,
      approvedItemCount: result.approvedItemCount,
      rejectedItemCount: result.rejectedItemCount,
      incoming: result.incoming,
    });
  } catch (error) {
    if (error.message && error.message.includes("not found")) {
      return jsonError(res, 400, error.message);
    }
    return jsonError(res, 500, "Internal server error");
  }
};
