const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const item = await prisma.item.findUnique({
        where: { id },
        include: { category: true },
      });
      if (!item) return jsonError(res, 404, "Item not found");

      return res.status(200).json(item);
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

      const existing = await prisma.item.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Item not found");

      const body = await parseBody(req);
      const { code, name, description, categoryId, unit, minStock, stock, location } = body;

      if (categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
        });
        if (!category) {
          return jsonError(res, 400, "Category not found");
        }
      }

      if (code && code !== existing.sku) {
        const skuExists = await prisma.item.findUnique({ where: { sku: code } });
        if (skuExists) {
          return jsonError(res, 409, "Item with this SKU already exists");
        }
      }

      const updated = await prisma.item.update({
        where: { id },
        data: {
          ...(code !== undefined && { sku: code }),
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(categoryId !== undefined && { categoryId }),
          ...(unit !== undefined && { unit }),
          ...(minStock !== undefined && { minStock }),
          ...(stock !== undefined && { currentStock: stock }),
          ...(location !== undefined && { location }),
        },
        include: { category: true },
      });

      return res.status(200).json(updated);
    } catch (error) {
      if (error.code === "P2002") {
        return jsonError(res, 409, "Item with this SKU already exists");
      }
      if (error.code === "P2025") {
        return jsonError(res, 404, "Item not found");
      }
      if (error.code === "P2003") {
        return jsonError(res, 400, "Invalid category reference");
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

      await prisma.item.delete({ where: { id } });

      return res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
      if (error.code === "P2003") {
        return jsonError(res, 400, "Cannot delete item with existing references");
      }
      if (error.code === "P2025") {
        return jsonError(res, 404, "Item not found");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
