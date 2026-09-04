const { prisma } = require("../../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../../_lib/auth");

function generateOrderNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PO-${dateStr}-${random}`;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const orders = await prisma.purchaseOrder.findMany({
        include: {
          createdBy: true,
          items: { include: { item: true } },
          supplier: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(orders);
    } catch (error) {
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "POST") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin", "divisi")) {
        return jsonError(res, 403, "Forbidden");
      }

      const { supplierId, items, notes, expectedDate } = req.body;

      if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
        return jsonError(res, 400, "supplierId and items array are required");
      }

      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) return jsonError(res, 400, "Supplier not found");

      for (const item of items) {
        const exists = await prisma.item.findUnique({ where: { id: item.itemId } });
        if (!exists) return jsonError(res, 400, `Item ${item.itemId} not found`);
      }

      const totalAmount = items.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0);
      const orderNumber = generateOrderNumber();

      const order = await prisma.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId,
          totalAmount,
          notes: notes || null,
          expectedDate: expectedDate ? new Date(expectedDate) : new Date(),
          status: "DRAFT",
          createdById: user.id,
          items: {
            create: items.map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          createdBy: true,
          items: { include: { item: true } },
          supplier: true,
        },
      });

      return res.status(201).json(order);
    } catch (error) {
      if (error.code === "P2002") {
        return jsonError(res, 409, "Order number already exists");
      }
      if (error.code === "P2003") {
        return jsonError(res, 400, "Invalid reference");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
