const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const outgoingGoods = await prisma.outgoingGoods.findUnique({
        where: { id },
        include: {
          approvedBy: true,
          issuedBy: true,
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  currentStock: true,
                  unit: true,
                },
              },
            },
          },
        },
      });
      if (!outgoingGoods) return jsonError(res, 404, "Outgoing good not found");

      return res.status(200).json(outgoingGoods);
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

      const existing = await prisma.outgoingGoods.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Outgoing good not found");
      if (existing.status !== "DRAFT") {
        return jsonError(res, 400, "Only DRAFT outgoing goods can be edited");
      }

      const body = await parseBody(req);
      const { destination, recipientName, notes, items } = body;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.outgoingGoodsItem.deleteMany({
          where: { outgoingGoodsId: id },
        });

        return tx.outgoingGoods.update({
          where: { id },
          data: {
            ...(destination !== undefined && { destination }),
            ...(recipientName !== undefined && { recipientName }),
            ...(notes !== undefined && { notes }),
            ...(items && {
              items: {
                create: items.map((item) => ({
                  itemId: item.itemId,
                  quantity: item.quantity,
                })),
              },
            }),
          },
          include: {
            approvedBy: true,
            issuedBy: true,
            items: {
              include: {
                item: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                    currentStock: true,
                    unit: true,
                  },
                },
              },
            },
          },
        });
      });

      return res.status(200).json(updated);
    } catch (error) {
      if (error.code === "P2025") {
        return jsonError(res, 404, "Outgoing good not found");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "DELETE") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");
      if (!authorize(user, "admin")) {
        return jsonError(res, 403, "Forbidden");
      }

      await prisma.outgoingGoodsItem.deleteMany({
        where: { outgoingGoodsId: id },
      });
      await prisma.outgoingGoods.delete({ where: { id } });

      return res.status(200).json({ message: "Outgoing good deleted successfully" });
    } catch (error) {
      if (error.code === "P2025") {
        return jsonError(res, 404, "Outgoing good not found");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
