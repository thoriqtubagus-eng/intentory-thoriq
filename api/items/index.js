const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

function generateSKU(categoryName) {
  const alphaOnly = categoryName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = alphaOnly.slice(0, 4);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${suffix}`;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const items = await prisma.item.findMany({
        include: { category: true },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(items);
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

      const body = await parseBody(req);
      const { name, description, categoryId, unit, minStock, stock, location } = body;

      if (!name || !categoryId || !unit) {
        return jsonError(res, 400, "name, categoryId, and unit are required");
      }

      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return jsonError(res, 400, "Category not found");
      }

      let sku;
      let isUnique = false;
      while (!isUnique) {
        sku = generateSKU(category.name);
        const existing = await prisma.item.findUnique({ where: { sku } });
        if (!existing) isUnique = true;
      }

      const item = await prisma.item.create({
        data: {
          sku,
          name,
          description: description || null,
          categoryId,
          unit,
          minStock: minStock ?? 0,
          currentStock: stock ?? 0,
          location: location || null,
        },
        include: { category: true },
      });

      return res.status(201).json(item);
    } catch (error) {
      if (error.code === "P2002") {
        return jsonError(res, 409, "Item with this SKU already exists");
      }
      if (error.code === "P2003") {
        return jsonError(res, 400, "Invalid category reference");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
