import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { MultiSelect } from "../ui/multi-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Plus, Trash2, Save, X, Edit, Download } from "lucide-react";
import { format } from "date-fns";
import { cn, formatThickness, formatWidth } from "@/lib/utils";
import {
  getSalesForItem,
  addSale,
  deleteSale,
  updateSale,
  getTotalSoldQuantity,
} from "../../lib/database";

const SalesManagementDialog = ({
  isOpen,
  onClose,
  inventoryItem,
  onSaleAdded,
}) => {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [totalSold, setTotalSold] = useState(0);
  const [balance, setBalance] = useState(0);
  // Confirmation dialog states
  const [confirmationDialog, setConfirmationDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: null,
    variant: "default",
  });

  // Helper function to show confirmation dialog
  const showConfirmation = (
    title,
    description,
    onConfirm,
    variant = "default"
  ) => {
    setConfirmationDialog({
      isOpen: true,
      title,
      description,
      onConfirm,
      variant,
    });
  };

  const closeConfirmation = () => {
    setConfirmationDialog({
      isOpen: false,
      title: "",
      description: "",
      onConfirm: null,
      variant: "default",
    });
  };

  const handleConfirmationConfirm = () => {
    if (confirmationDialog.onConfirm) {
      confirmationDialog.onConfirm();
    }
    closeConfirmation();
  };

  // Refs for auto-focus and scroll
  const scrollableContentRef = useRef(null);
  const addFormRef = useRef(null);
  const firstInputRef = useRef(null);
  const [newSale, setNewSale] = useState({
    sold_to: "",
    quantity_sold: "",
    form: "",
    sale_date: new Date().toISOString().split("T")[0],
    dimensions: [],
  });

  const formOptions = ["Coil", "Sheet"];
  const loadSales = async () => {
    if (!inventoryItem) return;

    try {
      setIsLoading(true);
      const salesData = await getSalesForItem(inventoryItem.id);
      setSales(salesData);

      const totalSoldQty = await getTotalSoldQuantity(inventoryItem.id);
      setTotalSold(parseFloat(totalSoldQty.toFixed(2)));
      setBalance(parseFloat((inventoryItem.weight - totalSoldQty).toFixed(2)));
    } catch (error) {
      console.error("Error loading sales:", error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (isOpen && inventoryItem) {
      loadSales();
    }
  }, [isOpen, inventoryItem]);

  // Auto-focus and scroll when add form is shown
  useEffect(() => {
    if (showAddForm && addFormRef.current && firstInputRef.current) {
      // Scroll the add form into view
      scrollableContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });

      // Focus on the first input field after a short delay to ensure scrolling completes
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 300);
    }
  }, [showAddForm]);

  const handleAddSale = async () => {
    try {
      const quantitySold = parseFloat(newSale.quantity_sold);

      if (!newSale.sold_to || !quantitySold || !newSale.form) {
        alert("Please fill in all required fields");
        return;
      }

      if (quantitySold <= 0) {
        alert("Quantity must be greater than 0");
        return;
      }

      if (quantitySold > balance) {
        alert(`Cannot sell ${quantitySold}. Available balance is ${balance}`);
        return;
      }
      await addSale(
        inventoryItem.id,
        newSale.sold_to,
        quantitySold,
        newSale.form,
        newSale.sale_date,
        JSON.stringify(newSale.dimensions) // Convert array to JSON string
      );
      setNewSale({
        sold_to: "",
        quantity_sold: "",
        form: "",
        sale_date: new Date().toISOString().split("T")[0],
        dimensions: "",
      });
      setShowAddForm(false);
      await loadSales();

      if (onSaleAdded) {
        onSaleAdded();
      }
    } catch (error) {
      console.error("Error adding sale:", error);
      alert("Error adding sale. Please try again.");
    }
  };
  const handleEditSale = (sale) => {
    const editingSaleData = { ...sale };
    // Parse dimensions from JSON string if it exists
    if (editingSaleData.dimensions) {
      try {
        const parsed = JSON.parse(editingSaleData.dimensions);
        editingSaleData.dimensions = Array.isArray(parsed)
          ? parsed
          : [editingSaleData.dimensions];
      } catch {
        // If parsing fails, treat as single dimension
        editingSaleData.dimensions = [editingSaleData.dimensions];
      }
    } else {
      editingSaleData.dimensions = [];
    }
    setEditingSale(editingSaleData);
  };

  const handleSaveEdit = async () => {
    try {
      const quantitySold = parseFloat(editingSale.quantity_sold);

      if (!editingSale.sold_to || !quantitySold || !editingSale.form) {
        alert("Please fill in all required fields");
        return;
      }

      if (quantitySold <= 0) {
        alert("Quantity must be greater than 0");
        return;
      }

      // Calculate available balance (excluding the current sale being edited)
      const otherSalesTotal = sales
        .filter((s) => s.id !== editingSale.id)
        .reduce((sum, s) => sum + s.quantity_sold, 0);
      const availableBalance = inventoryItem.weight - otherSalesTotal;

      if (quantitySold > availableBalance) {
        alert(
          `Cannot sell ${quantitySold}. Available balance is ${availableBalance}`
        );
        return;
      }
      const { id, created_at, updated_at, inventory_id, ...updates } =
        editingSale;
      // Convert dimensions array to JSON string if it's an array
      if (Array.isArray(updates.dimensions)) {
        updates.dimensions = JSON.stringify(updates.dimensions);
      }
      await updateSale(id, updates);

      setEditingSale(null);
      await loadSales();

      if (onSaleAdded) {
        onSaleAdded();
      }
    } catch (error) {
      console.error("Error updating sale:", error);
      alert("Error updating sale. Please try again.");
    }
  };
  const handleDeleteSale = async (saleId) => {
    showConfirmation(
      "Delete Sale",
      "Are you sure you want to delete this sale?",
      async () => {
        try {
          await deleteSale(saleId);
          await loadSales();

          if (onSaleAdded) {
            onSaleAdded();
          }
        } catch (error) {
          console.error("Error deleting sale:", error);
          alert("Error deleting sale. Please try again.");
        }
      },
      "destructive"
    );
  };

  const handleExportCSV = () => {
    if (sales.length === 0) {
      alert("No sales data to export");
      return;
    }

    // CSV headers
    const headers = [
      "Sale Date",
      "Dimensions",
      "Sold To",
      "Quantity Sold",
      "Form",
      "Entry Number",
      "Item Type",
      "Item Coating",
      "Item Specifications",
      "Item Form",
      "Item LOT",
      "Item Quality",
    ];

    // Convert sales data to CSV format
    const csvData = sales.map((sale) => {
      // Parse dimensions
      let dimensionsText = "—";
      if (sale.dimensions) {
        try {
          const parsed = JSON.parse(sale.dimensions);
          dimensionsText = Array.isArray(parsed)
            ? parsed.join("\n")
            : sale.dimensions;
        } catch {
          dimensionsText = sale.dimensions;
        }
      }

      return [
        format(new Date(sale.sale_date), "dd/MM/yyyy"),
        dimensionsText,
        sale.sold_to,
        sale.quantity_sold,
        sale.form,
        inventoryItem.sno,
        inventoryItem.type,
        inventoryItem.coating || "—",
        inventoryItem.specifications || "—",
        inventoryItem.form || "—",
        inventoryItem.lot,
        inventoryItem.quality || "—",
      ];
    });

    // Combine headers and data
    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n"); // Create and download the file
    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `sales_entry_${inventoryItem.sno}_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleClose = () => {
    setShowAddForm(false);
    setEditingSale(null);
    setNewSale({
      sold_to: "",
      quantity_sold: "",
      form: "",
      sale_date: new Date().toISOString().split("T")[0],
      dimensions: [],
    });
    onClose();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle shortcuts when dialog is open
      if (!isOpen) return;

      // Ctrl+S for add sale (only when not editing and form is not shown)
      if (event.ctrlKey && event.key === "s" && !editingSale) {
        event.preventDefault();
        if (!showAddForm && balance > 0) {
          setShowAddForm(true);
        } else if (showAddForm) {
          // If form is already open, trigger the save action
          handleAddSale();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, editingSale, showAddForm, balance]);

  if (!inventoryItem) return null;
  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-semibold">
              Sales Management - Entry #{inventoryItem.sno}
            </DialogTitle>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
              {/* 1. Entry date */}
              <span>
                Entry Date:{" "}
                <strong>
                  {format(
                    new Date(inventoryItem.date || new Date()),
                    "dd/MM/yyyy"
                  )}
                </strong>
              </span>

              {/* 2. Type */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`transition-all duration-200 shadow-sm font-medium text-indigo-700 border-indigo-400 bg-indigo-50`}
                >
                  {inventoryItem.type}
                </Badge>
              </div>
              {/* 3. Dimensions */}
              <span>
                Dimensions:{" "}
                <strong>
                  {formatThickness(inventoryItem.thickness)} ×{" "}
                  {formatWidth(inventoryItem.width)} - {inventoryItem.weight}
                </strong>
              </span>
              {/* 4. Coating */}
              <span>
                Coating: <strong>{inventoryItem.coating || "—"}</strong>
              </span>
              {/* 5. Specifications */}
              <span>
                Specifications:{" "}
                <strong>{inventoryItem.specifications || "—"}</strong>
              </span>
              {/* 6. Form */}
              <span>
                Form: <strong>{inventoryItem.form || "—"}</strong>
              </span>

              {/* 5. Lot */}
              <span>
                LOT: <strong>{inventoryItem.lot}</strong>
              </span>

              {/* 6. Quality */}
              <div className="flex items-center gap-2">
                {inventoryItem.quality && (
                  <Badge
                    variant="outline"
                    className={`transition-all duration-200 shadow-sm font-medium ${
                      inventoryItem.quality === "Soft"
                        ? "text-blue-600 border-blue-300 bg-blue-50"
                        : inventoryItem.quality === "Hard"
                        ? "text-red-600 border-red-300 bg-red-50"
                        : inventoryItem.quality === "Semi"
                        ? "text-orange-600 border-orange-300 bg-orange-50"
                        : "text-gray-700 border-gray-400 bg-gray-50"
                    }`}
                  >
                    {inventoryItem.quality}
                  </Badge>
                )}
              </div>

              {/* 7. Status */}
              <div className="text-sm">
                <Badge
                  variant={balance > 0 ? "secondary" : "default"}
                  className={`
                  transition-all duration-200 shadow-sm
                  ${
                    balance > 0
                      ? "bg-muted text-muted-foreground hover:bg-muted/80"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }
                `}
                >
                  {balance > 0 ? "Available" : "Sold Out"}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {" "}
              {/* Sales Table Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium">Sales History</h3>
                  {sales.length > 0 && (
                    <Button
                      onClick={handleExportCSV}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                </div>
                <div className="border rounded-lg overflow-hidden bg-white">
                  {" "}
                  {/* Fixed Header */}{" "}
                  <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
                    <div className="grid grid-cols-[140px_140px_minmax(200px,1fr)_120px_100px_120px] gap-0 font-semibold text-sm">
                      <div className="px-4 py-3 border-r text-left">
                        Sale Date
                      </div>
                      <div className="px-4 py-3 border-r text-left">
                        Dimensions
                      </div>
                      <div className="px-4 py-3 border-r text-left">
                        Sold To
                      </div>
                      <div className="px-4 py-3 border-r text-left">
                        Quantity
                      </div>
                      <div className="px-4 py-3 border-r text-left">Form</div>
                      <div className="px-4 py-3 text-left">Actions</div>
                    </div>
                  </div>
                  {/* Scrollable Content */}
                  <div
                    className="max-h-[350px] overflow-y-auto"
                    ref={scrollableContentRef}
                  >
                    {" "}
                    {/* Add Sale Form Row - Now at the top */}{" "}
                    {showAddForm && (
                      <div
                        ref={addFormRef}
                        className="grid grid-cols-[140px_140px_minmax(200px,1fr)_120px_100px_120px] gap-0 bg-muted/30 border-b"
                      >
                        <div className="px-4 py-3 border-r">
                          <Input
                            ref={firstInputRef}
                            type="date"
                            value={newSale.sale_date}
                            onChange={(e) =>
                              setNewSale((prev) => ({
                                ...prev,
                                sale_date: e.target.value,
                              }))
                            }
                            className="h-8"
                          />
                        </div>{" "}
                        <div className="px-4 py-3 border-r">
                          {" "}
                          <MultiSelect
                            value={newSale.dimensions}
                            onValueChange={(value) =>
                              setNewSale((prev) => ({
                                ...prev,
                                dimensions: value,
                              }))
                            }
                            options={
                              inventoryItem.dimensions
                                ? inventoryItem.dimensions.map(
                                    (dimension, index) => ({
                                      value: `${formatThickness(
                                        dimension.thickness
                                      )}×${formatWidth(dimension.width)}`,
                                      label: `${formatThickness(
                                        dimension.thickness
                                      )}×${formatWidth(dimension.width)}`,
                                    })
                                  )
                                : []
                            }
                            placeholder="Select dimensions"
                            className="h-8"
                          />
                        </div>
                        <div className="px-4 py-3 border-r">
                          <Input
                            value={newSale.sold_to}
                            onChange={(e) =>
                              setNewSale((prev) => ({
                                ...prev,
                                sold_to: e.target.value,
                              }))
                            }
                            placeholder="Customer name"
                            className="h-8"
                          />
                        </div>
                        <div className="px-4 py-3 border-r">
                          <Input
                            type="number"
                            step="0.01"
                            value={newSale.quantity_sold}
                            onChange={(e) =>
                              setNewSale((prev) => ({
                                ...prev,
                                quantity_sold: e.target.value,
                              }))
                            }
                            placeholder="Quantity"
                            max={balance}
                            className="h-8"
                          />
                        </div>
                        <div className="px-4 py-3 border-r">
                          <Select
                            value={newSale.form}
                            onValueChange={(value) =>
                              setNewSale((prev) => ({ ...prev, form: value }))
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Form" />
                            </SelectTrigger>
                            <SelectContent>
                              {formOptions.map((form) => (
                                <SelectItem key={form} value={form}>
                                  {form}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>{" "}
                        <div className="px-4 py-3">
                          <div className="flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={handleAddSale}
                                  className="h-8 w-8 p-0"
                                  title="Save"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Save sale entry (Ctrl+S)</p>
                              </TooltipContent>
                            </Tooltip>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowAddForm(false)}
                              className="h-8 w-8 p-0"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : sales.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No sales recorded yet
                      </div>
                    ) : (
                      sales.map((sale) => (
                        <div
                          key={sale.id}
                          className="grid grid-cols-[140px_140px_minmax(200px,1fr)_120px_100px_120px] gap-0 border-b hover:bg-muted/50"
                        >
                          {editingSale && editingSale.id === sale.id ? (
                            // Edit mode
                            <>
                              <div className="px-4 py-3 border-r">
                                <Input
                                  type="date"
                                  value={editingSale.sale_date}
                                  onChange={(e) =>
                                    setEditingSale((prev) => ({
                                      ...prev,
                                      sale_date: e.target.value,
                                    }))
                                  }
                                  className="h-8"
                                />
                              </div>{" "}
                              <div className="px-4 py-3 border-r">
                                <MultiSelect
                                  value={
                                    editingSale.dimensions
                                      ? Array.isArray(editingSale.dimensions)
                                        ? editingSale.dimensions
                                        : [editingSale.dimensions]
                                      : []
                                  }
                                  onValueChange={(value) =>
                                    setEditingSale((prev) => ({
                                      ...prev,
                                      dimensions: value,
                                    }))
                                  }
                                  options={
                                    inventoryItem.dimensions
                                      ? inventoryItem.dimensions.map(
                                          (dimension, index) => ({
                                            value: `${formatThickness(
                                              dimension.thickness
                                            )}×${formatWidth(dimension.width)}`,
                                            label: `${formatThickness(
                                              dimension.thickness
                                            )}×${formatWidth(dimension.width)}`,
                                          })
                                        )
                                      : []
                                  }
                                  placeholder="Select dimensions"
                                  className="h-8"
                                />
                              </div>
                              <div className="px-4 py-3 border-r">
                                <Input
                                  value={editingSale.sold_to}
                                  onChange={(e) =>
                                    setEditingSale((prev) => ({
                                      ...prev,
                                      sold_to: e.target.value,
                                    }))
                                  }
                                  className="h-8"
                                />
                              </div>
                              <div className="px-4 py-3 border-r">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingSale.quantity_sold}
                                  onChange={(e) =>
                                    setEditingSale((prev) => ({
                                      ...prev,
                                      quantity_sold:
                                        parseFloat(e.target.value) || 0,
                                    }))
                                  }
                                  className="h-8"
                                />
                              </div>
                              <div className="px-4 py-3 border-r">
                                <Select
                                  value={editingSale.form}
                                  onValueChange={(value) =>
                                    setEditingSale((prev) => ({
                                      ...prev,
                                      form: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {formOptions.map((form) => (
                                      <SelectItem key={form} value={form}>
                                        {form}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="px-4 py-3">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={handleSaveEdit}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingSale(null)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          ) : (
                            // View mode
                            <>
                              <div className="px-4 py-3 border-r">
                                {format(new Date(sale.sale_date), "dd/MM/yyyy")}
                              </div>{" "}
                              <div className="px-4 py-3 border-r">
                                <div className="text-sm">
                                  {(() => {
                                    const dimensions = sale.dimensions;
                                    if (!dimensions) return "—";
                                    try {
                                      const parsed = JSON.parse(dimensions);
                                      if (Array.isArray(parsed)) {
                                        return parsed.map((dim, index) => (
                                          <div
                                            key={index}
                                            className="leading-tight"
                                          >
                                            {dim}
                                          </div>
                                        ));
                                      }
                                      return dimensions;
                                    } catch {
                                      return dimensions;
                                    }
                                  })()}
                                </div>
                              </div>
                              <div className="px-4 py-3 border-r">
                                <div className="truncate" title={sale.sold_to}>
                                  {sale.sold_to}
                                </div>
                              </div>
                              <div className="px-4 py-3 border-r">
                                {sale.quantity_sold}
                              </div>
                              <div className="px-4 py-3 border-r">
                                <Badge variant="outline">{sale.form}</Badge>
                              </div>
                              <div className="px-4 py-3">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditSale(sale)}
                                    className="h-8 w-8 p-0"
                                    title="Edit sale"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteSale(sale.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                    title="Delete sale"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {/* Add Sale Button - At the bottom of the table */}
                  {!showAddForm && (
                    <div className="p-3 border-t flex justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setShowAddForm(true)}
                            disabled={balance <= 0}
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Sale
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Add new sale entry (Ctrl+S)</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>
              {/* Summary */}
              {sales.length > 0 && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {inventoryItem.weight}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Original Weight
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {totalSold}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Sold
                      </div>
                    </div>
                    <div>
                      <div
                        className={cn(
                          "text-2xl font-bold",
                          balance > 0 ? "text-blue-600" : "text-orange-600"
                        )}
                      >
                        {balance}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {balance > 0 ? "Remaining Balance" : "Fully Sold"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>{" "}
          </div>
        </DialogContent>
        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={confirmationDialog.isOpen}
          onClose={closeConfirmation}
          onConfirm={handleConfirmationConfirm}
          title={confirmationDialog.title}
          description={confirmationDialog.description}
          variant={confirmationDialog.variant}
        />{" "}
      </Dialog>
    </TooltipProvider>
  );
};

export default SalesManagementDialog;
