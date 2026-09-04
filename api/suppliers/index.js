const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function (req, res) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");

    if (req.method === "GET") {
      const suppliers = await prisma.supplier.findMany();
      return res.status(200).json(suppliers);
    }

    if (req.method === "POST") {
      if (!authorize(user, "admin", "purchasing"))
        return jsonError(res, 403, "Forbidden");

      const body = await parseBody(req);
      const { name, contactName, email, phone, address } = body;
      if (!name) return jsonError(res, 400, "Name is required");

      const supplier = await prisma.supplier.create({
        data: { name, contactName, email, phone, address },
      });
      return res.status(201).json(supplier);
    }

    return jsonError(res, 405, "Method not allowed");
  } catch (error) {
    return jsonError(res, 500, error.message);
  }
};
