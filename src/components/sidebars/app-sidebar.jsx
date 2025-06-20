import * as React from "react";
import {
  Download,
  LogOut,
  X,
  Database,
  Save,
  FolderOpen,
  Upload,
} from "lucide-react";

import { FilterSidebar } from "./filter-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "../ui/sidebar";

export function AppSidebar({
  filters,
  onFilterChange,
  onClearFilters,
  onExportCSV,
  onImportCSV,
  onDatabaseBackup,
  onDatabaseRestore,
  onLogout,
  ...props
}) {
  const handleExportOption = (exportType) => {
    if (onExportCSV) {
      onExportCSV(exportType);
    }
  };

  const handleImportCSV = () => {
    if (onImportCSV) {
      onImportCSV();
    }
  };

  const handleDatabaseBackup = async () => {
    if (onDatabaseBackup) {
      try {
        await onDatabaseBackup();
      } catch (error) {
        console.error("Backup failed:", error);
        alert("Failed to create backup: " + error.message);
      }
    }
  };
  const handleDatabaseRestore = () => {
    if (onDatabaseRestore) {
      try {
        onDatabaseRestore();
      } catch (error) {
        console.error("Restore failed:", error);
        alert("Failed to load database: " + error.message);
      }
    }
  };

  return (
    <Sidebar {...props}>      <SidebarContent className="relative">
        <div className="flex-1 overflow-y-auto">
          <FilterSidebar
            filters={filters}
            onFilterChange={onFilterChange}
            onClearFilters={onClearFilters}
          />
        </div>
        {/* Blur effect to indicate scrollable content */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onClearFilters}
              className="hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
              <span>Clear Filters</span>
            </SidebarMenuButton>
          </SidebarMenuItem>{" "}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleImportCSV}
              className="hover:bg-muted transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Import CSV</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="hover:bg-muted transition-colors">
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleExportOption("inventory")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Inventory
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportOption("sales")}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Sales
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportOption("inventory-with-sales")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Inventory with Sales
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="hover:bg-muted transition-colors">
                  <Database className="w-4 h-4" />
                  <span>Database</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDatabaseBackup}>
                  <Save className="mr-2 h-4 w-4" />
                  Create Backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDatabaseRestore}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Load Database
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onLogout}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
