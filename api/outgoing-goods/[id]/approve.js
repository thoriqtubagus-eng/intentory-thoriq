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

    const outgoing = await prisma.outgoingGoods.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!outgoing) return jsonError(res, 404, "Outgoing good not found");
    if (outgoing.status !== "WAITING_APPROVAL") {
      return jsonError(
        res,
        400,
        "Only WAITING_APPROVAL outgoing goods can be approved"
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (rejectedItemIds && rejectedItemIds.length > 0) {
        await tx.outgoingGoodsItem.deleteMany({
          where: { id: { in: rejectedItemIds } },
        });
      }

      const approvedOutgoing = await tx.outgoingGoods.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: user.id,
          signatureImage: signatureImage || null,
        },
        include: { items: true },
      });

      for (const item of approvedOutgoing.items) {
        const itemBefore = await tx.item.findUnique({ where: { id: item.itemId } });
        const previousStock = itemBefore.currentStock;
        const newStock = previousStock - item.quantity;

        await tx.item.update({
          where: { id: item.itemId },
          data: { currentStock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            itemId: item.itemId,
            type: "out",
            quantity: item.quantity,
            previousStock,
            newStock,
            reference: outgoing.transactionNumber,
            performedById: user.id,
            notes: `Outgoing goods approved - ${outgoing.transactionNumber}`,
          },
        });
      }

      return {
        outgoingId: approvedOutgoing.id,
        approvedItemCount: approvedOutgoing.items.length,
        rejectedItemCount: rejectedItemIds ? rejectedItemIds.length : 0,
      };
    }, { timeout: 15000 });

    return res.status(200).json(result);
  } catch (error) {
    if (error.code === "P2025") {
      return jsonError(res, 404, "Outgoing good not found");
    }
    return jsonError(res, 500, "Internal server error");
  }
};
