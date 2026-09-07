import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function parseBody(req) {
  try {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === "string") {
        try { return JSON.parse(req.body); } catch { return {}; }
      }
      if (typeof req.body === "object") return req.body;
    }
  } catch {}
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

async function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return await prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch { return null; }
}

function authorize(user, ...roles) { return roles.includes(user.role); }
function jsonError(res, status, message) { return res.status(status).json({ error: message }); }

function generateSKU(catName) {
  const prefix = catName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${prefix}-${suffix}`;
}

function generateTxNum(prefix) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r = "";
  for (let i = 0; i < 4; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${prefix}-${d}-${r}`;
}

function generateOrderNumber() {
  return generateTxNum("PO");
}

const INCL_INCOMING = { supplier: true, approvedBy: true, receivedBy: true, createdBy: true, items: { include: { item: true } } };
const INCL_OUTGOING = { approvedBy: true, issuedBy: true, items: { include: { item: { select: { id: true, sku: true, name: true, currentStock: true, unit: true } } } } };
const INCL_PO = { createdBy: true, items: { include: { item: true } }, supplier: true, approvedBy: true };
const INCL_CAT = { items: true };

function safeUser(u) { const { password: _, ...rest } = u; return rest; }

const routes = {
  "GET /api/health": async (req, res) => res.status(200).json({ status: "ok", timestamp: new Date().toISOString() }),

  "POST /api/auth/login": async (req, res) => {
    const body = await parseBody(req);
    const { username, password } = body || {};
    if (!username || !password) return res.status(400).json({ error: "Missing username or password" });
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "24h" });
    return res.status(200).json({ user: safeUser(user), token });
  },

  "GET /api/auth/me": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Invalid or expired token");
    return res.status(200).json(safeUser(user));
  },

  "POST /api/auth/logout": async (req, res) => res.status(200).json({ message: "Logged out successfully" }),

  "GET /api/users": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    const users = await prisma.user.findMany({ select: { id: true, username: true, role: true, name: true, createdAt: true, updatedAt: true } });
    return res.status(200).json(users);
  },

  "POST /api/users": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");
    const body = await parseBody(req);
    const { username, password, name, role } = body;
    if (!username || !password || !name) return jsonError(res, 400, "Username, password, and name are required");
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return jsonError(res, 409, "Username already exists");
    const hashed = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({ data: { username, password: hashed, name, role: role || "warehouse_staff" }, select: { id: true, username: true, role: true, name: true, createdAt: true, updatedAt: true } });
    return res.status(201).json(newUser);
  },

  "GET /api/categories": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    return res.status(200).json(await prisma.category.findMany());
  },

  "POST /api/categories": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
    const body = await parseBody(req);
    const { name, description } = body;
    if (!name) return jsonError(res, 400, "Name is required");
    return res.status(201).json(await prisma.category.create({ data: { name, description } }));
  },

  "GET /api/items": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    return res.status(200).json(await prisma.item.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }));
  },

  "POST /api/items": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
    const body = await parseBody(req);
    const { name, description, categoryId, unit, minStock, stock, location } = body;
    if (!name || !categoryId || !unit) return jsonError(res, 400, "name, categoryId, and unit are required");
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return jsonError(res, 400, "Category not found");
    let sku, isUnique = false;
    while (!isUnique) { sku = generateSKU(category.name); if (!(await prisma.item.findUnique({ where: { sku } }))) isUnique = true; }
    const item = await prisma.item.create({ data: { sku, name, description: description || null, categoryId, unit, minStock: minStock ?? 0, currentStock: stock ?? 0, location: location || null }, include: { category: true } });
    return res.status(201).json(item);
  },

  "GET /api/suppliers": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    return res.status(200).json(await prisma.supplier.findMany());
  },

  "POST /api/suppliers": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "purchasing")) return jsonError(res, 403, "Forbidden");
    const body = await parseBody(req);
    const { name, contactName, email, phone, address } = body;
    if (!name) return jsonError(res, 400, "Name is required");
    return res.status(201).json(await prisma.supplier.create({ data: { name, contactName, email, phone, address } }));
  },

  "GET /api/incoming-goods": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    return res.status(200).json(await prisma.incomingGoods.findMany({ include: INCL_INCOMING, orderBy: { createdAt: "desc" } }));
  },

  "POST /api/incoming-goods": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
    const body = await parseBody(req);
    const { supplierId, items, notes, receivedAt, referenceNumber } = body;
    if (!supplierId) return jsonError(res, 400, "supplierId is required");
    if (!items || !Array.isArray(items) || items.length === 0) return jsonError(res, 400, "items array required");
    const incoming = await prisma.incomingGoods.create({ data: { transactionNumber: generateTxNum("IN"), supplierId, referenceNumber: referenceNumber || null, notes: notes || null, receivedAt: receivedAt ? new Date(receivedAt) : new Date(), status: "DRAFT", receivedById: user.id, createdById: user.id, items: { create: items.map(i => ({ itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice || null })) } }, include: INCL_INCOMING });
    return res.status(201).json(incoming);
  },

  "GET /api/outgoing-goods": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    return res.status(200).json(await prisma.outgoingGoods.findMany({ include: INCL_OUTGOING, orderBy: { createdAt: "desc" } }));
  },

  "POST /api/outgoing-goods": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
    const body = await parseBody(req);
    const { destination, recipientName, notes, items } = body;
    if (!destination || !recipientName || !items || !items.length) return jsonError(res, 400, "destination, recipientName, and items are required");
    const outgoing = await prisma.outgoingGoods.create({ data: { transactionNumber: generateTxNum("OUT"), destination, recipientName, notes: notes || null, status: "DRAFT", issuedById: user.id, items: { create: items.map(i => ({ itemId: i.itemId, quantity: i.quantity })) } }, include: INCL_OUTGOING });
    return res.status(201).json(outgoing);
  },

  "GET /api/purchase-orders": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    return res.status(200).json(await prisma.purchaseOrder.findMany({ include: INCL_PO, orderBy: { createdAt: "desc" } }));
  },

  "POST /api/purchase-orders": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    if (!authorize(user, "admin", "divisi")) return jsonError(res, 403, "Forbidden");
    const body = await parseBody(req);
    const { supplierId, items, notes, expectedDate } = body;
    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) return jsonError(res, 400, "supplierId and items array required");
    const totalAmount = items.reduce((s, i) => s + (i.quantity * (i.unitPrice || 0)), 0);
    const order = await prisma.purchaseOrder.create({ data: { orderNumber: generateOrderNumber(), supplierId, totalAmount, notes: notes || null, expectedDate: expectedDate ? new Date(expectedDate) : new Date(), status: "DRAFT", createdById: user.id, items: { create: items.map(i => ({ itemId: i.itemId, quantity: i.quantity })) } }, include: INCL_PO });
    return res.status(201).json(order);
  },

  "GET /api/stock-movements": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    return res.status(200).json(await prisma.stockMovement.findMany({ include: { item: true, performedBy: true }, orderBy: { createdAt: "desc" } }));
  },

  "GET /api/dashboard/stats": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    const [totalItems, totalCategories, totalSuppliers, totalUsers, incomingCount, outgoingCount, poCount] = await Promise.all([
      prisma.item.count(), prisma.category.count(), prisma.supplier.count(), prisma.user.count(),
      prisma.incomingGoods.count(), prisma.outgoingGoods.count(), prisma.purchaseOrder.count(),
    ]);
    const recentMovements = await prisma.stockMovement.findMany({ include: { item: true }, orderBy: { createdAt: "desc" }, take: 10 });
    return res.status(200).json({ totalItems, totalCategories, totalSuppliers, totalUsers, incomingCount, outgoingCount, poCount, recentMovements });
  },

  "GET /api/item-requests": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    const requests = await prisma.itemRequest.findMany({
      include: { createdBy: true, approvedBy: true, items: { include: { item: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(requests);
  },

  "POST /api/item-requests": async (req, res) => {
    const user = await authenticate(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    const body = await parseBody(req);
    const { reason, items, requiredDate, department, notes } = body;
    if (!items || !Array.isArray(items) || items.length === 0) return jsonError(res, 400, "items array required");
    const requestNumber = generateTxNum("IR");
    const request = await prisma.itemRequest.create({
      data: {
        requestNumber,
        reason: reason || null,
        requiredDate: requiredDate ? new Date(requiredDate) : new Date(),
        department: department || null,
        notes: notes || null,
        status: "DRAFT",
        createdById: user.id,
        requestedBy: user.name,
        items: { create: items.map(i => ({ itemId: i.itemId, quantity: i.quantity })) },
      },
      include: { createdBy: true, approvedBy: true, items: { include: { item: true } } },
    });
    return res.status(201).json(request);
  },
};

async function handleDynamicRoute(method, path, req, res) {
  const user = await authenticate(req);
  if (!user) return jsonError(res, 401, "Unauthorized");

  // Users [id]
  const usersMatch = path.match(/^\/api\/users\/([^/]+)$/);
  if (usersMatch) {
    const id = usersMatch[1];
    if (method === "GET") {
      const found = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, name: true, createdAt: true, updatedAt: true } });
      if (!found) return jsonError(res, 404, "User not found");
      return res.status(200).json(found);
    }
    if (method === "PUT") {
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");
      const body = await parseBody(req);
      const { username, password, role, name } = body;
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "User not found");
      const updateData = {};
      if (username) updateData.username = username;
      if (role) updateData.role = role;
      if (name) updateData.name = name;
      if (password) updateData.password = await bcrypt.hash(password, 10);
      return res.status(200).json(await prisma.user.update({ where: { id }, data: updateData, select: { id: true, username: true, role: true, name: true, createdAt: true, updatedAt: true } }));
    }
    if (method === "DELETE") {
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");
      await prisma.user.delete({ where: { id } });
      return res.status(204).end();
    }
  }

  // Categories [id]
  const catMatch = path.match(/^\/api\/categories\/([^/]+)$/);
  if (catMatch) {
    const id = catMatch[1];
    if (method === "GET") {
      const cat = await prisma.category.findUnique({ where: { id }, include: INCL_CAT });
      if (!cat) return jsonError(res, 404, "Category not found");
      return res.status(200).json(cat);
    }
    if (method === "PUT") {
      if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
      const body = await parseBody(req);
      return res.status(200).json(await prisma.category.update({ where: { id }, data: body }));
    }
    if (method === "DELETE") {
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");
      const itemCount = await prisma.item.count({ where: { categoryId: id } });
      if (itemCount > 0) return jsonError(res, 400, `Cannot delete category: ${itemCount} item(s) still use this category. Move or delete them first.`);
      await prisma.category.delete({ where: { id } });
      return res.status(200).json({ message: "Category deleted successfully" });
    }
  }

  // Items [id]
  const itemsMatch = path.match(/^\/api\/items\/([^/]+)$/);
  if (itemsMatch) {
    const id = itemsMatch[1];
    if (method === "GET") {
      const item = await prisma.item.findUnique({ where: { id }, include: { category: true } });
      if (!item) return jsonError(res, 404, "Item not found");
      return res.status(200).json(item);
    }
    if (method === "PUT") {
      if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
      const body = await parseBody(req);
      const updated = await prisma.item.update({ where: { id }, data: { ...(body.code !== undefined && { sku: body.code }), ...(body.name !== undefined && { name: body.name }), ...(body.description !== undefined && { description: body.description }), ...(body.categoryId !== undefined && { categoryId: body.categoryId }), ...(body.unit !== undefined && { unit: body.unit }), ...(body.minStock !== undefined && { minStock: body.minStock }), ...(body.stock !== undefined && { currentStock: body.stock }), ...(body.location !== undefined && { location: body.location }) }, include: { category: true } });
      return res.status(200).json(updated);
    }
    if (method === "DELETE") {
      if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
      await prisma.item.delete({ where: { id } });
      return res.status(200).json({ message: "Item deleted successfully" });
    }
  }

  // Suppliers [id]
  const suppMatch = path.match(/^\/api\/suppliers\/([^/]+)$/);
  if (suppMatch) {
    const id = suppMatch[1];
    if (method === "GET") {
      const s = await prisma.supplier.findUnique({ where: { id } });
      if (!s) return jsonError(res, 404, "Supplier not found");
      return res.status(200).json(s);
    }
    if (method === "PUT") {
      if (!authorize(user, "admin", "purchasing")) return jsonError(res, 403, "Forbidden");
      const body = await parseBody(req);
      return res.status(200).json(await prisma.supplier.update({ where: { id }, data: body }));
    }
    if (method === "DELETE") {
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");
      const inCount = await prisma.incomingGoods.count({ where: { supplierId: id } });
      const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id } });
      if (inCount > 0 || poCount > 0) return jsonError(res, 400, `Cannot delete supplier: ${inCount} incoming good(s) and ${poCount} purchase order(s) reference it.`);
      await prisma.supplier.delete({ where: { id } });
      return res.status(200).json({ message: "Supplier deleted successfully" });
    }
  }

  // Incoming Goods [id] and sub-routes
  const inMatch = path.match(/^\/api\/incoming-goods\/([^/]+)(?:\/(submit|approve|reject))?$/);
  if (inMatch) {
    const id = inMatch[1];
    const action = inMatch[2];

    if (method === "GET" && !action) {
      const inc = await prisma.incomingGoods.findUnique({ where: { id }, include: INCL_INCOMING });
      if (!inc) return jsonError(res, 404, "Incoming goods not found");
      return res.status(200).json(inc);
    }

    if (method === "PUT" && !action) {
      if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
      const existing = await prisma.incomingGoods.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Incoming goods not found");
      if (existing.status !== "DRAFT") return jsonError(res, 400, "Only DRAFT incoming goods can be edited");
      const body = await parseBody(req);
      const updated = await prisma.$transaction(async (tx) => {
        if (body.items && Array.isArray(body.items)) {
          await tx.incomingGoodsItem.deleteMany({ where: { incomingGoodsId: id } });
          await tx.incomingGoodsItem.createMany({ data: body.items.map(i => ({ incomingGoodsId: id, itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice || null })) });
        }
        return tx.incomingGoods.update({ where: { id }, data: { ...(body.supplierId !== undefined && { supplierId: body.supplierId }), ...(body.referenceNumber !== undefined && { referenceNumber: body.referenceNumber }), ...(body.notes !== undefined && { notes: body.notes }), ...(body.receivedAt !== undefined && { receivedAt: new Date(body.receivedAt) }) }, include: INCL_INCOMING });
      }, { timeout: 15000 });
      return res.status(200).json(updated);
    }

    if (method === "DELETE" && !action) {
      if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
      await prisma.incomingGoods.delete({ where: { id } });
      return res.status(200).json({ message: "Incoming goods deleted successfully" });
    }

    if (method === "POST" && action === "submit") {
      const existing = await prisma.incomingGoods.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Incoming goods not found");
      if (existing.status !== "DRAFT") return jsonError(res, 400, "Only DRAFT can be submitted");
      return res.status(200).json(await prisma.incomingGoods.update({ where: { id }, data: { status: "WAITING_APPROVAL" }, include: INCL_INCOMING }));
    }

    if (method === "POST" && action === "approve") {
      if (!authorize(user, "admin", "head_of_warehouse")) return jsonError(res, 403, "Forbidden");
      const incoming = await prisma.incomingGoods.findUnique({ where: { id }, include: { items: true } });
      if (!incoming) return jsonError(res, 404, "Incoming goods not found");
      if (incoming.status !== "WAITING_APPROVAL") return jsonError(res, 400, "Only WAITING_APPROVAL can be approved");
      const body = await parseBody(req);
      const result = await prisma.$transaction(async (tx) => {
        if (body.items && Array.isArray(body.items) && body.items.length > 0) {
          await tx.incomingGoodsItem.deleteMany({ where: { incomingGoodsId: id, id: { in: body.items } } });
        }
        const approvedItems = await tx.incomingGoodsItem.findMany({ where: { incomingGoodsId: id } });
        for (const ii of approvedItems) {
          const item = await tx.item.findUnique({ where: { id: ii.itemId } });
          const prev = item.currentStock;
          await tx.item.update({ where: { id: ii.itemId }, data: { currentStock: prev + ii.quantity } });
          await tx.stockMovement.create({ data: { itemId: ii.itemId, type: "in", quantity: ii.quantity, previousStock: prev, newStock: prev + ii.quantity, reference: incoming.transactionNumber, notes: `Incoming approved: ${incoming.transactionNumber}`, performedById: user.id } });
        }
        return tx.incomingGoods.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id, signatureImage: body.signatureImage || null }, include: INCL_INCOMING });
      }, { timeout: 15000 });
      return res.status(200).json(result);
    }

    if (method === "POST" && action === "reject") {
      if (!authorize(user, "admin", "head_of_warehouse")) return jsonError(res, 403, "Forbidden");
      const body = await parseBody(req);
      const updated = await prisma.incomingGoods.update({ where: { id }, data: { status: "REJECTED", rejectReason: body.reason || null }, include: INCL_INCOMING });
      return res.status(200).json(updated);
    }
  }

  // Outgoing Goods [id] and sub-routes
  const outMatch = path.match(/^\/api\/outgoing-goods\/([^/]+)(?:\/(submit|approve|reject))?$/);
  if (outMatch) {
    const id = outMatch[1];
    const action = outMatch[2];

    if (method === "GET" && !action) {
      const og = await prisma.outgoingGoods.findUnique({ where: { id }, include: INCL_OUTGOING });
      if (!og) return jsonError(res, 404, "Outgoing good not found");
      return res.status(200).json(og);
    }

    if (method === "PUT" && !action) {
      if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
      const existing = await prisma.outgoingGoods.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Outgoing good not found");
      if (existing.status !== "DRAFT") return jsonError(res, 400, "Only DRAFT outgoing goods can be edited");
      const body = await parseBody(req);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.outgoingGoodsItem.deleteMany({ where: { outgoingGoodsId: id } });
        return tx.outgoingGoods.update({ where: { id }, data: { ...(body.destination !== undefined && { destination: body.destination }), ...(body.recipientName !== undefined && { recipientName: body.recipientName }), ...(body.notes !== undefined && { notes: body.notes }), ...(body.items && { items: { create: body.items.map(i => ({ itemId: i.itemId, quantity: i.quantity })) } }) }, include: INCL_OUTGOING });
      }, { timeout: 15000 });
      return res.status(200).json(updated);
    }

    if (method === "DELETE" && !action) {
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");
      await prisma.outgoingGoodsItem.deleteMany({ where: { outgoingGoodsId: id } });
      await prisma.outgoingGoods.delete({ where: { id } });
      return res.status(200).json({ message: "Outgoing good deleted successfully" });
    }

    if (method === "POST" && action === "submit") {
      if (!authorize(user, "admin", "warehouse_staff")) return jsonError(res, 403, "Forbidden");
      const existing = await prisma.outgoingGoods.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Outgoing good not found");
      if (existing.status !== "DRAFT") return jsonError(res, 400, "Only DRAFT can be submitted");
      return res.status(200).json(await prisma.outgoingGoods.update({ where: { id }, data: { status: "WAITING_APPROVAL" } }));
    }

    if (method === "POST" && action === "approve") {
      if (!authorize(user, "admin", "head_of_warehouse")) return jsonError(res, 403, "Forbidden");
      const outgoing = await prisma.outgoingGoods.findUnique({ where: { id }, include: { items: true } });
      if (!outgoing) return jsonError(res, 404, "Outgoing good not found");
      if (outgoing.status !== "WAITING_APPROVAL") return jsonError(res, 400, "Only WAITING_APPROVAL can be approved");
      const body = await parseBody(req);
      const result = await prisma.$transaction(async (tx) => {
        if (body.items && body.items.length > 0) {
          await tx.outgoingGoodsItem.deleteMany({ where: { id: { in: body.items } } });
        }
        const updated = await tx.outgoingGoods.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id, signatureImage: body.signatureImage || null }, include: { items: true } });
        for (const item of updated.items) {
          const prev = (await tx.item.findUnique({ where: { id: item.itemId } })).currentStock;
          await tx.item.update({ where: { id: item.itemId }, data: { currentStock: prev - item.quantity } });
          await tx.stockMovement.create({ data: { itemId: item.itemId, type: "out", quantity: item.quantity, previousStock: prev, newStock: prev - item.quantity, reference: outgoing.transactionNumber, performedById: user.id, notes: `Outgoing approved - ${outgoing.transactionNumber}` } });
        }
        return { outgoingId: updated.id, approvedItemCount: updated.items.length };
      }, { timeout: 15000 });
      return res.status(200).json(result);
    }

    if (method === "POST" && action === "reject") {
      if (!authorize(user, "admin", "head_of_warehouse")) return jsonError(res, 403, "Forbidden");
      const body = await parseBody(req);
      const updated = await prisma.outgoingGoods.update({ where: { id }, data: { status: "REJECTED", rejectReason: body.reason || null } });
      return res.status(200).json(updated);
    }
  }

  // Purchase Orders [id] and sub-routes
  const poMatch = path.match(/^\/api\/purchase-orders\/([^/]+)(?:\/(submit|approve|reject))?$/);
  if (poMatch) {
    const id = poMatch[1];
    const action = poMatch[2];

    if (method === "GET" && !action) {
      const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: INCL_PO });
      if (!order) return jsonError(res, 404, "Purchase order not found");
      return res.status(200).json(order);
    }

    if (method === "PUT" && !action) {
      if (!authorize(user, "admin", "divisi")) return jsonError(res, 403, "Forbidden");
      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Purchase order not found");
      if (existing.status !== "DRAFT") return jsonError(res, 400, "Only DRAFT orders can be edited");
      const body = await parseBody(req);
      const updated = await prisma.$transaction(async (tx) => {
        if (body.items && Array.isArray(body.items)) {
          await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
          await tx.purchaseOrderItem.createMany({ data: body.items.map(i => ({ purchaseOrderId: id, itemId: i.itemId, quantity: i.quantity })) });
        }
        const totalAmount = body.items ? body.items.reduce((s, i) => s + (i.quantity * (i.unitPrice || 0)), 0) : existing.totalAmount;
        return tx.purchaseOrder.update({ where: { id }, data: { ...(body.supplierId && { supplierId: body.supplierId }), ...(body.notes !== undefined && { notes: body.notes }), ...(body.expectedDate && { expectedDate: new Date(body.expectedDate) }), totalAmount }, include: INCL_PO });
      }, { timeout: 15000 });
      return res.status(200).json(updated);
    }

    if (method === "DELETE" && !action) {
      if (!authorize(user, "admin")) return jsonError(res, 403, "Forbidden");
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await prisma.purchaseOrder.delete({ where: { id } });
      return res.status(200).json({ message: "Purchase order deleted successfully" });
    }

    if (method === "POST" && action === "submit") {
      if (!authorize(user, "admin", "divisi")) return jsonError(res, 403, "Forbidden");
      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Purchase order not found");
      if (existing.status !== "DRAFT") return jsonError(res, 400, "Only DRAFT can be submitted");
      return res.status(200).json(await prisma.purchaseOrder.update({ where: { id }, data: { status: "WAITING_APPROVAL" } }));
    }

    if (method === "POST" && action === "approve") {
      if (!authorize(user, "admin", "head_of_warehouse")) return jsonError(res, 403, "Forbidden");
      const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Purchase order not found");
      if (existing.status !== "WAITING_APPROVAL") return jsonError(res, 400, "Only WAITING_APPROVAL can be approved");
      const body = await parseBody(req);
      return res.status(200).json(await prisma.purchaseOrder.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id, signatureImage: body.signatureImage || null }, include: INCL_PO }));
    }

    if (method === "POST" && action === "reject") {
      if (!authorize(user, "admin", "head_of_warehouse")) return jsonError(res, 403, "Forbidden");
      const body = await parseBody(req);
      return res.status(200).json(await prisma.purchaseOrder.update({ where: { id }, data: { status: "REJECTED", rejectReason: body.reason || null } }));
    }
  }

  // Item Requests [id] and sub-routes
  const irMatch = path.match(/^\/api\/item-requests\/([^/]+)(?:\/(submit|approve|reject))?$/);
  if (irMatch) {
    const id = irMatch[1];
    const action = irMatch[2];

    if (method === "GET" && !action) {
      const req = await prisma.itemRequest.findUnique({ where: { id }, include: { createdBy: true, approvedBy: true, items: { include: { item: true } } } });
      if (!req) return jsonError(res, 404, "Item request not found");
      return res.status(200).json(req);
    }

    if (method === "PUT" && !action) {
      const existing = await prisma.itemRequest.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Item request not found");
      if (existing.status !== "DRAFT") return jsonError(res, 400, "Only DRAFT can be edited");
      const body = await parseBody(req);
      const updated = await prisma.$transaction(async (tx) => {
        if (body.items && Array.isArray(body.items)) {
          await tx.itemRequestItem.deleteMany({ where: { itemRequestId: id } });
          await tx.itemRequestItem.createMany({ data: body.items.map(i => ({ itemRequestId: id, itemId: i.itemId, quantity: i.quantity })) });
        }
        return tx.itemRequest.update({ where: { id }, data: { ...(body.reason !== undefined && { reason: body.reason }), ...(body.department !== undefined && { department: body.department }), ...(body.notes !== undefined && { notes: body.notes }), ...(body.requiredDate !== undefined && { requiredDate: new Date(body.requiredDate) }) }, include: { createdBy: true, approvedBy: true, items: { include: { item: true } } } });
      }, { timeout: 15000 });
      return res.status(200).json(updated);
    }

    if (method === "DELETE" && !action) {
      await prisma.itemRequestItem.deleteMany({ where: { itemRequestId: id } });
      await prisma.itemRequest.delete({ where: { id } });
      return res.status(200).json({ message: "Item request deleted successfully" });
    }

    if (method === "POST" && action === "submit") {
      const existing = await prisma.itemRequest.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Item request not found");
      if (existing.status !== "DRAFT") return jsonError(res, 400, "Only DRAFT can be submitted");
      return res.status(200).json(await prisma.itemRequest.update({ where: { id }, data: { status: "WAITING_APPROVAL" }, include: { createdBy: true, approvedBy: true, items: { include: { item: true } } } }));
    }

    if (method === "POST" && action === "approve") {
      if (!authorize(user, "admin", "head_of_warehouse")) return jsonError(res, 403, "Forbidden");
      const existing = await prisma.itemRequest.findUnique({ where: { id } });
      if (!existing) return jsonError(res, 404, "Item request not found");
      if (existing.status !== "WAITING_APPROVAL") return jsonError(res, 400, "Only WAITING_APPROVAL can be approved");
      const body = await parseBody(req);
      return res.status(200).json(await prisma.itemRequest.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id, signatureImage: body.signatureImage || null }, include: { createdBy: true, approvedBy: true, items: { include: { item: true } } } }));
    }

    if (method === "POST" && action === "reject") {
      if (!authorize(user, "admin", "head_of_warehouse")) return jsonError(res, 403, "Forbidden");
      const body = await parseBody(req);
      return res.status(200).json(await prisma.itemRequest.update({ where: { id }, data: { status: "REJECTED", rejectReason: body.reason || null } }));
    }
  }

  // Stock Movements by item
  const smMatch = path.match(/^\/api\/stock-movements\/item\/([^/]+)$/);
  if (smMatch) {
    const itemId = smMatch[1];
    const movements = await prisma.stockMovement.findMany({ where: { itemId }, include: { item: true, performedBy: true }, orderBy: { createdAt: "desc" } });
    return res.status(200).json(movements);
  }

  return jsonError(res, 404, "Not found");
}

export default async function handler(req, res) {
  try {
    const method = req.method;
    const url = new URL(req.url, `https://${req.headers.host}`);
    const path = url.pathname;

    if (method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      return res.status(200).end();
    }

    res.setHeader("Access-Control-Allow-Origin", "*");

    const routeKey = `${method} ${path}`;
    if (routes[routeKey]) {
      return await routes[routeKey](req, res);
    }

    if (path.startsWith("/api/")) {
      return await handleDynamicRoute(method, path, req, res);
    }

    return jsonError(res, 404, "Not found");
  } catch (error) {
    console.error("API Error:", error);
    return jsonError(res, 500, error.message || "Internal server error");
  }
}
