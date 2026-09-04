import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useIncomingGoods,
  useSuppliers,
  useItems,
  useUsers,
  useCreateIncomingGoods,
  useUpdateIncomingGoods,
  useSubmitIncomingGoods,
  useDeleteIncomingGoods,
} from "@/hooks/useApi";
import { IncomingGoods as IncomingGoodsType, TransactionItem } from "@/types";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
const IncomingGoods: React.FC = () => {
  const { user } = useAuth();
  const { data: transactions = [], isLoading } = useIncomingGoods();
  const { data: suppliers = [] } = useSuppliers();
  const { data: items = [] } = useItems();
  const { data: users = [] } = useUsers();
  const createTransaction = useCreateIncomingGoods();
  const updateTransaction = useUpdateIncomingGoods();
  const submitTransaction = useSubmitIncomingGoods();
  const deleteTransaction = useDeleteIncomingGoods();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<IncomingGoodsType | null>(null);
  const [viewingTransaction, setViewingTransaction] =
    useState<IncomingGoodsType | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitId, setSubmitId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    supplierId: "",
    referenceNumber: "",
    receivedAt: new Date().toISOString().split("T")[0],
    notes: "",
    items: [] as TransactionItem[],
  });

  const [filters, setFilters] = useState({
    supplierId: "ALL",
    status: "ALL",
    date: "", // YYYY-MM-DD
    month: "", // YYYY-MM
  });

  

  const [newItem, setNewItem] = useState({ itemId: "", quantity: 0 });

  // Utility function to safely format dates
  const safeFormatDate = (
    value?: string | Date | null,
    formatStr: string = "dd/MM/yyyy"
  ) => {
    if (!value) return "-";
    const date = new Date(value);
    return isNaN(date.getTime()) ? "-" : format(date, formatStr);
  };

  // Extract date only from ISO string (for form input)
  const extractDateFromISO = (isoString: string) => {
    try {
      return isoString.split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };
  const filteredTransactions = transactions.filter((t) => {
    // Text search
    const matchSearch = t.transactionNumber
      .toLowerCase()
      .includes(search.toLowerCase());

    // Supplier filter
    const matchSupplier =
      filters.supplierId === "ALL" || t.supplierId === filters.supplierId;

    // Status filter
    const matchStatus = filters.status === "ALL" || t.status === filters.status;

    // Date filter (exact date)
    const matchDate =
      !filters.date || extractDateFromISO(t.receivedAt) === filters.date;

    // Month filter (YYYY-MM)
    const matchMonth =
      !filters.month ||
      extractDateFromISO(t.receivedAt).startsWith(filters.month);

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
      referenceNumber: "",
      receivedAt: new Date().toISOString().split("T")[0],
      notes: "",
      items: [],
    });
    setNewItem({ itemId: "", quantity: 0 });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingTransaction(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (transaction: IncomingGoodsType) => {
    if (transaction.status !== "DRAFT") {
      toast.error("Only draft transactions can be edited");
      return;
    }
    setFormData({
      supplierId: transaction.supplierId,
      referenceNumber: transaction.referenceNumber,
      receivedAt: extractDateFromISO(transaction.receivedAt),
      notes: transaction.notes,
      items: transaction.items,
    });
    setEditingTransaction(transaction);
    setIsDialogOpen(true);
  };

  const openViewDialog = (transaction: IncomingGoodsType) => {
    setViewingTransaction(transaction);
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
    setFormData({
      ...formData,
      items: [...formData.items, { ...newItem }],
    });
    setNewItem({ itemId: "", quantity: 0 });
  };

  const removeItem = (itemId: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((i) => i.itemId !== itemId),
    });
  };

  const onSubmit = async () => {
    if (
      !formData.supplierId ||
      // !formData.referenceNumber ||
      formData.items.length === 0
    ) {
      toast.error("Please fill all required fields and add at least one item");
      return;
    }

    try {
      if (editingTransaction) {
        await updateTransaction.mutateAsync({
          id: editingTransaction.id,
          updates: formData,
        });
        toast.success("Transaction updated successfully");
      } else {
        await createTransaction.mutateAsync({
          ...formData,
          createdBy: user?.id || "",
        });
        toast.success("Transaction created successfully");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save transaction");
    }
  };

  const handleSubmit = async () => {
    if (!submitId) return;
    try {
      await submitTransaction.mutateAsync(submitId);
      toast.success("Transaction submitted for approval");
      setSubmitId(null);
    } catch (error) {
      toast.error("Failed to submit transaction");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTransaction.mutateAsync(deleteId);
      toast.success("Transaction deleted successfully");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete transaction");
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

      // Function to add footer and save PDF - DECLARED AT THE TOP
      const addFooterAndSave = () => {
        if (pdfSaved) return; // ✅ PREVENT DOUBLE SAVE
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

        const fileName = `${transaction?.transactionNumber || "UNKNOWN"}_${
          transaction?.status || "UNKNOWN"
        }_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;

        doc.save(fileName);
        toast.success("PDF berhasil dibuat");
      };

      // Function to handle signature error - DECLARED AT THE TOP
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
      doc.text("Kp. Lumalang, Desa Bojonegara, Kec. Bojonegara, Kab. Serang, Banten, Indonesia, 42454", 105, 28, { align: "center" });

      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);

      // Main Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("LAPORAN BARANG MASUK", 105, 45, { align: "center" });
      doc.setFontSize(14);
      doc.text("(INCOMING GOODS REPORT)", 105, 52, { align: "center" });

      let yPosition = 62;

      // SECTION 1: Basic Transaction Info
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("I. INFORMASI TRANSAKSI", 20, yPosition);

      yPosition += 8;

      const basicInfo = [
        ["Nomor Transaksi", transaction?.transactionNumber || "N/A"],
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
          doc.text(value.toString(), 70, yPosition);
          doc.setFont("helvetica", "normal");
          yPosition += 7;
        }
      });

      yPosition += 5;

      // SECTION 2: Supplier Information
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
        doc.text("Informasi supplier tidak tersedia", 25, yPosition);
        yPosition += 7;
      }

      yPosition += 5;

      // SECTION 3: Receiver Information
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("III. INFORMASI PENERIMA", 20, yPosition);

      yPosition += 8;

      if (transaction?.receivedBy) {
        const receiverInfo = [
          ["Nama Penerima", transaction.receivedBy.name],
          ["Username", transaction.receivedBy.username],
          ["ID Penerima", transaction.receivedById],
        ];

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(66, 66, 66);

        receiverInfo.forEach(([label, value]) => {
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
        doc.text("Informasi penerima tidak tersedia", 25, yPosition);
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
          item.item?.sku ?? "N/A",
          item.item?.name ?? "Unknown",
          item.quantity.toString(),
        ]);

        console.log("asdasdas", transaction.items[0].item.sku);

        autoTable(doc, {
          startY: yPosition,
          head: [["No", "Kode", "Nama Barang", "Jumlah"]],
          body: itemsData,
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 10,
            fontStyle: "bold",
          },
          bodyStyles: { fontSize: 10 },
          theme: "striped",

          // 👇 make table cross the page
          margin: { left: 10, right: 10 },

          columnStyles: {
            0: { cellWidth: 15, halign: "center" }, // No
            1: { cellWidth: 30, halign: "center" }, // Kode
            2: { cellWidth: "auto" }, // Nama Barang (fills space)
            3: { cellWidth: 25, halign: "center" }, // Jumlah
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

        const approvalInfo = [
          ["Status Persetujuan", transaction.status],
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
          doc.text(value.toString(), 70, yPosition);
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
          doc.text(value.toString(), 70, yPosition);
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
          <h1 className="text-2xl font-bold text-foreground">Incoming Goods</h1>
          <p className="text-muted-foreground">
            Manage incoming goods transactions
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Transaction
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Text Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transaction number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter by Supplier */}
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

            {/* Filter by Status */}
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

            {/* Filter by Specific Date */}
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

            {/* Filter by Month */}
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
            Clear Filters
          </Button>
          </div>

       
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filteredTransactions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No transactions found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    {/* <TableHead>Reference #</TableHead> */}
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((t) => (
                    // console.log(t),
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.transactionNumber}
                      </TableCell>
                      {/* <TableCell>{t.referenceNumber}</TableCell> */}
                      <TableCell>{getSupplierName(t.supplierId)}</TableCell>
                      <TableCell>{safeFormatDate(t.receivedAt)}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openViewDialog(t)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generatePDF(t)}
                            title="Generate PDF"
                          >
                            <FileText className="h-4 w-4 text-orange-400" />
                          </Button>
                          {t.status === "DRAFT" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSubmitId(t.id)}
                              >
                                <Send className="h-4 w-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(t.id)}
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
              {editingTransaction ? "Edit Transaction" : "New Incoming Goods"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
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
              {/* <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  value={formData.referenceNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      referenceNumber: e.target.value,
                    })
                  }
                  placeholder="e.g., INV-001"
                />
              </div> */}
            </div>
            <div className="space-y-2">
              <Label>Received Date</Label>
              <Input
                type="date"
                value={formData.receivedAt}
                onChange={(e) =>
                  setFormData({ ...formData, receivedAt: e.target.value })
                }
              />
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

            {/* Items Section */}
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
            <Button onClick={onSubmit}>
              {editingTransaction ? "Update" : "Create"} as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {viewingTransaction &&
            (console.log("asd", viewingTransaction.createdBy.name),
            (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">
                      Transaction Number
                    </Label>
                    <p className="font-medium">
                      {viewingTransaction.transactionNumber}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <StatusBadge status={viewingTransaction.status} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Supplier</Label>
                    <p className="font-medium">
                      {getSupplierName(viewingTransaction.supplierId)}
                    </p>
                  </div>
                  {/* <div>
                  <Label className="text-muted-foreground">
                    Reference Number
                  </Label>
                  <p className="font-medium">
                    {viewingTransaction.referenceNumber}
                  </p>
                </div> */}
                  <div>
                    <Label className="text-muted-foreground">
                      Received Date
                    </Label>
                    <p className="font-medium">
                      {safeFormatDate(viewingTransaction.receivedAt)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created By</Label>
                    <p className="font-medium">
                      {viewingTransaction.createdBy.name}
                    </p>
                  </div>
                </div>

                {viewingTransaction.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p>{viewingTransaction.notes}</p>
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
                        {viewingTransaction.items.map((item) => (
                          <TableRow key={item.itemId}>
                            <TableCell>{getItemName(item.itemId)}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => generatePDF(viewingTransaction)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate PDF
                  </Button>
                </div>

                {viewingTransaction.status === "APPROVED" &&
                  viewingTransaction.signatureImage &&
                  (console.log("namaku", viewingTransaction),
                  (
                    <div>
                      <Label className="text-muted-foreground">
                        Approval Signature
                      </Label>
                      <div className="border rounded-lg p-2 mt-2 bg-card">
                        <img
                          src={viewingTransaction.signatureImage}
                          alt="Signature"
                          className="max-w-full h-auto"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Approved by{" "}
                        {viewingTransaction.approvedBy?.name || "Unknown"} on{" "}
                        {safeFormatDate(
                          viewingTransaction.approvedAt,
                          "dd/MM/yyyy HH:mm"
                        )}
                      </p>
                    </div>
                  ))}

                {viewingTransaction.status === "REJECTED" && (
                  <div>
                    <Label className="text-muted-foreground">
                      Rejection Reason
                    </Label>
                    <p className="text-destructive">
                      {viewingTransaction.rejectionReason}
                    </p>
                  </div>
                )}
              </div>
            ))}
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation */}
      <AlertDialog open={!!submitId} onOpenChange={() => setSubmitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this transaction for approval? You
              won't be able to edit it after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IncomingGoods;
