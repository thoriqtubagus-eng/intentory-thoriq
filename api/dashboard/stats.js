const { prisma } = require("../_lib/prisma");
const { authenticate, jsonError } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return jsonError(res, 405, "Method not allowed");

  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");

    const [
      totalItems,
      totalCategories,
      totalSuppliers,
      pendingRequests,
      pendingPurchaseOrders,
      recentMovements,
      allItems,
    ] = await Promise.all([
      prisma.item.count(),
      prisma.category.count(),
      prisma.supplier.count(),
      prisma.itemRequest.count({ where: { status: "WAITING_APPROVAL" } }),
      prisma.purchaseOrder.count({ where: { status: "WAITING_APPROVAL" } }),
      prisma.stockMovement.findMany({
        take: 10,
        include: {
          item: true,
          performedBy: { select: { id: true, name: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.item.findMany({ include: { category: true } }),
    ]);

    const lowStockItemsList = allItems
      .filter((item) => item.currentStock <= item.minStock)
      .slice(0, 10);
    const lowStockItems = lowStockItemsList.length;

    return res.status(200).json({
      totalItems,
      totalCategories,
      totalSuppliers,
      lowStockItems,
      pendingRequests,
      pendingPurchaseOrders,
      recentMovements,
      lowStockItemsList,
    });
  } catch (error) {
    return jsonError(res, 500, "Internal server error");
  }
};
