import React, { useState } from "react";
import {
  useItems,
  useCategories,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from "@/hooks/useApi";
import { Item } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";

const itemSchema = z.object({
  // code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  unit: z.string().min(1, "Unit is required"),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  minStock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  location: z.string().min(1, "Location is required"),
  description: z.string(),
});

type ItemFormData = z.infer<typeof itemSchema>;

const Items: React.FC = () => {
  const { user } = useAuth();
  const { data: items = [], isLoading } = useItems();
  const { data: categories = [] } = useCategories();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      code: "",
      name: "",
      categoryId: "",
      unit: "",
      stock: 0,
      minStock: 0,
      location: "",
      description: "",
    },
  });

  const [filters, setFilters] = useState({
    categoryId: "ALL",
    lowStockOnly: false,
    location: "",
  });

  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase());

    const matchCategory =
      filters.categoryId === "ALL" || item.categoryId === filters.categoryId;

    const matchLowStock =
      !filters.lowStockOnly || item.currentStock <= item.minStock;

    const matchLocation =
      !filters.location ||
      item.location.toLowerCase().includes(filters.location.toLowerCase());

    return matchSearch && matchCategory && matchLowStock && matchLocation;
  });

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

  const openCreateDialog = () => {
    form.reset({
      code: "",
      name: "",
      categoryId: "",
      unit: "",
      stock: 0,
      minStock: 0,
      location: "",
      description: "",
    });
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    form.reset({
      code: item.code,
      name: item.name,
      categoryId: item.categoryId,
      unit: item.unit,
      stock: item.stock,
      minStock: item.minStock,
      location: item.location,
      description: item.description,
    });
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: ItemFormData) => {
    const loadingToast = toast.loading(editingItem ? "Updating item..." : "Creating item...");
    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, updates: data });
        toast.success("Item updated successfully", { id: loadingToast });
      } else {
        await createItem.mutateAsync({
          code: data.code,
          name: data.name,
          categoryId: data.categoryId,
          unit: data.unit,
          stock: data.stock,
          minStock: data.minStock,
          location: data.location,
          description: data.description,
        });
        toast.success("Item created successfully", { id: loadingToast });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save item", { id: loadingToast });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const loadingToast = toast.loading("Deleting item...");
    try {
      await deleteItem.mutateAsync(deleteId);
      toast.success("Item deleted successfully", { id: loadingToast });
      setDeleteId(null);
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Failed to delete item";
      toast.error(msg, { id: loadingToast });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Items</h1>
          <p className="text-muted-foreground">Manage inventory items</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by SKU or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category Filter */}
            <Select
              value={filters.categoryId}
              onValueChange={(v) => setFilters({ ...filters, categoryId: v })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location */}
            <Input
              placeholder="Filter location..."
              value={filters.location}
              onChange={(e) =>
                setFilters({ ...filters, location: e.target.value })
              }
              className="w-[180px]"
            />

            {/* Low Stock Toggle */}
            <Button
              variant={filters.lowStockOnly ? "default" : "outline"}
              onClick={() =>
                setFilters({
                  ...filters,
                  lowStockOnly: !filters.lowStockOnly,
                })
              }
            >
              Low Stock
            </Button>

            {/* Clear */}
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setFilters({
                  categoryId: "ALL",
                  lowStockOnly: false,
                  location: "",
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
          ) : filteredItems.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No items found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Location</TableHead>
                    {(user?.role === "admin" ||
                      user?.role === "warehouse_staff") && (
                      <TableHead className="w-[100px]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.sku}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{getCategoryName(item.categoryId)}</TableCell>
                      <TableCell>
                        <span
                          className={`flex items-center gap-1 ${
                            item.currentStock <= item.minStock
                              ? "text-status-waiting font-medium"
                              : ""
                          }`}
                        >
                          {item.currentStock <= item.minStock && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {item.currentStock}
                        </span>
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      {(user?.role === "admin" ||
                        user?.role === "warehouse_staff") && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(item.id)}
                              disabled={deleteItem.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Item" : "Add New Item"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" {...form.register('code')} />
                {form.formState.errors.code && (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                )}
              </div> */}

              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  {...form.register("unit")}
                  placeholder="e.g., Pcs, Box, Kg"
                />
                {form.formState.errors.unit && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.unit.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select
                value={form.watch("categoryId")}
                onValueChange={(v) => form.setValue("categoryId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoryId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryId.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Current Stock</Label>
                <Input id="stock" type="number" {...form.register("stock")} />
                {form.formState.errors.stock && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.stock.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Minimum Stock</Label>
                <Input
                  id="minStock"
                  type="number"
                  {...form.register("minStock")}
                />
                {form.formState.errors.minStock && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.minStock.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...form.register("location")}
                placeholder="e.g., Rack A-1"
              />
              {form.formState.errors.location && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.location.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...form.register("description")} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                {createItem.isPending || updateItem.isPending
                  ? "Saving..."
                  : editingItem
                  ? "Update"
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteItem.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Items;
