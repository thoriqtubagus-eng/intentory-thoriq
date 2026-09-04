const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

function generateRequestNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REQ-${dateStr}-${random}`;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const requests = await prisma.itemRequest.findMany({
        include: {
          createdBy: true,
          approvedBy: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(requests);
    } catch (error) {
      return jsonError(res, 500, "Internal server error");
    }
  }

  if (req.method === "POST") {
    try {
      const user = await authenticate(req);
      if (!user) return jsonError(res, 401, "Unauthorized");

      const body = await parseBody(req);
      const { items, requestedBy, department, requiredDate, notes } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return jsonError(res, 400, "items array is required and must not be empty");
      }

      const requestNumber = generateRequestNumber();

      const request = await prisma.itemRequest.create({
        data: {
          requestNumber,
          requestedBy: requestedBy || null,
          department: department || null,
          requiredDate: requiredDate ? new Date(requiredDate) : new Date(),
          notes: notes || null,
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
          approvedBy: true,
          items: { include: { item: true } },
        },
      });

      return res.status(201).json(request);
    } catch (error) {
      if (error.code === "P2002") {
        return jsonError(res, 409, "Request number already exists");
      }
      if (error.code === "P2003") {
        return jsonError(res, 400, "Invalid item reference");
      }
      return jsonError(res, 500, "Internal server error");
    }
  }

  return jsonError(res, 405, "Method not allowed");
};
