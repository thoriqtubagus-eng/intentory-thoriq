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
    const { status, signatureImage, items: rejectedItemIds } = body;

    const request = await prisma.itemRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!request) return jsonError(res, 404, "Item request not found");
    if (request.status !== "WAITING_APPROVAL") {
      return jsonError(res, 400, "Only WAITING_APPROVAL requests can be approved");
    }

    const finalStatus = status === "REJECTED" ? "REJECTED" : "APPROVED";

    const updated = await prisma.$transaction(async (tx) => {
      if (rejectedItemIds && Array.isArray(rejectedItemIds) && rejectedItemIds.length > 0) {
        await tx.itemRequestItem.deleteMany({
          where: {
            itemRequestId: id,
            itemId: { in: rejectedItemIds },
          },
        });
      }

      const remainingItems = await tx.itemRequestItem.findMany({
        where: { itemRequestId: id },
        include: { item: true },
      });

      if (finalStatus === "APPROVED") {
        for (const requestItem of remainingItems) {
          const item = await tx.item.findUnique({
            where: { id: requestItem.itemId },
          });

          if (!item) {
            throw new Error(`Item ${requestItem.itemId} not found`);
          }

          if (item.currentStock < requestItem.quantity) {
            throw new Error(
              `Insufficient stock for item ${item.name}: requested ${requestItem.quantity}, available ${item.currentStock}`
            );
          }

          const previousStock = item.currentStock;
          const newStock = previousStock - requestItem.quantity;

          await tx.item.update({
            where: { id: requestItem.itemId },
            data: { currentStock: newStock },
          });

          await tx.stockMovement.create({
            data: {
              itemId: requestItem.itemId,
              type: "out",
              quantity: requestItem.quantity,
              previousStock,
              newStock,
              reference: request.requestNumber,
              notes: `Item request approved: ${request.requestNumber}`,
              performedById: user.id,
            },
          });
        }
      }

      return tx.itemRequest.update({
        where: { id },
        data: {
          status: finalStatus,
          approvedAt: new Date(),
          approvedById: user.id,
          signatureImage: signatureImage || null,
          rejectReason: finalStatus === "REJECTED" ? "Partially or fully rejected" : null,
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
    if (error.message && error.message.includes("Insufficient stock")) {
      return jsonError(res, 400, error.message);
    }
    if (error.message && error.message.includes("not found")) {
      return jsonError(res, 400, error.message);
    }
    return jsonError(res, 500, "Internal server error");
  }
};
