const { prisma } = require("../_lib/prisma");
const { authenticate, authorize, jsonError } = require("../_lib/auth");
const { parseBody } = require("../_lib/utils");

module.exports = async function (req, res) {
  try {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");

    const { id } = req.query;

    if (req.method === "GET") {
      const supplier = await prisma.supplier.findUnique({ where: { id } });
      if (!supplier) return jsonError(res, 404, "Supplier not found");
      return res.status(200).json(supplier);
    }

    if (req.method === "PUT") {
      if (!authorize(user, "admin", "purchasing"))
        return jsonError(res, 403, "Forbidden");

      const body = await parseBody(req);
      const { name, contactName, email, phone, address } = body;
      const supplier = await prisma.supplier.update({
        where: { id },
        data: { name, contactName, email, phone, address },
      });
      return res.status(200).json(supplier);
    }

    if (req.method === "DELETE") {
      if (!authorize(user, "admin"))
        return jsonError(res, 403, "Forbidden");

      await prisma.supplier.delete({ where: { id } });
      return res.status(204).end();
    }

    return jsonError(res, 405, "Method not allowed");
  } catch (error) {
    return jsonError(res, 500, error.message);
  }
};
