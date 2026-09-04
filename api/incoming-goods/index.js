const { prisma } = require("../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../_lib/auth");

function generateTransactionNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `IN-${dateStr}-${random}`;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const goods = await prisma.incomingGoods.findMany({
        include: {
          supplier: true,
          approvedBy: true,
          receivedBy: true,
          createdBy: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(goods);
    } catch (error) {
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "POST") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin", "warehouse_staff")) {
        return jsonError(res, 403, "Forbidden");
      }

      const { supplierId, items, notes, receivedAt, referenceNumber } = req.body;

      if (!supplierId) return jsonError(res, 400, "supplierId is required");
      if (!items || !Array.isArray(items) || items.length === 0) {
        return jsonError(res, 400, "items array is required and must not be empty");
      }

      const transactionNumber = generateTransactionNumber();

      const incoming = await prisma.incomingGoods.create({
        data: {
          transactionNumber,
          supplierId,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
          status: "DRAFT",
          receivedById: user.id,
          createdById: user.id,
          items: {
            create: items.map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice || null,
            })),
          },
        },
        include: {
          supplier: true,
          approvedBy: true,
          receivedBy: true,
          createdBy: true,
          items: { include: { item: true } },
        },
      });

      return res.status(201).json(incoming);
    } catch (error) {
      if (error.code === "P2002") {
        return jsonError(res, 409, "Transaction number already exists");
      }
      if (error.code === "P2003") {
        return jsonError(res, 400, "Invalid supplier or item reference");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
