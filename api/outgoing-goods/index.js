const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

function generateTransactionNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `OUT-${date}-${random}`;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const outgoingGoods = await prisma.outgoingGoods.findMany({
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
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(outgoingGoods);
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
      const { destination, recipientName, notes, items, issuedById } = body;

      if (!destination || !recipientName || !items || !items.length) {
        return jsonError(
          res,
          400,
          "destination, recipientName, and items are required"
        );
      }

      const transactionNumber = generateTransactionNumber();

      const outgoingGoods = await prisma.outgoingGoods.create({
        data: {
          transactionNumber,
          destination,
          recipientName,
          notes: notes || null,
          status: "DRAFT",
          issuedById: issuedById || user.id,
          items: {
            create: items.map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              notes: item.notes || null,
            })),
          },
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

      return res.status(201).json(outgoingGoods);
    } catch (error) {
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
