import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePurchaseOrders,
  useSuppliers,
  useItems,
  useUsers,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useSubmitPurchaseOrder,
  useDeletePurchaseOrder,
} from "@/hooks/useApi";
import { PurchaseOrder as PurchaseOrderType, TransactionItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Send,
  Eye,
  X,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

const PurchaseOrders: React.FC = () => {
  const { user } = useAuth();
  const { data: orders = [], isLoading } = usePurchaseOrders();
  const { data: suppliers = [] } = useSuppliers();
  const { data: items = [] } = useItems();
  const { data: users = [] } = useUsers();
  const createOrder = useCreatePurchaseOrder();
  const updateOrder = useUpdatePurchaseOrder();
  const submitOrder = useSubmitPurchaseOrder();
  const deleteOrder = useDeletePurchaseOrder();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderType | null>(
    null
  );
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrderType | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitId, setSubmitId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    supplierId: "",
    expectedDate: new Date().toISOString().split("T")[0],
    notes: "",
    items: [] as TransactionItem[],
  });

  const [filters, setFilters] = useState({
    supplierId: "ALL",
    status: "ALL",
    date: "",
    month: "",
  });

  const [newItem, setNewItem] = useState({ itemId: "", quantity: 0 });

  const filteredOrders = orders.filter((o) => {
    const matchSearch = o.orderNumber
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchSupplier =
      filters.supplierId === "ALL" || o.supplierId === filters.supplierId;

    const matchStatus = filters.status === "ALL" || o.status === filters.status;

    const orderDate = format(new Date(o.expectedDate), "yyyy-MM-dd");

    const matchDate = !filters.date || orderDate === filters.date;

    const matchMonth = !filters.month || orderDate.startsWith(filters.month);

    return (
      matchSearch && matchSupplier && matchStatus && matchDate && matchMonth
    );
  });

  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  const getItemName = (itemId: string) => {
    return items.find((i) => i.id === itemId)?.name || "Unknown";
  };

  const getUserName = (userId: string) => {
    return users.find((u) => u.id === userId)?.name || "Unknown";
  };

  const resetForm = () => {
    setFormData({
      supplierId: "",
      expectedDate: new Date().toISOString().split("T")[0],
      notes: "",
      items: [],
    });
    setNewItem({ itemId: "", quantity: 0 });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingOrder(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (order: PurchaseOrderType) => {
    if (order.status !== "DRAFT") {
      toast.error("Only draft orders can be edited");
      return;
    }
    setFormData({
      supplierId: order.supplierId,
      expectedDate: order.expectedDate.split("T")[0],
      notes: order.notes,
      items: order.items,
    });
    setEditingOrder(order);
    setIsDialogOpen(true);
  };

  const openViewDialog = (order: PurchaseOrderType) => {
    setViewingOrder(order);
    setIsViewDialogOpen(true);
  };

  const addItem = () => {
    if (!newItem.itemId || newItem.quantity <= 0) {
      toast.error("Please select an item and enter a valid quantity");
      return;
    }
    if (formData.items.some((i) => i.itemId === newItem.itemId)) {
      toast.error("Item already added");
      return;
    }
    setFormData({ ...formData, items: [...formData.items, { ...newItem }] });
    setNewItem({ itemId: "", quantity: 0 });
  };

  const removeItem = (itemId: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((i) => i.itemId !== itemId),
    });
  };

  const onSubmit = async () => {
    if (!formData.supplierId || formData.items.length === 0) {
      toast.error("Please fill all required fields and add at least one item");
      return;
    }

    const loadingToast = toast.loading(editingOrder ? "Updating order..." : "Creating order...");
    try {
      if (editingOrder) {
        await updateOrder.mutateAsync({
          id: editingOrder.id,
          updates: formData,
        });
        toast.success("Order updated successfully", { id: loadingToast });
      } else {
        await createOrder.mutateAsync({
          ...formData,
          orderNumber: undefined,
          createdBy: "",
        });
        toast.success("Order created successfully", { id: loadingToast });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save order", { id: loadingToast });
    }
  };

  const handleSubmit = async () => {
    if (!submitId) return;
    const loadingToast = toast.loading("Submitting order...");
    try {
      await submitOrder.mutateAsync(submitId);
      toast.success("Order submitted for approval", { id: loadingToast });
      setSubmitId(null);
    } catch (error) {
      toast.error("Failed to submit order", { id: loadingToast });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const loadingToast = toast.loading("Deleting order...");
    try {
      await deleteOrder.mutateAsync(deleteId);
      toast.success("Order deleted successfully", { id: loadingToast });
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete order", { id: loadingToast });
    }
  };

  const generatePDF = (transaction: any) => {
    console.log(transaction);
    try {
      if (!transaction) {
        toast.error("Transaction data is not available");
        return;
      }

      const doc = new jsPDF();
      let pdfSaved = false;

      // Function to add footer and save PDF
      const addFooterAndSave = () => {
        if (pdfSaved) return;
        pdfSaved = true;

        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(150, 150, 150);

          doc.text(
            `Halaman ${i} dari ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: "center" }
          );

          doc.text(
            `Dibuat: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`,
            doc.internal.pageSize.width - 15,
            doc.internal.pageSize.height - 10,
            { align: "right" }
          );

          doc.text(
            `ID: ${transaction?.id || "N/A"}`,
            20,
            doc.internal.pageSize.height - 10
          );
        }

        const fileName = `${transaction?.orderNumber || "UNKNOWN"}_${
          transaction?.status || "UNKNOWN"
        }_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;

        doc.save(fileName);
        toast.success("PDF berhasil dibuat");
      };

      // Function to handle signature error
      const handleSignatureError = () => {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("(Tanda tangan tidak dapat ditampilkan)", 105, yPosition, {
          align: "center",
        });
        yPosition += 10;
        addFooterAndSave();
      };

      // Header Section
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      // doc.text("NAMA PT/PERUSAHAAN DISINI", 105, 20, { align: "center" });
      doc.text("PT SAMUDRA MARINE INDONESIA", 105, 20, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      // doc.text("ALAMAT PT/PERUSAHAAN DISINI", 105, 28, { align: "center" });
      doc.text(
        "Kp. Lumalang, Desa Bojonegara, Kec. Bojonegara, Kab. Serang, Banten, Indonesia, 42454",
        105,
        28,
        { align: "center" }
      );

      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);

      // Main Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("LAPORAN PURCHASE ORDER", 105, 45, { align: "center" });
      doc.setFontSize(14);
      doc.text("(PURCHASE ORDER REPORT)", 105, 52, { align: "center" });

      let yPosition = 62;

      // SECTION 1: Basic Transaction Info
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("I. INFORMASI TRANSAKSI", 20, yPosition);

      yPosition += 8;

      const basicInfo = [
        ["Nomor Purchase Order", transaction?.orderNumber || "N/A"],
        ["Status", transaction?.status || "N/A"],

        [
          "Tanggal Dibuat",
          transaction?.createdAt
            ? format(new Date(transaction.createdAt), "dd/MM/yyyy HH:mm")
            : "N/A",
        ],
        [
          "Tanggal Diperbarui",
          transaction?.updatedAt
            ? format(new Date(transaction.updatedAt), "dd/MM/yyyy HH:mm")
            : "N/A",
        ],
      ];

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(66, 66, 66);

      basicInfo.forEach(([label, value]) => {
        if (value) {
          doc.text(`${label}:`, 25, yPosition);
          doc.setFont("helvetica", "bold");
          doc.text(value.toString(), 85, yPosition);
          doc.setFont("helvetica", "normal");
          yPosition += 7;
        }
      });

      yPosition += 5;

      // SECTION 2: Supplier Information (if available)
      // Note: Your data only has supplierId, not supplier object
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("II. INFORMASI SUPPLIER", 20, yPosition);

      yPosition += 8;

      if (transaction?.supplier) {
        const supplierInfo = [
          ["Nama Supplier", transaction.supplier.name],
          ["Nama Kontak", transaction.supplier.contactName],
          ["Email", transaction.supplier.email],
          ["Telepon", transaction.supplier.phone],
          ["Alamat", transaction.supplier.address],
        ];

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(66, 66, 66);

        supplierInfo.forEach(([label, value]) => {
          if (value) {
            doc.text(`${label}:`, 25, yPosition);
            if (label === "Alamat") {
              const addressLines = doc.splitTextToSize(value.toString(), 140);
              doc.setFont("helvetica", "bold");
              doc.text(addressLines, 70, yPosition);
              yPosition += addressLines.length * 5;
            } else {
              doc.setFont("helvetica", "bold");
              doc.text(value.toString(), 70, yPosition);
              yPosition += 7;
            }
          }
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Supplier ID: ${transaction?.supplierId || "N/A"}`,
          25,
          yPosition
        );
        yPosition += 7;
      }

      yPosition += 5;

      // SECTION 3: Created By Information
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("III. DIBUAT OLEH", 20, yPosition);

      yPosition += 8;

      if (transaction?.createdBy) {
        const createdByInfo = [
          ["Nama Pembuat", transaction.createdBy.name],
          ["ID Pembuat", transaction.createdById],
        ];

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(66, 66, 66);

        createdByInfo.forEach(([label, value]) => {
          if (value) {
            doc.text(`${label}:`, 25, yPosition);
            doc.setFont("helvetica", "bold");
            doc.text(value.toString(), 70, yPosition);
            doc.setFont("helvetica", "normal");
            yPosition += 7;
          }
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Informasi pembuat tidak tersedia", 25, yPosition);
        yPosition += 7;
      }

      yPosition += 10;

      // SECTION 4: Items List
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("IV. DAFTAR BARANG", 20, yPosition);

      yPosition += 8;

      if (transaction?.items && transaction.items.length > 0) {
        const itemsData = transaction.items.map((item: any, index: number) => [
          index + 1,
          item.item?.sku || "N/A", // Use item.sku directly from your data
          item.item?.name || "Unknown", // Use item.name directly from your data
          item.quantity.toString(),
          item.item?.unit || "unit", // Added unit from your data
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["No", "SKU", "Nama Barang", "Jumlah", "Unit"]],
          body: itemsData,

          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 10,
            fontStyle: "bold",
            halign: "center",
          },

          bodyStyles: {
            fontSize: 10,
            halign: "center",
          },

          theme: "striped",

          // 👇 makes table centered & wide
          margin: { left: 10, right: 10 },

          columnStyles: {
            0: { cellWidth: 15, halign: "center" }, // No
            1: { cellWidth: 30, halign: "center" }, // SKU
            2: { cellWidth: "auto", halign: "left" }, // Nama Barang (fills space)
            3: { cellWidth: 25, halign: "center" }, // Jumlah
            4: { cellWidth: 25, halign: "center" }, // Unit
          },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // Total Items
        const totalItems = transaction.items.reduce(
          (sum: number, item: any) => sum + item.quantity,
          0
        );
        const totalUniqueItems = transaction.items.length;

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(33, 33, 33);
        doc.text(`Total Jenis Barang: ${totalUniqueItems}`, 20, yPosition);
        doc.text(`Total Jumlah Barang: ${totalItems}`, 160, yPosition, {
          align: "right",
        });

        yPosition += 10;
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Tidak ada barang dalam transaksi ini", 25, yPosition);
        yPosition += 10;
      }

      // SECTION 5: Notes
      if (transaction?.notes) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(41, 128, 185);
        doc.text("V. CATATAN", 20, yPosition);

        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(66, 66, 66);

        const notesLines = doc.splitTextToSize(transaction.notes, 160);
        doc.text(notesLines, 20, yPosition);

        yPosition += notesLines.length * 5 + 10;
      }

      const ensureSpace = (requiredHeight: number) => {
        const pageHeight = doc.internal.pageSize.height;
        if (yPosition + requiredHeight > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
      };

      // SECTION 6: Approval Information
      if (transaction?.status === "APPROVED") {
        ensureSpace(50);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(46, 125, 50);
        doc.text("VI. INFORMASI PERSETUJUAN", 20, yPosition);

        yPosition += 8;

        // Added Approved By information
        const approvalInfo = [
          ["Status Persetujuan", transaction.status],
          ["ID Approver", transaction.approvedById || "N/A"],
          [
            "Tanggal Disetujui",
            transaction.approvedAt
              ? format(new Date(transaction.approvedAt), "dd/MM/yyyy HH:mm")
              : "N/A",
          ],
          [
            "Alasan Penolakan",
            transaction.rejectReason || "Tidak ada (Transaksi disetujui)",
          ],
        ];

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(66, 66, 66);

        approvalInfo.forEach(([label, value]) => {
          ensureSpace(7);
          doc.text(`${label}:`, 25, yPosition);
          doc.setFont("helvetica", "bold");
          doc.text(value.toString(), 85, yPosition);
          doc.setFont("helvetica", "normal");
          yPosition += 7;
        });

        yPosition += 15;

        // =====================
        // SIGNATURE SECTION
        // =====================
        ensureSpace(60);

        if (transaction?.signatureImage) {
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(33, 33, 33);
          doc.text("TANDA TANGAN PERSETUJUAN", 105, yPosition, {
            align: "center",
          });

          yPosition += 8;

          try {
            const img = new Image();
            img.src = transaction.signatureImage;

            img.onload = () => {
              try {
                ensureSpace(40);

                const imgWidth = 60;
                const imgHeight = 30;
                const xPos = (doc.internal.pageSize.width - imgWidth) / 2;

                doc.addImage(img, "PNG", xPos, yPosition, imgWidth, imgHeight);
                yPosition += imgHeight + 5;

                doc.setLineWidth(0.5);
                doc.line(xPos, yPosition, xPos + imgWidth, yPosition);
                yPosition += 8;

                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 100, 100);

                doc.text(
                  `Disetujui pada: ${
                    transaction.approvedAt
                      ? format(
                          new Date(transaction.approvedAt),
                          "dd/MM/yyyy HH:mm:ss"
                        )
                      : "N/A"
                  }`,
                  105,
                  yPosition,
                  { align: "center" }
                );

                addFooterAndSave();
              } catch (error) {
                console.error("Error adding image:", error);
                handleSignatureError();
              }
            };

            img.onerror = handleSignatureError;
            return;
          } catch (error) {
            console.error("Error in signature section:", error);
            handleSignatureError();
          }
        } else {
          // No signature image
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.text("(Tanda tangan tidak tersedia)", 105, yPosition, {
            align: "center",
          });
          yPosition += 10;
        }
      } else if (transaction?.status === "REJECTED") {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(244, 67, 54);
        doc.text("VI. INFORMASI PENOLAKAN", 20, yPosition);

        yPosition += 8;

        const rejectionInfo = [
          ["Status", transaction.status],
          ["Alasan Penolakan", transaction.rejectReason || "Tidak ditentukan"],
        ];

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(66, 66, 66);

        rejectionInfo.forEach(([label, value]) => {
          doc.text(`${label}:`, 25, yPosition);
          doc.setFont("helvetica", "bold");
          doc.text(value.toString(), 85, yPosition);
          doc.setFont("helvetica", "normal");
          yPosition += 7;
        });
        yPosition += 10;
      }

      // For DRAFT or REJECTED status, or if APPROVED without signature processing
      addFooterAndSave();
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Gagal membuat PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Purchase Orders
          </h1>
          <p className="text-muted-foreground">Manage purchase orders</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PO number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Supplier */}
            <Select
              value={filters.supplierId}
              onValueChange={(v) => setFilters({ ...filters, supplierId: v })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Suppliers</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters({ ...filters, status: v })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {/* Date */}
            <Input
              type="date"
              value={filters.date}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  date: e.target.value,
                  month: "",
                })
              }
              className="w-[160px]"
            />

            {/* Month */}
            <Input
              type="month"
              value={filters.month}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  month: e.target.value,
                  date: "",
                })
              }
              className="w-[160px]"
            />

            {/* Clear */}
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setFilters({
                  supplierId: "ALL",
                  status: "ALL",
                  date: "",
                  month: "",
                });
              }}
            >
              Clear
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No orders found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Expected Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        {o.orderNumber}
                      </TableCell>
                      <TableCell>{getSupplierName(o.supplierId)}</TableCell>
                      <TableCell>
                        {format(new Date(o.expectedDate), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openViewDialog(o)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={() => generatePDF(o)}
                            size="icon"
                            title="Generate PDF"
                          >
                            <FileText className="h-4 w-4 text-orange-400" />
                          </Button>
                          {o.status === "DRAFT" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(o)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSubmitId(o.id)}
                              >
                                <Send className="h-4 w-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(o.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingOrder ? "Edit Order" : "New Purchase Order"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(v) =>
                    setFormData({ ...formData, supplierId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={formData.expectedDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expectedDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes..."
              />
            </div>

            <div className="space-y-3">
              <Label>Items</Label>
              <div className="flex gap-2">
                <Select
                  value={newItem.itemId}
                  onValueChange={(v) => setNewItem({ ...newItem, itemId: v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.code} - {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Qty"
                  className="w-24"
                  value={newItem.quantity || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      quantity: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <Button type="button" onClick={addItem}>
                  Add
                </Button>
              </div>

              {formData.items.length > 0 && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24">Quantity</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell>{getItemName(item.itemId)}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.itemId)}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={editingOrder ? updateOrder.isPending : createOrder.isPending}>
              {(editingOrder ? updateOrder.isPending : createOrder.isPending) ? "Saving..." : `${editingOrder ? "Update" : "Create"} as Draft`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">PO Number</Label>
                  <p className="font-medium">{viewingOrder.orderNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <StatusBadge status={viewingOrder.status} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Supplier</Label>
                  <p className="font-medium">
                    {getSupplierName(viewingOrder.supplierId)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Expected Delivery
                  </Label>
                  <p className="font-medium">
                    {format(new Date(viewingOrder.expectedDate), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>

              {viewingOrder.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{viewingOrder.notes}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Items</Label>
                <div className="border rounded-lg mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingOrder.items.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell>{getItemName(item.itemId)}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => generatePDF(viewingOrder)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>
              {viewingOrder.status === "APPROVED" &&
                viewingOrder.signatureImage && (
                  <div>
                    <Label className="text-muted-foreground">
                      Approval Signature
                    </Label>
                    <div className="border rounded-lg p-2 mt-2 bg-card">
                      <img
                        src={viewingOrder.signatureImage}
                        alt="Signature"
                        className="max-w-full h-auto"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Approved by {viewingOrder.approvedBy.name || "Unknown"} on{" "}
                      {viewingOrder.approvedAt &&
                        format(
                          new Date(viewingOrder.approvedAt),
                          "dd/MM/yyyy HH:mm"
                        )}
                    </p>
                  </div>
                )}

              {viewingOrder.status === "REJECTED" && (
                <div>
                  <Label className="text-muted-foreground">
                    Rejection Reason
                  </Label>
                  <p className="text-destructive">
                    {viewingOrder.rejectReason}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!submitId} onOpenChange={() => setSubmitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this order for approval? You won't
              be able to edit it after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitOrder.isPending}>
              {submitOrder.isPending ? "Submitting..." : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteOrder.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrder.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PurchaseOrders;
