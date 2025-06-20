import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "../components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  Plus,
  Save,
  XCircle,
  Edit,
  Trash2,
  Filter,
  Download,
  Upload,
  Archive,
  MoreHorizontal,
  X,
  Edit2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Truck,
  RotateCcw,
  CheckCircle,
  Package,
  DollarSign,
  AlertTriangle,
  XOctagon,
} from "lucide-react";
import { format } from "date-fns";
import { cn, formatThickness, formatWidth } from "@/lib/utils";
import { logoutUser } from "../lib/auth";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  sendItemToDC,
  bulkSendItemsToDC,
  returnItemFromDC,
  bulkReturnItemsFromDC,
  getInventoryItemsWithBalance,
  getSalesForItem,
  importInventoryFromCSV,
  importSalesFromCSV,
  importCombinedFromCSV,
} from "../lib/database";
import SalesManagementDialog from "../components/dialogs/SalesManagementDialog";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";

const Dashboard = ({
  onLogout,
  filters,
  onFilterChange,
  onClearFilters,
  onSetExportFunction,
  onSetImportFunction,
}) => {
  const { toggleSidebar } = useSidebar();
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddRow, setShowAddRow] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [showSalesDialog, setShowSalesDialog] = useState(false);
  const [selectedItemForSales, setSelectedItemForSales] = useState(null);
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
  const [bulkEditData, setBulkEditData] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    type: "",
    quality: "",
    lot: "",
    thickness: "",
    width: "",
    weight: "",
    coating: "",
    specifications: "",
    form: "",
    dc_status: 0,
    updateEntryDate: false,
    updateType: false,
    updateQuality: false,
    updateLot: false,
    updateThickness: false,
    updateWidth: false,
    updateWeight: false,
    updateCoating: false,
    updateSpecifications: false,
    updateForm: false,
    updateDCStatus: false,
  }); // New item form states
  const [newItem, setNewItem] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    sno: "",
    type: "",
    weight: "",
    coating: "",
    specifications: "",
    form: "",
    lot: "",
    quality: "",
    dc_status: 0,
    dimensions: [{ thickness: "", width: "" }],
  }); // CSV Import states
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importType, setImportType] = useState("inventory"); // 'inventory', 'sales', 'combined'

  // Steel type options
  const typeOptions = [
    "E",
    "GA",
    "GA1",
    "4",
    "5",
    "4N",
    "4G",
    "Scrap",
    "Paint",
    "Others",
  ];
  const qualityOptions = ["Soft", "Hard", "Semi"];

  const formOptions = ["Coil", "Sheet"];
  // Function to get color scheme for different steel types
  const getSteelTypeColors = (type) => {
    const colorMap = {
      E: "text-emerald-700 border-emerald-400 bg-emerald-50 hover:bg-emerald-100",
      GA: "text-blue-700 border-blue-400 bg-blue-50 hover:bg-blue-100",
      GA1: "text-indigo-700 border-indigo-400 bg-indigo-50 hover:bg-indigo-100",
      "4": "text-orange-700 border-orange-400 bg-orange-50 hover:bg-orange-100",
      "5": "text-red-700 border-red-400 bg-red-50 hover:bg-red-100",
      "4N": "text-purple-700 border-purple-400 bg-purple-50 hover:bg-purple-100",
      "4G": "text-teal-700 border-teal-400 bg-teal-50 hover:bg-teal-100",
      Scrap: "text-amber-700 border-amber-400 bg-amber-50 hover:bg-amber-100",
      Paint: "text-cyan-700 border-cyan-400 bg-cyan-50 hover:bg-cyan-100",
      Others: "text-slate-700 border-slate-400 bg-slate-50 hover:bg-slate-100",
    };
    return (
      colorMap[type] ||
      "text-gray-700 border-gray-400 bg-gray-50 hover:bg-gray-100"
    );
  };

  // Function to get color scheme for different quality types
  const getQualityColors = (quality) => {
    const colorMap = {
      Soft: "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100",
      Hard: "text-red-600 border-red-300 bg-red-50 hover:bg-red-100",
      Semi: "text-orange-600 border-orange-300 bg-orange-50 hover:bg-orange-100",
    };
    return (
      colorMap[quality] ||
      "text-gray-700 border-gray-400 bg-gray-50 hover:bg-gray-100"
    );
  };

  // Helper function to check if any selected items are eligible for sending to DC
  const hasEligibleItemsForDC = () => {
    if (selectedItems.size === 0) return false;

    const selectedData = filteredInventory.filter((item) =>
      selectedItems.has(item.id)
    );
    const eligibleItems = selectedData.filter(
      (item) =>
        item.dc_status === 0 && item.balance > 0 && item.balance === item.weight
    );

    return eligibleItems.length > 0;
  };

  // Helper function to check if any selected items are eligible for returning from DC
  const hasEligibleItemsForDCReturn = () => {
    if (selectedItems.size === 0) return false;

    const selectedData = filteredInventory.filter((item) =>
      selectedItems.has(item.id)
    );
    const eligibleItems = selectedData.filter((item) => item.dc_status === 1);

    return eligibleItems.length > 0;
  };

  const handleLogout = () => {
    logoutUser();
    onLogout();
  };

  const getNextSno = () => {
    if (inventory.length === 0) return "1";
    const maxSno = inventory.reduce((max, item) => {
      const snoNum = parseInt(item.sno);
      return isNaN(snoNum) ? max : Math.max(max, snoNum);
    }, 0);
    return (maxSno + 1).toString();
  };
  const loadInventory = async () => {
    try {
      setIsLoading(true);
      // Load all inventory items without filters first
      const items = await getInventoryItemsWithBalance();
      setInventory(items);
    } catch (error) {
      console.error("Error loading inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...inventory];

    // Date range filter
    if (filters.startDate) {
      filtered = filtered.filter(
        (item) => item.entry_date >= filters.startDate
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter((item) => item.entry_date <= filters.endDate);
    }

    // Type filter
    if (filters.type.length > 0) {
      filtered = filtered.filter((item) => filters.type.includes(item.type));
    }

    // Quality filter
    if (filters.quality.length > 0) {
      filtered = filtered.filter((item) =>
        filters.quality.includes(item.quality)
      );
    } // Text filters
    if (filters.lot) {
      filtered = filtered.filter((item) =>
        item.lot.toLowerCase().includes(filters.lot.toLowerCase())
      );
    }
    if (filters.coating) {
      filtered = filtered.filter(
        (item) =>
          item.coating &&
          item.coating.toLowerCase().includes(filters.coating.toLowerCase())
      );
    }

    // Specifications filter
    if (filters.specifications) {
      filtered = filtered.filter(
        (item) =>
          item.specifications &&
          item.specifications
            .toLowerCase()
            .includes(filters.specifications.toLowerCase())
      );
    }

    // Form filter
    if (filters.form) {
      filtered = filtered.filter(
        (item) =>
          item.form &&
          item.form.toLowerCase().includes(filters.form.toLowerCase())
      );
    }

    // Sold To filter - search in the sales customers array
    if (filters.soldTo) {
      filtered = filtered.filter(
        (item) =>
          item.salesCustomers &&
          item.salesCustomers.some((customer) =>
            customer.toLowerCase().includes(filters.soldTo.toLowerCase())
          )
      );
    } // Range filters - handle multiple dimensions
    if (filters.minThickness) {
      filtered = filtered.filter((item) => {
        if (item.dimensions && item.dimensions.length > 0) {
          return item.dimensions.some(
            (dim) =>
              parseFloat(dim.thickness) >= parseFloat(filters.minThickness)
          );
        }
        // Backward compatibility for single dimension items
        return (
          item.thickness &&
          parseFloat(item.thickness) >= parseFloat(filters.minThickness)
        );
      });
    }
    if (filters.maxThickness) {
      filtered = filtered.filter((item) => {
        if (item.dimensions && item.dimensions.length > 0) {
          return item.dimensions.some(
            (dim) =>
              parseFloat(dim.thickness) <= parseFloat(filters.maxThickness)
          );
        }
        // Backward compatibility for single dimension items
        return (
          item.thickness &&
          parseFloat(item.thickness) <= parseFloat(filters.maxThickness)
        );
      });
    }

    if (filters.minWidth) {
      filtered = filtered.filter((item) => {
        if (item.dimensions && item.dimensions.length > 0) {
          return item.dimensions.some(
            (dim) => parseFloat(dim.width) >= parseFloat(filters.minWidth)
          );
        }
        // Backward compatibility for single dimension items
        return (
          item.width && parseFloat(item.width) >= parseFloat(filters.minWidth)
        );
      });
    }
    if (filters.maxWidth) {
      filtered = filtered.filter((item) => {
        if (item.dimensions && item.dimensions.length > 0) {
          return item.dimensions.some(
            (dim) => parseFloat(dim.width) <= parseFloat(filters.maxWidth)
          );
        }
        // Backward compatibility for single dimension items
        return (
          item.width && parseFloat(item.width) <= parseFloat(filters.maxWidth)
        );
      });
    }

    if (filters.minWeight) {
      filtered = filtered.filter(
        (item) => item.weight >= parseFloat(filters.minWeight)
      );
    }
    if (filters.maxWeight) {
      filtered = filtered.filter(
        (item) => item.weight <= parseFloat(filters.maxWeight)
      );
    } // Sold status filter - based on balance
    if (filters.showSoldOnly) {
      filtered = filtered.filter((item) => item.balance <= 0);
    } else if (filters.showUnsoldOnly) {
      filtered = filtered.filter((item) => item.balance > 0);
    }

    // DC status filter
    if (filters.showDCOnly) {
      filtered = filtered.filter((item) => item.dc_status === 1);
    } else if (filters.showNonDCOnly) {
      filtered = filtered.filter((item) => item.dc_status === 0);
    }

    setFilteredInventory(filtered);
  };

  // Sorting functionality
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedInventory = React.useMemo(() => {
    if (!sortConfig.key) return filteredInventory;

    return [...filteredInventory].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle different data types
      if (sortConfig.key === "entry_date") {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        return sortConfig.direction === "asc" ? aDate - bDate : bDate - aDate;
      }
      if (sortConfig.key === "sno" || sortConfig.key === "weight") {
        const aNum = parseFloat(aValue) || 0;
        const bNum = parseFloat(bValue) || 0;
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Handle thickness and width sorting for items with multiple dimensions
      if (sortConfig.key === "thickness" || sortConfig.key === "width") {
        let aNum = 0,
          bNum = 0;

        // For items with dimensions array, use the first dimension for sorting
        if (a.dimensions && a.dimensions.length > 0) {
          aNum = parseFloat(a.dimensions[0][sortConfig.key]) || 0;
        } else {
          // Backward compatibility for single dimension items
          aNum = parseFloat(a[sortConfig.key]) || 0;
        }

        if (b.dimensions && b.dimensions.length > 0) {
          bNum = parseFloat(b.dimensions[0][sortConfig.key]) || 0;
        } else {
          // Backward compatibility for single dimension items
          bNum = parseFloat(b[sortConfig.key]) || 0;
        }

        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Handle string comparison
      const aStr = (aValue || "").toString().toLowerCase();
      const bStr = (bValue || "").toString().toLowerCase();

      if (sortConfig.direction === "asc") {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [filteredInventory, sortConfig]);

  const getSortIcon = (column) => {
    if (sortConfig.key !== column) {
      return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />;
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="w-4 h-4 text-primary" />
    ) : (
      <ChevronDown className="w-4 h-4 text-primary" />
    );
  };
  // Function to get status badge for an item
  const getStatusBadge = (item) => {
    // If balance is 0 or negative, item is fully sold
    if (item.balance <= 0) {
      return {
        text: "Sold Out",
        variant: "default",
        className: "bg-green-600 hover:bg-green-700 text-white",
      };
    }

    // If dc_status is true, item is at DC
    if (item.dc_status === 1) {
      return {
        text: "DC",
        variant: "default",
        className: "bg-blue-600 hover:bg-blue-700 text-white",
      };
    }

    // Otherwise item is available
    return {
      text: "Available",
      variant: "secondary",
      className: "bg-muted text-muted-foreground hover:bg-muted/80",
    };
  };
  const handleAddItem = async () => {
    try {
      await addInventoryItem(newItem);
      setShowAddRow(false);
      setNewItem({
        entry_date: new Date().toISOString().split("T")[0],
        sno: "",
        type: "",
        weight: "",
        coating: "",
        specifications: "",
        form: "",
        lot: "",
        quality: "",
        dc_status: 0,
        dimensions: [{ thickness: "", width: "" }],
      });
      await loadInventory();
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };
  const handleCancelAdd = () => {
    setShowAddRow(false);
    setNewItem({
      entry_date: new Date().toISOString().split("T")[0],
      sno: "",
      type: "",
      weight: "",
      coating: "",
      specifications: "",
      form: "",
      lot: "",
      quality: "",
      dc_status: 0,
      dimensions: [{ thickness: "", width: "" }],
    });
  };
  const handleEditItem = (item) => {
    // Prevent editing if item is in DC
    if (item.dc_status === 1) {
      alert(
        "Items that are in DC cannot be edited. Return item from DC first to make changes."
      );
      return;
    }
    // Ensure dimensions array exists for editing
    const itemWithDimensions = {
      ...item,
      dimensions:
        item.dimensions && item.dimensions.length > 0
          ? item.dimensions
          : [{ thickness: item.thickness || "", width: item.width || "" }],
    };
    setEditingItem(itemWithDimensions);
    // Reset sorting when entering edit mode
    setSortConfig({ key: null, direction: "asc" });
  };
  const handleSaveEdit = async () => {
    try {
      const {
        id,
        balance,
        created_at,
        updated_at,
        dimensions_display,
        dimension_count,
        salesCustomers,
        ...updates
      } = editingItem;
      await updateInventoryItem(id, updates);
      setEditingItem(null);
      await loadInventory();
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };
  const handleDeleteItem = async (id) => {
    showConfirmation(
      "Delete Item",
      "Are you sure you want to delete this item?",
      async () => {
        try {
          await deleteInventoryItem(id);
          await loadInventory();
        } catch (error) {
          console.error("Error deleting item:", error);
        }
      },
      "destructive"
    );
  };
  // Function to handle sending individual item to DC
  const handleSendToDC = async (item) => {
    // Check if item is available (not at DC) and balance equals weight (not partially sold)
    if (item.dc_status === 1) {
      alert("This item is already at DC.");
      return;
    }

    if (item.balance <= 0) {
      alert(
        "Cannot send fully sold items to DC. Only items with remaining balance can be sent to DC."
      );
      return;
    }

    if (item.balance !== item.weight) {
      alert(
        "Cannot send partially sold items to DC. Only items with full balance (balance = weight) can be sent to DC."
      );
      return;
    }
    showConfirmation(
      "Send Item to DC",
      `Are you sure you want to send item ${item.sno} to DC?`,
      async () => {
        try {
          await sendItemToDC(item.id);
          await loadInventory();
        } catch (error) {
          console.error("Error sending item to DC:", error);
          alert(error.message);
        }
      }
    );
  };

  // Function to handle returning individual item from DC to warehouse
  const handleReturnFromDC = async (item) => {
    showConfirmation(
      "Return Item from DC",
      `Are you sure you want to return item ${item.sno} from DC to warehouse?`,
      async () => {
        try {
          await returnItemFromDC(item.id);
          await loadInventory();
        } catch (error) {
          console.error("Error returning item from DC:", error);
          alert(error.message);
        }
      }
    );
  };
  const handleOpenSalesDialog = (item) => {
    // Prevent sales management if item is in DC
    if (item.dc_status === 1) {
      alert(
        "Items that are in DC cannot have sales managed. Return item from DC first to manage sales."
      );
      return;
    }
    setSelectedItemForSales(item);
    setShowSalesDialog(true);
  };

  const handleCloseSalesDialog = () => {
    setShowSalesDialog(false);
    setSelectedItemForSales(null);
  };

  // Function to handle double-click on row to open sales management
  const handleRowDoubleClick = (item) => {
    // Don't process double-clicks when in edit mode
    if (editingItem) return;
    handleOpenSalesDialog(item);
  };

  const handleSaleAdded = () => {
    // Reload inventory to update balance
    loadInventory();
  };
  const handleShowAddRow = () => {
    const nextSno = getNextSno();
    setNewItem((prev) => ({
      ...prev,
      sno: nextSno,
      dimensions: [{ thickness: "", width: "" }],
    }));
    setShowAddRow(true);
    // Reset sorting when entering add mode
    setSortConfig({ key: null, direction: "asc" });
  };
  // Selection helper functions
  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(sortedInventory.map((item) => item.id));
      setSelectedItems(allIds);
      setIsAllSelected(true);
    } else {
      setSelectedItems(new Set());
      setIsAllSelected(false);
    }
  };

  const handleSelectItem = (id, checked) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
      setIsAllSelected(false);
    }
    setSelectedItems(newSelected);

    // Update all selected state
    if (
      newSelected.size === sortedInventory.length &&
      sortedInventory.length > 0
    ) {
      setIsAllSelected(true);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    showConfirmation(
      "Delete Items",
      `Are you sure you want to delete ${selectedItems.size} selected items?`,
      async () => {
        try {
          const deletePromises = Array.from(selectedItems).map((id) =>
            deleteInventoryItem(id)
          );
          await Promise.all(deletePromises);
          setSelectedItems(new Set());
          setIsAllSelected(false);
          await loadInventory();
        } catch (error) {
          console.error("Error deleting items:", error);
        }
      },
      "destructive"
    );
  };
  const handleBulkExport = async (exportType = "inventory") => {
    if (selectedItems.size === 0) return;

    const selectedData = sortedInventory.filter((item) =>
      selectedItems.has(item.id)
    );
    if (exportType === "inventory") {
      // Export inventory data only
      const headers = [
        "Entry Date",
        "S.No",
        "Type",
        "Dimensions",
        "Weight",
        "Coating",
        "Specifications",
        "Item Form",
        "LOT",
        "Quality",
        "Balance",
      ];
      const csvContent = [
        headers.join(","),
        ...selectedData.map((item) =>
          [
            `"${format(new Date(item.entry_date), "dd/MM/yyyy")}"`,
            `"${item.sno}"`,
            `"${item.type}"`, // Format dimensions as "thick1×width1; thick2×width2"
            `"${
              item.dimensions && item.dimensions.length > 0
                ? item.dimensions
                    .map(
                      (dim) =>
                        `${formatThickness(dim.thickness)}×${formatWidth(
                          dim.width
                        )}`
                    )
                    .join("; ")
                : `${formatThickness(item.thickness) || ""}×${
                    formatWidth(item.width) || ""
                  }`
            }"`, // Backward compatibility
            `"${item.weight}"`,
            `"'${item.coating || ""}"`,
            `"${item.specifications || ""}"`,
            `"${item.form || ""}"`,
            `"${item.lot}"`,
            `"${item.quality}"`,
            `"${item.balance || ""}"`,
          ].join(",")
        ),
      ].join("\n"); // Add BOM for Excel UTF-8 compatibility
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `selected-inventory-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else if (exportType === "sales") {
      // Export sales data only
      try {
        const allSalesData = [];

        for (const item of selectedData) {
          const salesForItem = await getSalesForItem(item.id);
          salesForItem.forEach((sale) => {
            // Parse dimensions
            let dimensionsText = "—";
            if (sale.dimensions) {
              try {
                const parsed = JSON.parse(sale.dimensions);
                dimensionsText = Array.isArray(parsed)
                  ? parsed.join(" ")
                  : sale.dimensions;
              } catch {
                dimensionsText = sale.dimensions;
              }
            }
            allSalesData.push([
              format(new Date(sale.sale_date), "dd/MM/yyyy"),
              item.sno,
              item.type,
              dimensionsText,
              sale.sold_to,
              sale.quantity_sold,
              sale.form,
              `'${item.coating || ""}`,
              item.specifications || "",
              item.form || "",
              item.lot,
              item.quality || "",
            ]);
          });
        }
        if (allSalesData.length === 0) {
          alert("No sales data found for selected items");
          return;
        }

        const headers = [
          "Sale Date",
          "Entry Number",
          "Item Type",
          "Dimensions",
          "Sold To",
          "Quantity Sold",
          "Form",
          "Item Coating",
          "Item Specifications",
          "Item Form",
          "Item LOT",
          "Item Quality",
        ];
        const csvContent = [
          headers.join(","),
          ...allSalesData.map((row) =>
            row.map((field) => `"${field}"`).join(",")
          ),
        ].join("\n"); // Add BOM for Excel UTF-8 compatibility
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `selected-sales-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error exporting sales data:", error);
        alert("Error exporting sales data. Please try again.");
      }
    } else if (exportType === "inventory-with-sales") {
      // Export combined inventory and sales data
      try {
        const combinedData = [];

        for (const item of selectedData) {
          const salesForItem = await getSalesForItem(item.id);
          if (salesForItem.length === 0) {
            // Item with no sales
            combinedData.push([
              item.entry_date,
              item.sno,
              item.type,
              item.dimensions && item.dimensions.length > 0
                ? item.dimensions
                    .map(
                      (dim) =>
                        `${formatThickness(dim.thickness)}×${formatWidth(
                          dim.width
                        )}`
                    )
                    .join("; ")
                : `${formatThickness(item.thickness) || ""}×${
                    formatWidth(item.width) || ""
                  }`,
              item.weight,
              `'${item.coating || ""}`,
              item.specifications || "",
              item.form || "",
              item.lot,
              item.quality || "",
              item.balance || "",
              "—", // Sale Date
              "—", // Sale Dimensions
              "—", // Sold To
              "—", // Quantity Sold
              "—", // Form
            ]);
          } else {
            // Item with sales
            salesForItem.forEach((sale) => {
              // Parse dimensions
              let saleDimensionsText = "—";
              if (sale.dimensions) {
                try {
                  const parsed = JSON.parse(sale.dimensions);
                  saleDimensionsText = Array.isArray(parsed)
                    ? parsed.join(" ")
                    : sale.dimensions;
                } catch {
                  saleDimensionsText = sale.dimensions;
                }
              }

              combinedData.push([
                item.entry_date,
                item.sno,
                item.type,
                item.dimensions && item.dimensions.length > 0
                  ? item.dimensions
                      .map(
                        (dim) =>
                          `${formatThickness(dim.thickness)}×${formatWidth(
                            dim.width
                          )}`
                      )
                      .join("; ")
                  : `${formatThickness(item.thickness) || ""}×${
                      formatWidth(item.width) || ""
                    }`,
                item.weight,
                `'${item.coating || ""}`,
                item.specifications || "",
                item.form || "",
                item.lot,
                item.quality || "",
                item.balance || "",
                format(new Date(sale.sale_date), "dd/MM/yyyy"),
                saleDimensionsText,
                sale.sold_to,
                sale.quantity_sold,
                sale.form,
              ]);
            });
          }
        }
        const headers = [
          "Entry Date",
          "S.No",
          "Type",
          "Item Dimensions",
          "Weight",
          "Coating",
          "Specifications",
          "Item Form",
          "LOT",
          "Quality",
          "Balance",
          "Sale Date",
          "Sale Dimensions",
          "Sold To",
          "Quantity Sold",
          "Form",
        ];
        const csvContent = [
          headers.join(","),
          ...combinedData.map((row) =>
            row.map((field) => `"${field}"`).join(",")
          ),
        ].join("\n"); // Add BOM for Excel UTF-8 compatibility
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `selected-inventory-with-sales-${format(
          new Date(),
          "yyyy-MM-dd"
        )}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error exporting combined data:", error);
        alert("Error exporting combined data. Please try again.");
      }
    }
  };
  const handleBulkEdit = () => {
    if (selectedItems.size === 0) return;
    setShowBulkEditModal(true);
  };
  const handleBulkSendToDC = async () => {
    if (selectedItems.size === 0) return;

    const selectedData = filteredInventory.filter((item) =>
      selectedItems.has(item.id)
    );

    // Filter items that are already at DC
    const alreadyAtDC = selectedData.filter((item) => item.dc_status === 1);
    if (alreadyAtDC.length > 0) {
      alert(
        `${alreadyAtDC.length} items are already at DC and will be skipped.`
      );
    }

    // Filter out items that are fully sold
    const fullySoldItems = selectedData.filter((item) => item.balance <= 0);
    if (fullySoldItems.length > 0) {
      alert(
        `Cannot send ${fullySoldItems.length} fully sold items to DC. Only items with remaining balance can be sent to DC.`
      );
      return;
    }

    // Filter out items that are partially sold (balance is not equal to weight)
    const partiallySoldItems = selectedData.filter(
      (item) => item.balance > 0 && item.balance !== item.weight
    );
    if (partiallySoldItems.length > 0) {
      alert(
        `Cannot send ${partiallySoldItems.length} partially sold items to DC. Only items with full balance (balance = weight) can be sent to DC.`
      );
      return;
    }

    // Get eligible items that can be sent to DC
    const eligibleItems = selectedData.filter(
      (item) =>
        item.dc_status === 0 && item.balance > 0 && item.balance === item.weight
    );

    if (eligibleItems.length === 0) {
      alert(
        "No eligible items to send to DC. Items must not be at DC already, must not be sold, and must have balance equal to weight."
      );
      return;
    }
    showConfirmation(
      "Send Items to DC",
      `Are you sure you want to send ${eligibleItems.length} eligible items to DC?`,
      async () => {
        try {
          const eligibleIds = eligibleItems.map((item) => item.id);
          await bulkSendItemsToDC(eligibleIds);
          setSelectedItems(new Set());
          setIsAllSelected(false);
          await loadInventory();
        } catch (error) {
          console.error("Error bulk sending items to DC:", error);
          alert(error.message);
        }
      }
    );
  };

  const handleBulkReturnFromDC = async () => {
    if (selectedItems.size === 0) return;

    const selectedData = filteredInventory.filter((item) =>
      selectedItems.has(item.id)
    );
    const dcItems = selectedData.filter((item) => item.dc_status === 1);

    if (dcItems.length === 0) {
      alert(
        "No DC items selected. Only items currently at DC can be returned to warehouse."
      );
      return;
    }
    showConfirmation(
      "Return Items from DC",
      `Are you sure you want to return ${dcItems.length} items from DC to warehouse?`,
      async () => {
        try {
          const dcIds = dcItems.map((item) => item.id);
          await bulkReturnItemsFromDC(dcIds);
          setSelectedItems(new Set());
          setIsAllSelected(false);
          await loadInventory();
        } catch (error) {
          console.error("Error bulk returning items from DC:", error);
          alert(error.message);
        }
      }
    );
  };
  const handleBulkEditSave = async () => {
    if (selectedItems.size === 0) return;

    try {
      // Filter out items that are in DC
      const selectedItemsArray = Array.from(selectedItems);
      const dcItems = filteredInventory.filter(
        (item) => selectedItemsArray.includes(item.id) && item.dc_status === 1
      );

      if (dcItems.length > 0) {
        alert(
          `${dcItems.length} items are in DC and cannot be edited. These items will be skipped.`
        );
      }
      // Handle other field updates for non-DC items
      const nonCompletionUpdatePromises = Array.from(selectedItems).map(
        (id) => {
          const item = filteredInventory.find((item) => item.id === id);
          // Skip if item is in DC
          if (item.dc_status === 1) {
            return Promise.resolve();
          }

          // Only include database fields, excluding calculated fields like balance and timestamp fields
          const { balance, created_at, updated_at, ...itemData } = item;
          const updates = {};
          let hasUpdates = false;
          if (bulkEditData.updateEntryDate && bulkEditData.entry_date) {
            updates.entry_date = bulkEditData.entry_date;
            hasUpdates = true;
          }
          if (bulkEditData.updateType && bulkEditData.type) {
            updates.type = bulkEditData.type;
            hasUpdates = true;
          }
          if (bulkEditData.updateQuality && bulkEditData.quality) {
            updates.quality = bulkEditData.quality;
            hasUpdates = true;
          }
          if (bulkEditData.updateLot) {
            updates.lot = bulkEditData.lot;
            hasUpdates = true;
          }
          if (bulkEditData.updateThickness && bulkEditData.thickness) {
            updates.thickness = bulkEditData.thickness;
            hasUpdates = true;
          }
          if (bulkEditData.updateWidth && bulkEditData.width) {
            updates.width = bulkEditData.width;
            hasUpdates = true;
          }
          if (bulkEditData.updateWeight && bulkEditData.weight) {
            updates.weight = bulkEditData.weight;
            hasUpdates = true;
          }
          if (bulkEditData.updateCoating) {
            updates.coating = bulkEditData.coating;
            hasUpdates = true;
          }
          if (bulkEditData.updateSpecifications) {
            updates.specifications = bulkEditData.specifications;
            hasUpdates = true;
          }
          if (bulkEditData.updateForm) {
            updates.form = bulkEditData.form;
            hasUpdates = true;
          }

          // Only return update promise if there are actual non-completion updates
          return hasUpdates
            ? updateInventoryItem(id, updates)
            : Promise.resolve();
        }
      );
      await Promise.all(nonCompletionUpdatePromises);

      setSelectedItems(new Set());
      setIsAllSelected(false);
      setShowBulkEditModal(false);
      setBulkEditData({
        entry_date: new Date().toISOString().split("T")[0],
        type: "",
        quality: "",
        lot: "",
        thickness: "",
        width: "",
        weight: "",
        coating: "",
        specifications: "",
        form: "",
        updateEntryDate: false,
        updateType: false,
        updateQuality: false,
        updateLot: false,
        updateThickness: false,
        updateWidth: false,
        updateWeight: false,
        updateCoating: false,
        updateSpecifications: false,
        updateForm: false,
        updateDCStatus: false,
      });
      await loadInventory();
    } catch (error) {
      console.error("Error bulk editing items:", error);
    }
  };
  const handleBulkEditCancel = () => {
    setShowBulkEditModal(false);
    setBulkEditData({
      entry_date: new Date().toISOString().split("T")[0],
      type: "",
      quality: "",
      lot: "",
      thickness: "",
      width: "",
      weight: "",
      coating: "",
      specifications: "",
      form: "",
      dc_status: 0,
      updateEntryDate: false,
      updateType: false,
      updateQuality: false,
      updateLot: false,
      updateThickness: false,
      updateWidth: false,
      updateWeight: false,
      updateCoating: false,
      updateSpecifications: false,
      updateForm: false,
      updateDCStatus: false,
    });
  };

  // Validation functions for save button states
  const validateDimensions = (dimensions) => {
    if (!dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
      return false;
    }
    return dimensions.every(
      (dim) =>
        dim.thickness &&
        dim.thickness.toString().trim() !== "" &&
        dim.width &&
        dim.width.toString().trim() !== "" &&
        parseFloat(dim.thickness) > 0 &&
        parseFloat(dim.width) > 0
    );
  };

  const isNewItemSaveDisabled = () => {
    return (
      !newItem.sno ||
      !newItem.type ||
      !validateDimensions(newItem.dimensions) ||
      !newItem.weight ||
      !newItem.lot ||
      !newItem.quality
    );
  };

  const isEditItemSaveDisabled = () => {
    if (!editingItem) return true;
    return (
      !editingItem.sno ||
      !editingItem.type ||
      !validateDimensions(editingItem.dimensions) ||
      !editingItem.weight ||
      !editingItem.lot ||
      !editingItem.quality
    );
  };

  // Functions to handle multiple dimensions
  const addDimension = (isEdit = false) => {
    if (isEdit && editingItem) {
      setEditingItem((prev) => ({
        ...prev,
        dimensions: [...(prev.dimensions || []), { thickness: "", width: "" }],
      }));
    } else {
      setNewItem((prev) => ({
        ...prev,
        dimensions: [...prev.dimensions, { thickness: "", width: "" }],
      }));
    }
  };

  const removeDimension = (index, isEdit = false) => {
    if (isEdit && editingItem) {
      if (editingItem.dimensions.length > 1) {
        setEditingItem((prev) => ({
          ...prev,
          dimensions: prev.dimensions.filter((_, i) => i !== index),
        }));
      }
    } else {
      if (newItem.dimensions.length > 1) {
        setNewItem((prev) => ({
          ...prev,
          dimensions: prev.dimensions.filter((_, i) => i !== index),
        }));
      }
    }
  };

  const updateDimension = (index, field, value, isEdit = false) => {
    if (isEdit && editingItem) {
      setEditingItem((prev) => ({
        ...prev,
        dimensions: prev.dimensions.map((dim, i) =>
          i === index ? { ...dim, [field]: value } : dim
        ),
      }));
    } else {
      setNewItem((prev) => ({
        ...prev,
        dimensions: prev.dimensions.map((dim, i) =>
          i === index ? { ...dim, [field]: value } : dim
        ),
      }));
    }
  };
  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    applyFilters();
    // Reset selections when filters change
    setSelectedItems(new Set());
    setIsAllSelected(false);
  }, [inventory, filters]);
  const exportToCSV = useCallback(() => {
    const headers = [
      "Entry Date",
      "S.No",
      "Type",
      "Dimensions",
      "Weight",
      "Coating",
      "Specifications",
      "Item Form",
      "LOT",
      "Quality",
      "Balance",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredInventory.map((item) =>
        [
          `"${format(new Date(item.entry_date), "dd/MM/yyyy")}"`,
          `"${item.sno}"`,
          `"${item.type}"`,
          // Format dimensions as "thick1×width1; thick2×width2"
          `"${
            item.dimensions && item.dimensions.length > 0
              ? item.dimensions
                  .map(
                    (dim) =>
                      `${formatThickness(dim.thickness)}×${formatWidth(
                        dim.width
                      )}`
                  )
                  .join("; ")
              : `${formatThickness(item.thickness) || ""}×${
                  formatWidth(item.width) || ""
                }`
          }"`, // Backward compatibility
          `"${item.weight}"`,
          `"'${item.coating || ""}"`,
          `"${item.specifications || ""}"`,
          `"${item.form || ""}"`,
          `"${item.lot}"`,
          `"${item.quality}"`,
          `"${item.balance || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredInventory]);

  // Comprehensive export function that handles different export types for all filtered items
  const handleFilteredExport = useCallback(
    async (exportType = "inventory") => {
      if (filteredInventory.length === 0) {
        alert("No data to export");
        return;
      }
      if (exportType === "inventory") {
        // Export inventory data only
        const headers = [
          "Entry Date",
          "S.No",
          "Type",
          "Dimensions",
          "Weight",
          "Coating",
          "Specifications",
          "Item Form",
          "LOT",
          "Quality",
          "Balance",
        ];
        const csvContent = [
          headers.join(","),
          ...filteredInventory.map((item) =>
            [
              `"${format(new Date(item.entry_date), "dd/MM/yyyy")}"`,
              `"${item.sno}"`,
              `"${item.type}"`,
              // Format dimensions as "thick1×width1; thick2×width2"
              `"${
                item.dimensions && item.dimensions.length > 0
                  ? item.dimensions
                      .map(
                        (dim) =>
                          `${formatThickness(dim.thickness)}×${formatWidth(
                            dim.width
                          )}`
                      )
                      .join("; ")
                  : `${formatThickness(item.thickness) || ""}×${
                      formatWidth(item.width) || ""
                    }`
              }"`, // Backward compatibility
              `"${item.weight}"`,
              `"'${item.coating || ""}"`,
              `"${item.specifications || ""}"`,
              `"${item.form || ""}"`,
              `"${item.lot}"`,
              `"${item.quality}"`,
              `"${item.balance || ""}"`,
            ].join(",")
          ),
        ].join("\n");

        // Add BOM for Excel UTF-8 compatibility
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `filtered-inventory-${format(
          new Date(),
          "yyyy-MM-dd"
        )}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (exportType === "sales") {
        // Export sales data only for filtered items
        try {
          const allSalesData = [];

          for (const item of filteredInventory) {
            const salesForItem = await getSalesForItem(item.id);
            salesForItem.forEach((sale) => {
              // Parse dimensions
              let dimensionsText = "—";
              if (sale.dimensions) {
                try {
                  const parsed = JSON.parse(sale.dimensions);
                  dimensionsText = Array.isArray(parsed)
                    ? parsed.join(" ")
                    : sale.dimensions;
                } catch {
                  dimensionsText = sale.dimensions;
                }
              }
              allSalesData.push([
                format(new Date(sale.sale_date), "dd/MM/yyyy"),
                item.sno,
                item.type,
                dimensionsText,
                sale.sold_to,
                sale.quantity_sold,
                sale.form,
                `'${item.coating || ""}`,
                item.specifications || "",
                item.form || "",
                item.lot,
                item.quality || "",
              ]);
            });
          }

          if (allSalesData.length === 0) {
            alert("No sales data found for filtered items");
            return;
          }
          const headers = [
            "Sale Date",
            "Entry Number",
            "Item Type",
            "Dimensions",
            "Sold To",
            "Quantity Sold",
            "Form",
            "Item Coating",
            "Item Specifications",
            "Item Form",
            "Item LOT",
            "Item Quality",
          ];
          const csvContent = [
            headers.join(","),
            ...allSalesData.map((row) =>
              row.map((field) => `"${field}"`).join(",")
            ),
          ].join("\n"); // Add BOM for Excel UTF-8 compatibility
          const BOM = "\uFEFF";
          const blob = new Blob([BOM + csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `filtered-sales-${format(new Date(), "yyyy-MM-dd")}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Error exporting sales data:", error);
          alert("Error exporting sales data. Please try again.");
        }
      } else if (exportType === "inventory-with-sales") {
        // Export combined inventory and sales data for filtered items
        try {
          const combinedData = [];

          for (const item of filteredInventory) {
            const salesForItem = await getSalesForItem(item.id);

            if (salesForItem.length === 0) {
              // Item with no sales
              combinedData.push([
                item.entry_date,
                item.sno,
                item.type,
                item.dimensions && item.dimensions.length > 0
                  ? item.dimensions
                      .map(
                        (dim) =>
                          `${formatThickness(dim.thickness)}×${formatWidth(
                            dim.width
                          )}`
                      )
                      .join("; ")
                  : `${formatThickness(item.thickness) || ""}×${
                      formatWidth(item.width) || ""
                    }`,
                item.weight,
                `'${item.coating || ""}`,
                item.specifications || "",
                item.form || "",
                item.lot,
                item.quality || "",
                item.balance || "",
                "—", // Sale Date
                "—", // Sale Dimensions
                "—", // Sold To
                "—", // Quantity Sold
                "—", // Form
              ]);
            } else {
              // Item with sales
              salesForItem.forEach((sale) => {
                // Parse sale dimensions
                let saleDimensionsText = "—";
                if (sale.dimensions) {
                  try {
                    const parsed = JSON.parse(sale.dimensions);
                    saleDimensionsText = Array.isArray(parsed)
                      ? parsed.join(" ")
                      : sale.dimensions;
                  } catch {
                    saleDimensionsText = sale.dimensions;
                  }
                }

                combinedData.push([
                  item.entry_date,
                  item.sno,
                  item.type,
                  item.dimensions && item.dimensions.length > 0
                    ? item.dimensions
                        .map(
                          (dim) =>
                            `${formatThickness(dim.thickness)}×${formatWidth(
                              dim.width
                            )}`
                        )
                        .join("; ")
                    : `${formatThickness(item.thickness) || ""}×${
                        formatWidth(item.width) || ""
                      }`,
                  item.weight,
                  `'${item.coating || ""}`,
                  item.specifications || "",
                  item.form || "",
                  item.lot,
                  item.quality || "",
                  item.balance || "",
                  format(new Date(sale.sale_date), "dd/MM/yyyy"),
                  saleDimensionsText,
                  sale.sold_to,
                  sale.quantity_sold,
                  sale.form,
                ]);
              });
            }
          }
          const headers = [
            "Entry Date",
            "S.No",
            "Type",
            "Item Dimensions",
            "Weight",
            "Coating",
            "Specifications",
            "Item Form",
            "LOT",
            "Quality",
            "Balance",
            "Sale Date",
            "Sale Dimensions",
            "Sold To",
            "Quantity Sold",
            "Form",
          ];
          const csvContent = [
            headers.join(","),
            ...combinedData.map((row) =>
              row.map((field) => `"${field}"`).join(",")
            ),
          ].join("\n"); // Add BOM for Excel UTF-8 compatibility
          const BOM = "\uFEFF";
          const blob = new Blob([BOM + csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `filtered-inventory-with-sales-${format(
            new Date(),
            "yyyy-MM-dd"
          )}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Error exporting combined data:", error);
          alert("Error exporting combined data. Please try again.");
        }
      }
    },
    [filteredInventory]
  );
  // Pass export function to parent component
  useEffect(() => {
    if (onSetExportFunction) {
      onSetExportFunction(handleFilteredExport);
    }
  }, [handleFilteredExport, onSetExportFunction]);

  // Pass import function to parent component
  useEffect(() => {
    if (onSetImportFunction) {
      onSetImportFunction(() => setShowImportDialog(true));
    }
  }, [onSetImportFunction]);
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+N for new entry (only when not in edit mode and no dialogs open)
      if (
        event.ctrlKey &&
        event.key === "n" &&
        !editingItem &&
        !showSalesDialog &&
        !showBulkEditModal
      ) {
        event.preventDefault();
        if (!showAddRow) {
          handleShowAddRow();
          // Focus on the first input after a short delay
          setTimeout(() => {
            const firstInput = document.querySelector('[placeholder="S.No"]');
            if (firstInput) {
              firstInput.focus();
            }
          }, 100);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingItem, showSalesDialog, showBulkEditModal, showAddRow]);

  // CSV Import handlers
  const handleFileSelect = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "CSV Files",
            extensions: ["csv"],
          },
        ],
      });
      if (!selected) return;

      const content = await readTextFile(selected);

      setImportFile({
        name: selected.split("\\").pop().split("/").pop(),
        content: content,
      });
      setImportResults(null);
    } catch (error) {
      console.error("Error selecting file:", error);
      alert("Error selecting file. Please try again.");
    }
  };
  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      let result;

      // Call appropriate import function based on import type
      switch (importType) {
        case "inventory":
          result = await importInventoryFromCSV(importFile.content);
          break;
        case "sales":
          result = await importSalesFromCSV(importFile.content);
          break;
        case "combined":
          result = await importCombinedFromCSV(importFile.content);
          break;
        default:
          throw new Error("Invalid import type");
      }

      setImportResults(result);

      if (result.success > 0) {
        await loadInventory(); // Refresh the inventory data
      }
    } catch (error) {
      console.error("Error importing CSV:", error);
      setImportResults({
        success: 0,
        errors: [`Import failed: ${error.message || "Unknown error"}`],
      });
    } finally {
      setIsImporting(false);
    }
  };
  const handleImportReset = () => {
    setImportFile(null);
    setImportResults(null);
    setImportType("inventory");
    setShowImportDialog(false);
  };

  return (
    <TooltipProvider>
      <div className="h-screen bg-background text-foreground flex flex-col">
        {/* Main Content Area - Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 border border-border bg-background flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center bg-background">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading inventory...</p>
                </div>
              </div>
            ) : (
              <>
                {" "}
                {/* Group Actions Bar */}
                {selectedItems.size > 0 && (
                  <div className="border-b border-border bg-muted/50 px-3 lg:px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {selectedItems.size} of {filteredInventory.length}{" "}
                          row(s) selected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItems(new Set());
                            setIsAllSelected(false);
                          }}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground w-fit"
                        >
                          Clear selection
                        </Button>
                      </div>{" "}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkEdit}
                          className="h-8 px-2 sm:px-3 text-xs sm:text-sm flex-1 sm:flex-initial"
                        >
                          <Edit2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">
                            Edit Selected
                          </span>
                          <span className="sm:hidden">Edit</span>{" "}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkSendToDC}
                          className={`h-8 px-2 sm:px-3 text-xs sm:text-sm flex-1 sm:flex-initial ${
                            hasEligibleItemsForDC()
                              ? "text-blue-600 border-blue-300 hover:bg-blue-50"
                              : "text-gray-400 border-gray-300 cursor-not-allowed"
                          }`}
                          disabled={!hasEligibleItemsForDC()}
                          title={
                            hasEligibleItemsForDC()
                              ? "Send eligible items to DC"
                              : "No eligible items to send to DC (items must not be at DC already, must not be sold, and must have balance equal to weight)"
                          }
                        >
                          <Truck className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">Send to DC</span>
                          <span className="sm:hidden">DC</span>
                        </Button>{" "}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkReturnFromDC}
                          className={`h-8 px-2 sm:px-3 text-xs sm:text-sm flex-1 sm:flex-initial ${
                            hasEligibleItemsForDCReturn()
                              ? "text-purple-600 border-purple-300 hover:bg-purple-50"
                              : "text-gray-400 border-gray-300 cursor-not-allowed"
                          }`}
                          disabled={!hasEligibleItemsForDCReturn()}
                          title={
                            hasEligibleItemsForDCReturn()
                              ? "Return selected items from DC"
                              : "No items at DC selected. Only items currently at DC can be returned."
                          }
                        >
                          <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">
                            Return from DC
                          </span>
                          <span className="sm:hidden">Return</span>
                        </Button>{" "}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 sm:px-3 text-xs sm:text-sm flex-1 sm:flex-initial"
                            >
                              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="hidden sm:inline">
                                Export Selected
                              </span>
                              <span className="sm:hidden">Export</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleBulkExport("inventory")}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Export Inventory
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleBulkExport("sales")}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Export Sales
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleBulkExport("inventory-with-sales")
                              }
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Export Inventory with Sales
                            </DropdownMenuItem>{" "}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkDelete}
                          className="h-8 px-2 sm:px-3 text-destructive border-destructive/50 hover:bg-destructive/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">
                            Delete Selected
                          </span>
                          <span className="sm:hidden">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}{" "}
                {/* Status Summary Bar */}
                <div className="border-b border-border bg-background px-3 lg:px-4 py-3">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-0">
                    <div className="flex flex-wrap items-center gap-3 lg:gap-6">
                      <div className="text-xs lg:text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {filteredInventory.length}
                        </span>{" "}
                        total items
                      </div>{" "}
                      <div className="text-xs lg:text-sm text-muted-foreground">
                        <span className="font-medium text-green-600">
                          {
                            filteredInventory.filter(
                              (item) => item.balance <= 0
                            ).length
                          }
                        </span>{" "}
                        sold
                      </div>
                      <div className="text-xs lg:text-sm text-muted-foreground">
                        <span className="font-medium text-blue-600">
                          {
                            filteredInventory.filter((item) => item.balance > 0)
                              .length
                          }
                        </span>{" "}
                        available
                      </div>{" "}
                      {(() => {
                        const activeFilters = [
                          filters.startDate,
                          filters.endDate,
                          filters.type?.length > 0,
                          filters.quality?.length > 0,
                          filters.lot,
                          filters.coating,
                          filters.specifications,
                          filters.form,
                          filters.minThickness,
                          filters.maxThickness,
                          filters.minWidth,
                          filters.maxWidth,
                          filters.minWeight,
                          filters.maxWeight,
                          filters.showSoldOnly,
                          filters.showUnsoldOnly,
                          filters.showDCOnly,
                          filters.showNonDCOnly,
                        ].filter(Boolean).length;
                        return activeFilters > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              {" "}
                              <Badge
                                variant="secondary"
                                onClick={onClearFilters}
                                className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all duration-200 shadow-sm px-2 py-1 cursor-pointer flex items-center text-xs"
                              >
                                <Filter className="h-3 w-3 mr-1" />
                                <span className="hidden lg:inline">
                                  {activeFilters} filter
                                  {activeFilters !== 1 ? "s" : ""} active
                                </span>
                                <span className="lg:hidden">
                                  {activeFilters} filter
                                  {activeFilters !== 1 ? "s" : ""}
                                </span>
                                <X className="h-3 w-3 ml-1" />
                                <span className="sr-only">Clear filters</span>
                              </Badge>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>{" "}
                    {selectedItems.size === 0 && (
                      <div className="text-xs lg:text-sm text-muted-foreground">
                        <span className="hidden lg:inline">
                          Select items to perform bulk actions
                        </span>
                        <span className="lg:hidden">
                          Select items for bulk actions
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-background">
                  <div className="overflow-hidden border">
                    <Table>
                      <TableHeader className="bg-muted sticky top-0 z-10 border-b border-border">
                        <TableRow className="hover:bg-muted/80 border-border">
                          {" "}
                          <TableHead className="w-12 px-1">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={
                                  isAllSelected ||
                                  (selectedItems.size > 0 &&
                                    selectedItems.size ===
                                      sortedInventory.length)
                                }
                                onCheckedChange={handleSelectAll}
                                aria-label="Select all"
                              />
                            </div>
                          </TableHead>{" "}
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            {selectedItems.size === 0 &&
                            !showAddRow &&
                            !editingItem ? (
                              <button
                                className="flex items-center gap-2 hover:text-primary transition-colors"
                                onClick={() => handleSort("entry_date")}
                              >
                                Entry Date
                                {getSortIcon("entry_date")}
                              </button>
                            ) : (
                              <span>Entry Date</span>
                            )}
                          </TableHead>
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            {selectedItems.size === 0 &&
                            !showAddRow &&
                            !editingItem ? (
                              <button
                                className="flex items-center gap-2 hover:text-primary transition-colors"
                                onClick={() => handleSort("sno")}
                              >
                                S.No
                                {getSortIcon("sno")}
                              </button>
                            ) : (
                              <span>S.No</span>
                            )}
                          </TableHead>{" "}
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            Type
                          </TableHead>
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            {selectedItems.size === 0 &&
                            !showAddRow &&
                            !editingItem ? (
                              <button
                                className="flex items-center gap-2 hover:text-primary transition-colors"
                                onClick={() => handleSort("thickness")}
                              >
                                Dimensions
                                {getSortIcon("thickness")}
                              </button>
                            ) : (
                              <span>Dimensions</span>
                            )}
                          </TableHead>
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            {selectedItems.size === 0 &&
                            !showAddRow &&
                            !editingItem ? (
                              <button
                                className="flex items-center gap-2 hover:text-primary transition-colors"
                                onClick={() => handleSort("weight")}
                              >
                                Weight
                                {getSortIcon("weight")}
                              </button>
                            ) : (
                              <span>Weight</span>
                            )}
                          </TableHead>{" "}
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            Coating
                          </TableHead>
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            Specifications
                          </TableHead>
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            Form
                          </TableHead>
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            LOT
                          </TableHead>
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            Quality
                          </TableHead>{" "}
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide min-w-[150px]">
                            Balance
                          </TableHead>
                          <TableHead className="text-foreground font-semibold h-12 px-1 tracking-wide">
                            Status
                          </TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="bg-background">
                        {/* Add Row */}
                        {showAddRow && (
                          <TableRow className="border-border bg-muted hover:bg-muted/80 transition-all duration-200">
                            <TableCell className="h-14 px-1 w-12">
                              {/* Empty checkbox cell for add row */}
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Input
                                type="date"
                                value={newItem.entry_date}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    entry_date: e.target.value,
                                  }))
                                }
                                className="h-9 bg-background border-border text-foreground hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200"
                              />{" "}
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Input
                                value={newItem.sno}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    sno: e.target.value,
                                  }))
                                }
                                placeholder="S.No"
                                className="h-9 bg-background border-border text-foreground hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200"
                              />
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Select
                                value={newItem.type}
                                onValueChange={(value) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    type: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-9 bg-background border-border text-foreground hover:bg-muted focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-200">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border shadow-xl">
                                  {typeOptions.map((type) => (
                                    <SelectItem
                                      key={type}
                                      value={type}
                                      className="text-foreground hover:bg-muted focus:bg-muted cursor-pointer"
                                    >
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>{" "}
                            </TableCell>{" "}
                            <TableCell className="h-14 px-1">
                              <div className="space-y-2">
                                {newItem.dimensions.map((dimension, index) => (
                                  <div
                                    key={index}
                                    className="flex gap-2 items-center"
                                  >
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={dimension.thickness}
                                      onChange={(e) =>
                                        updateDimension(
                                          index,
                                          "thickness",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Thick"
                                      className="h-9 w-20 bg-background border-border text-foreground text-center hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      ×
                                    </span>{" "}
                                    <Input
                                      type="number"
                                      step="1"
                                      value={dimension.width}
                                      onChange={(e) =>
                                        updateDimension(
                                          index,
                                          "width",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Width"
                                      className="h-9 w-20 bg-background border-border text-foreground text-center hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200"
                                    />{" "}
                                    {index === 0 && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addDimension()}
                                        className="h-9 w-9 p-0 text-primary border-primary/50 hover:bg-primary/10"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {newItem.dimensions.length > 1 &&
                                      index > 0 && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => removeDimension(index)}
                                          className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={newItem.weight}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    weight: e.target.value,
                                  }))
                                }
                                placeholder="Weight"
                                className="h-9 bg-background border-border text-foreground text-center hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200"
                              />
                            </TableCell>{" "}
                            <TableCell className="h-14 px-1">
                              <Input
                                value={newItem.coating}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    coating: e.target.value,
                                  }))
                                }
                                placeholder="Coating"
                                className="h-9 bg-background border-border text-foreground hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200"
                              />
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Input
                                value={newItem.specifications}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    specifications: e.target.value,
                                  }))
                                }
                                placeholder="Specifications"
                                className="h-9 bg-background border-border text-foreground hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200"
                              />
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Select
                                value={newItem.form}
                                onValueChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    form: e,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-9 bg-background border-border text-foreground hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200">
                                  <SelectValue placeholder="Form" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border max-h-60 overflow-y-auto">
                                  {formOptions.map((option) => (
                                    <SelectItem
                                      key={option}
                                      value={option}
                                      className="text-foreground hover:bg-muted/80 focus:bg-muted/80"
                                    >
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Input
                                value={newItem.lot}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    lot: e.target.value,
                                  }))
                                }
                                placeholder="LOT"
                                className="h-9 bg-background border-border text-foreground hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-all duration-200"
                              />{" "}
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Select
                                value={newItem.quality}
                                onValueChange={(value) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    quality: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-9 bg-background border-border text-foreground hover:bg-muted focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-200">
                                  <SelectValue placeholder="Quality" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-border shadow-xl">
                                  {qualityOptions.map((quality) => (
                                    <SelectItem
                                      key={quality}
                                      value={quality}
                                      className="text-foreground hover:bg-muted focus:bg-muted cursor-pointer"
                                    >
                                      {quality}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>{" "}
                            </TableCell>{" "}
                            <TableCell className="h-14 px-1 min-w-[150px]">
                              <div className="text-sm text-muted-foreground flex items-center h-9">
                                New Entry
                              </div>
                            </TableCell>
                            <TableCell className="h-14 px-1">
                              <Badge
                                variant="secondary"
                                className="bg-muted text-muted-foreground hover:bg-muted/80 transition-all duration-200 shadow-sm"
                              >
                                New Entry
                              </Badge>
                            </TableCell>
                            <TableCell className="h-14 px-1 w-12">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleAddItem}
                                  disabled={isNewItemSaveDisabled()}
                                  className="h-8 w-8 p-0 bg-primary/90 hover:bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                  title="Save"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelAdd}
                                  className="h-8 w-8 p-0 border-border text-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                                  title="Cancel"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}{" "}
                        {/* Existing Inventory Items */}
                        {sortedInventory.map((item) => (
                          <TableRow
                            key={item.id}
                            className={cn(
                              "border-border hover:bg-muted/50 transition-all duration-200 group relative",
                              selectedItems.has(item.id) &&
                                "bg-primary/5 hover:bg-primary/10 border-primary/20",
                              item.balance <= 0
                                ? "bg-green-50 hover:bg-green-100 border-green-200"
                                : "hover:shadow-sm"
                            )}
                            data-state={
                              selectedItems.has(item.id)
                                ? "selected"
                                : undefined
                            }
                            onDoubleClick={() => handleRowDoubleClick(item)} // Handle double-click
                          >
                            {editingItem && editingItem.id === item.id ? ( // Edit mode
                              <>
                                {" "}
                                <TableCell className="h-14 px-1 w-12">
                                  <div className="flex items-center justify-center">
                                    <Checkbox
                                      checked={selectedItems.has(item.id)}
                                      onCheckedChange={(checked) =>
                                        handleSelectItem(item.id, checked)
                                      }
                                      aria-label="Select row"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  <Input
                                    type="date"
                                    value={editingItem.entry_date}
                                    onChange={(e) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        entry_date: e.target.value,
                                      }))
                                    }
                                    className="h-9 bg-background border-border text-foreground"
                                  />{" "}
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  <Input
                                    value={editingItem.sno}
                                    onChange={(e) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        sno: e.target.value,
                                      }))
                                    }
                                    className="h-9 bg-background border-border text-foreground"
                                  />
                                </TableCell>
                                <TableCell className="h-14 px-1">
                                  <Select
                                    value={editingItem.type}
                                    onValueChange={(value) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        type: value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-9 bg-background border-border text-foreground">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border">
                                      {typeOptions.map((type) => (
                                        <SelectItem
                                          key={type}
                                          value={type}
                                          className="text-foreground"
                                        >
                                          {type}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>{" "}
                                </TableCell>{" "}
                                <TableCell className="text-foreground h-14 px-1">
                                  <div className="space-y-2">
                                    {editingItem.dimensions &&
                                      editingItem.dimensions.map(
                                        (dimension, index) => (
                                          <div
                                            key={index}
                                            className="flex gap-2 items-center"
                                          >
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={dimension.thickness}
                                              onChange={(e) =>
                                                updateDimension(
                                                  index,
                                                  "thickness",
                                                  e.target.value,
                                                  true
                                                )
                                              }
                                              className="h-9 w-20 bg-background border-border text-foreground text-center"
                                            />
                                            <span className="text-xs text-muted-foreground">
                                              ×
                                            </span>{" "}
                                            <Input
                                              type="number"
                                              step="1"
                                              value={dimension.width}
                                              onChange={(e) =>
                                                updateDimension(
                                                  index,
                                                  "width",
                                                  e.target.value,
                                                  true
                                                )
                                              }
                                              className="h-9 w-20 bg-background border-border text-foreground text-center"
                                            />{" "}
                                            {index === 0 && (
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                  addDimension(true)
                                                }
                                                className="h-9 w-9 p-0 text-primary border-primary/50 hover:bg-primary/10"
                                              >
                                                <Plus className="h-4 w-4" />
                                              </Button>
                                            )}
                                            {editingItem.dimensions.length >
                                              1 &&
                                              index > 0 && (
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    removeDimension(index, true)
                                                  }
                                                  className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10"
                                                >
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              )}
                                          </div>
                                        )
                                      )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editingItem.weight}
                                    onChange={(e) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        weight: e.target.value,
                                      }))
                                    }
                                    className="h-9 bg-background border-border text-foreground text-center"
                                  />
                                </TableCell>{" "}
                                <TableCell className="text-foreground h-14 px-1">
                                  <Input
                                    value={editingItem.coating}
                                    onChange={(e) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        coating: e.target.value,
                                      }))
                                    }
                                    placeholder="Coating"
                                    className="h-9 bg-background border-border text-foreground"
                                  />
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  <Input
                                    value={editingItem.specifications}
                                    onChange={(e) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        specifications: e.target.value,
                                      }))
                                    }
                                    placeholder="Specifications"
                                    className="h-9 bg-background border-border text-foreground"
                                  />
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  <Select
                                    value={editingItem.form}
                                    onValueChange={(value) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        form: value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-9 bg-background border-border text-foreground">
                                      <SelectValue placeholder="Form" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border max-h-60 overflow-y-auto">
                                      {formOptions.map((option) => (
                                        <SelectItem
                                          key={option}
                                          value={option}
                                          className="text-foreground hover:bg-muted/80 focus:bg-muted/80"
                                        >
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  <Input
                                    value={editingItem.lot}
                                    onChange={(e) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        lot: e.target.value,
                                      }))
                                    }
                                    className="h-9 bg-background border-border text-foreground"
                                  />{" "}
                                </TableCell>
                                <TableCell className="h-14 px-1">
                                  <Select
                                    value={editingItem.quality}
                                    onValueChange={(value) =>
                                      setEditingItem((prev) => ({
                                        ...prev,
                                        quality: value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-9 bg-background border-border text-foreground">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border">
                                      {qualityOptions.map((quality) => (
                                        <SelectItem
                                          key={quality}
                                          value={quality}
                                          className="text-foreground"
                                        >
                                          {quality}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>{" "}
                                </TableCell>{" "}
                                <TableCell className="text-foreground h-14 px-1 min-w-[150px]">
                                  <div className="text-sm text-muted-foreground flex items-center h-9">
                                    {editingItem.balance || "—"}
                                  </div>
                                </TableCell>
                                <TableCell className="h-14 px-1">
                                  <Badge
                                    variant={
                                      getStatusBadge(editingItem).variant
                                    }
                                    className={cn(
                                      "transition-all duration-200 shadow-sm",
                                      getStatusBadge(editingItem).className
                                    )}
                                  >
                                    {getStatusBadge(editingItem).text}
                                  </Badge>
                                </TableCell>
                                <TableCell className="h-14 px-1 w-12">
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={handleSaveEdit}
                                      disabled={isEditItemSaveDisabled()}
                                      className="h-8 w-8 p-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                                      title="Save"
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelEdit}
                                      className="h-8 w-8 p-0 border-border text-foreground hover:bg-muted"
                                      title="Cancel"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </> // Display mode
                            ) : (
                              <>
                                {" "}
                                <TableCell className="h-14 px-1 w-12">
                                  <div className="flex items-center justify-center">
                                    <Checkbox
                                      checked={selectedItems.has(item.id)}
                                      onCheckedChange={(checked) =>
                                        handleSelectItem(item.id, checked)
                                      }
                                      aria-label="Select row"
                                    />
                                  </div>
                                </TableCell>{" "}
                                <TableCell className="text-foreground h-14 px-1">
                                  {format(
                                    new Date(item.entry_date),
                                    "dd/MM/yyyy"
                                  )}
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  {item.sno}
                                </TableCell>
                                <TableCell className="h-14 px-1">
                                  {" "}
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "transition-all duration-200 shadow-sm font-medium",
                                      getSteelTypeColors(item.type)
                                    )}
                                  >
                                    {item.type}
                                  </Badge>
                                </TableCell>{" "}
                                <TableCell className="text-foreground h-14 px-1">
                                  <div className="flex flex-col gap-1">
                                    {item.dimensions &&
                                    item.dimensions.length > 0 ? (
                                      item.dimensions.map(
                                        (dimension, index) => (
                                          <div
                                            key={index}
                                            className="flex items-center gap-1"
                                          >
                                            <span className="text-foreground text-sm">
                                              {formatThickness(
                                                dimension.thickness
                                              )}
                                            </span>
                                            <span className="text-muted-foreground text-sm">
                                              ×
                                            </span>
                                            <span className="text-foreground text-sm">
                                              {formatWidth(dimension.width)}
                                            </span>
                                          </div>
                                        )
                                      )
                                    ) : (
                                      // Backward compatibility for single dimension items
                                      <div className="flex items-center gap-1">
                                        <span className="text-foreground">
                                          {formatThickness(item.thickness)}
                                        </span>
                                        <span className="text-muted-foreground mx-1 text-base">
                                          ×
                                        </span>
                                        <span className="text-foreground">
                                          {formatWidth(item.width)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  {item.weight}
                                </TableCell>{" "}
                                <TableCell className="text-foreground h-14 px-1">
                                  {item.coating || (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  {item.specifications || (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-foreground h-14 px-1">
                                  {item.form || (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>{" "}
                                <TableCell className="text-foreground h-14 px-1">
                                  {item.lot}
                                </TableCell>{" "}
                                <TableCell className="h-14 px-1">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "transition-all duration-200 shadow-sm font-medium",
                                      getQualityColors(item.quality)
                                    )}
                                  >
                                    {item.quality}
                                  </Badge>
                                </TableCell>{" "}
                                <TableCell className="text-foreground h-14 px-1 min-w-[150px]">
                                  {item.dc_status === 1 ? (
                                    // If item is in DC, show balance as plain text
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className="text-blue-600"
                                          title="Item is in DC and cannot be sold"
                                        >
                                          {item.balance}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Item is in DC and cannot be sold</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    // Normal sales management button
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() =>
                                            handleOpenSalesDialog(item)
                                          }
                                          className={cn(
                                            "text-left hover:text-primary transition-colors underline decoration-dotted underline-offset-4",
                                            item.balance > 0
                                              ? "text-blue-600"
                                              : "text-green-600"
                                          )}
                                          title="Click to manage sales"
                                        >
                                          {item.balance}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          Click to manage sales or double-click
                                          row to open sales manager
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </TableCell>
                                <TableCell className="h-14 px-1">
                                  <Badge
                                    variant={getStatusBadge(item).variant}
                                    className={cn(
                                      "transition-all duration-200 shadow-sm",
                                      getStatusBadge(item).className
                                    )}
                                  >
                                    {getStatusBadge(item).text}
                                  </Badge>
                                </TableCell>                                <TableCell className="h-14 px-1 w-12">
                                  <div className="flex justify-center">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground border-border hover:bg-muted"
                                          title="Actions"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>{" "}
                                      <DropdownMenuContent
                                        align="end"
                                        className="w-40"
                                      >
                                        {/* DC actions based on current status */}
                                        {(!item.sold_to ||
                                          item.sold_to.trim() === "") && (
                                          <>
                                            {item.dc_status === 1 ? (
                                              // Item is at DC, show Return from DC option
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleReturnFromDC(item)
                                                }
                                                className="cursor-pointer text-purple-600 focus:text-purple-600"
                                              >
                                                <RotateCcw className="h-4 w-4 mr-2" />
                                                Return from DC
                                              </DropdownMenuItem>
                                            ) : // Only show Send to DC option if item is available and balance equals weight
                                            item.balance > 0 &&
                                              item.balance === item.weight ? (
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleSendToDC(item)
                                                }
                                                className="cursor-pointer text-blue-600 focus:text-blue-600"
                                              >
                                                <Truck className="h-4 w-4 mr-2" />
                                                Send to DC
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem
                                                disabled
                                                className="cursor-not-allowed opacity-50"
                                                title="Cannot send to DC: Item must not be already at DC, must not be sold, and must have balance equal to weight"
                                              >
                                                <Truck className="h-4 w-4 mr-2" />
                                                Send to DC (Unavailable)
                                              </DropdownMenuItem>
                                            )}
                                          </>
                                        )}{" "}
                                        {item.dc_status !== 1 && (
                                          <DropdownMenuItem
                                            onClick={() => handleEditItem(item)}
                                            className="cursor-pointer text-primary focus:text-primary"
                                          >
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleDeleteItem(item.id)
                                          }
                                          className="cursor-pointer text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}{" "}
                      </TableBody>
                    </Table>

                    {sortedInventory.length === 0 && (
                      <div className="p-12 text-center">
                        <div className="text-muted-foreground text-sm">
                          <div className="p-4 rounded-full bg-muted w-fit mx-auto mb-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <div className="h-6 w-6 bg-primary/20 rounded"></div>
                            </div>
                          </div>
                          <p className="text-lg font-semibold text-foreground mb-2">
                            No inventory items found
                          </p>
                          <p className="text-muted-foreground">
                            Try adjusting your filters or add some inventory
                            items to get started.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>{" "}
                {/* Action Bar - Attached to bottom of table */}
                <div className="flex-shrink-0 p-3 lg:p-4 border-t border-border bg-background/95 backdrop-blur-sm">
                  {" "}
                  <div className="flex flex-col lg:flex-row gap-2 lg:gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={
                            showAddRow ? handleCancelAdd : handleShowAddRow
                          }
                          className="flex-1 lg:flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 h-10 lg:h-auto text-sm lg:text-base"
                        >
                          <Plus className="w-4 h-4 mr-1 lg:mr-2 flex-shrink-0" />
                          <span className="truncate">
                            {showAddRow ? "Cancel Add Entry" : "Add New Entry"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {showAddRow
                            ? "Cancel adding new entry"
                            : "Add new inventory entry (Ctrl+N)"}
                        </p>
                      </TooltipContent>{" "}
                    </Tooltip>
                    <Button
                      variant="outline"
                      onClick={toggleSidebar}
                      className="lg:px-4 px-3 border-primary/50 text-primary hover:bg-primary/10 shadow-sm hover:shadow-md transition-all duration-200 h-10 lg:h-auto text-sm lg:text-base lg:flex-initial flex-1"
                    >
                      <Filter className="w-4 h-4 mr-1 lg:mr-2 flex-shrink-0" />
                      <span className="font-medium">Filters</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>{" "}
        {/* Bulk Edit Modal */}
        <Dialog open={showBulkEditModal} onOpenChange={setShowBulkEditModal}>
          {" "}
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            {" "}
            <DialogHeader>
              <DialogTitle>
                Edit Selected Items ({selectedItems.size} items)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-type"
                    checked={bulkEditData.updateType}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateType: checked,
                      }))
                    }
                  />
                  <label htmlFor="update-type" className="text-sm font-medium">
                    Update Type
                  </label>
                  <Select
                    value={bulkEditData.type}
                    onValueChange={(value) =>
                      setBulkEditData((prev) => ({ ...prev, type: value }))
                    }
                    disabled={!bulkEditData.updateType}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-quality"
                    checked={bulkEditData.updateQuality}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateQuality: checked,
                      }))
                    }
                  />
                  <label
                    htmlFor="update-quality"
                    className="text-sm font-medium"
                  >
                    Update Quality
                  </label>
                  <Select
                    value={bulkEditData.quality}
                    onValueChange={(value) =>
                      setBulkEditData((prev) => ({ ...prev, quality: value }))
                    }
                    disabled={!bulkEditData.updateQuality}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Quality" />
                    </SelectTrigger>
                    <SelectContent>
                      {qualityOptions.map((quality) => (
                        <SelectItem key={quality} value={quality}>
                          {quality}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>{" "}
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-entry-date"
                    checked={bulkEditData.updateEntryDate}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateEntryDate: checked,
                      }))
                    }
                  />
                  <label
                    htmlFor="update-entry-date"
                    className="text-sm font-medium"
                  >
                    Update Entry Date
                  </label>
                  <Input
                    type="date"
                    value={bulkEditData.entry_date}
                    onChange={(e) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        entry_date: e.target.value,
                      }))
                    }
                    className="flex-1"
                    disabled={!bulkEditData.updateEntryDate}
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-lot"
                    checked={bulkEditData.updateLot}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateLot: checked,
                      }))
                    }
                  />
                  <label htmlFor="update-lot" className="text-sm font-medium">
                    Update LOT
                  </label>
                  <Input
                    value={bulkEditData.lot}
                    onChange={(e) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        lot: e.target.value,
                      }))
                    }
                    placeholder="LOT"
                    className="flex-1"
                    disabled={!bulkEditData.updateLot}
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-thickness"
                    checked={bulkEditData.updateThickness}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateThickness: checked,
                      }))
                    }
                  />
                  <label
                    htmlFor="update-thickness"
                    className="text-sm font-medium"
                  >
                    Update Thickness
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={bulkEditData.thickness}
                    onChange={(e) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        thickness: e.target.value,
                      }))
                    }
                    placeholder="Thickness"
                    className="flex-1"
                    disabled={!bulkEditData.updateThickness}
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-width"
                    checked={bulkEditData.updateWidth}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateWidth: checked,
                      }))
                    }
                  />
                  <label htmlFor="update-width" className="text-sm font-medium">
                    Update Width
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={bulkEditData.width}
                    onChange={(e) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        width: e.target.value,
                      }))
                    }
                    placeholder="Width"
                    className="flex-1"
                    disabled={!bulkEditData.updateWidth}
                  />
                </div>{" "}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-weight"
                    checked={bulkEditData.updateWeight}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateWeight: checked,
                      }))
                    }
                  />
                  <label
                    htmlFor="update-weight"
                    className="text-sm font-medium"
                  >
                    Update Weight
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={bulkEditData.weight}
                    onChange={(e) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        weight: e.target.value,
                      }))
                    }
                    placeholder="Weight"
                    className="flex-1"
                    disabled={!bulkEditData.updateWeight}
                  />
                </div>{" "}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-coating"
                    checked={bulkEditData.updateCoating}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateCoating: checked,
                      }))
                    }
                  />
                  <label
                    htmlFor="update-coating"
                    className="text-sm font-medium"
                  >
                    Update Coating
                  </label>
                  <Input
                    value={bulkEditData.coating}
                    onChange={(e) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        coating: e.target.value,
                      }))
                    }
                    placeholder="Coating"
                    className="flex-1"
                    disabled={!bulkEditData.updateCoating}
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-specifications"
                    checked={bulkEditData.updateSpecifications}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateSpecifications: checked,
                      }))
                    }
                  />
                  <label
                    htmlFor="update-specifications"
                    className="text-sm font-medium"
                  >
                    Update Specifications
                  </label>
                  <Input
                    value={bulkEditData.specifications}
                    onChange={(e) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        specifications: e.target.value,
                      }))
                    }
                    placeholder="Specifications"
                    className="flex-1"
                    disabled={!bulkEditData.updateSpecifications}
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="update-form"
                    checked={bulkEditData.updateForm}
                    onCheckedChange={(checked) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        updateForm: checked,
                      }))
                    }
                  />
                  <label htmlFor="update-form" className="text-sm font-medium">
                    Update Form
                  </label>
                  <Select
                    value={bulkEditData.form}
                    onValueChange={(value) =>
                      setBulkEditData((prev) => ({
                        ...prev,
                        form: value,
                      }))
                    }
                    disabled={!bulkEditData.updateForm}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Form" />
                    </SelectTrigger>
                    <SelectContent>
                      {formOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {" "}
                <Button
                  onClick={handleBulkEditSave}
                  disabled={
                    !bulkEditData.updateEntryDate &&
                    !bulkEditData.updateType &&
                    !bulkEditData.updateQuality &&
                    !bulkEditData.updateLot &&
                    !bulkEditData.updateThickness &&
                    !bulkEditData.updateWidth &&
                    !bulkEditData.updateWeight &&
                    !bulkEditData.updateCoating &&
                    !bulkEditData.updateSpecifications &&
                    !bulkEditData.updateForm
                  }
                  className="flex-1"
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBulkEditCancel}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>{" "}
          </DialogContent>
        </Dialog>{" "}
        {/* Sales Management Dialog */}
        <SalesManagementDialog
          isOpen={showSalesDialog}
          onClose={handleCloseSalesDialog}
          inventoryItem={selectedItemForSales}
          onSaleAdded={handleSaleAdded}
        />{" "}
        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={confirmationDialog.isOpen}
          onClose={closeConfirmation}
          onConfirm={handleConfirmationConfirm}
          title={confirmationDialog.title}
          description={confirmationDialog.description}
          variant={confirmationDialog.variant}
        />{" "}
        {/* CSV Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Import Inventory from CSV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Import Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Import Type</label>
                <Select value={importType} onValueChange={setImportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select import type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inventory">Inventory Only</SelectItem>
                    <SelectItem value="sales">Sales Only</SelectItem>
                    <SelectItem value="combined">
                      Inventory with Sales
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* File Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select CSV File</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={importFile ? importFile.name : ""}
                    placeholder="No file selected"
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFileSelect}
                    disabled={isImporting}
                  >
                    Browse
                  </Button>
                </div>
              </div>
              {/* CSV Format Information */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Expected CSV Format
                </label>
                <div className="bg-muted p-3 rounded-md text-xs">
                  {" "}
                  {importType === "inventory" && (
                    <>
                      <p className="font-mono break-all">
                        Entry
                        Date,S.No,Type,Dimensions,Weight,Coating,Specifications,Item
                        Form,LOT,Quality,Balance
                      </p>
                      <p className="text-muted-foreground mt-2">
                        • Entry Date: dd-MM-yyyy format
                        <br />
                        • Dimensions: "thickness×width" format
                        <br />
                        • Type: E, GA, GA1, 4, 5, 4N, 4G, Scrap, Paint, Others
                        <br />• Quality: Soft, Hard, Semi
                      </p>
                    </>
                  )}
                  {importType === "sales" && (
                    <>
                      <p className="font-mono break-all">
                        Sale Date,Entry Number,Item Type,Dimensions,Sold
                        To,Quantity Sold,Form,Item Coating,Item
                        Specifications,Item Form,Item LOT,Item Quality
                      </p>
                      <p className="text-muted-foreground mt-2">
                        • Sale Date: dd-MM-yyyy format
                        <br />
                        • Entry Number: Must match existing inventory S.No
                        <br />
                        • Quantity Sold: Cannot exceed remaining balance
                        <br />• Sold To: Customer name (required)
                      </p>
                    </>
                  )}{" "}
                  {importType === "combined" && (
                    <>
                      <p className="font-mono break-all">
                        Entry Date,S.No,Type,Item
                        Dimensions,Weight,Coating,Specifications,Item
                        Form,LOT,Quality,Balance,Sale Date,Sale Dimensions,Sold
                        To,Quantity Sold,Form
                      </p>
                      <p className="text-muted-foreground mt-2">
                        • Combined inventory and sales data
                        <br />
                        • Items with multiple sales should have multiple rows
                        <br />
                        • Sale fields can be empty for items without sales
                        <br />
                        • Entry Date & Sale Date: dd-MM-yyyy format
                        <br />• Item Dimensions & Sale Dimensions:
                        "thickness×width" format
                      </p>
                    </>
                  )}
                </div>
              </div>{" "}
              {/* Import Results */}
              {importResults && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Import Results</label>
                  <div className="bg-muted p-3 rounded-md text-sm">
                    {importType === "combined" ? (
                      <>
                        <p className="text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          {importResults.success} items processed successfully
                        </p>
                        {importResults.inventoryImported > 0 && (
                          <p className="text-blue-600 flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            {importResults.inventoryImported} inventory items
                            imported
                          </p>
                        )}
                        {importResults.salesImported > 0 && (
                          <p className="text-purple-600 flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {importResults.salesImported} sales records imported
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        {importResults.success} {importType} items imported
                        successfully
                      </p>
                    )}
                    {importResults.skipped > 0 && (
                      <p className="text-yellow-600 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        {importResults.skipped} items skipped
                      </p>
                    )}
                    {importResults.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-red-600 font-medium flex items-center gap-1">
                          <XOctagon className="h-4 w-4" /> Errors:
                        </p>
                        <div className="max-h-32 overflow-y-auto bg-background border rounded px-2 py-1 mt-1">
                          {importResults.errors.map((error, index) => (
                            <p key={index} className="text-xs text-red-600">
                              {error}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleImport}
                  disabled={!importFile || isImporting}
                  className="flex-1"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleImportReset}
                  disabled={isImporting}
                  className="flex-1"
                >
                  {importResults ? "Close" : "Cancel"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Dashboard;
