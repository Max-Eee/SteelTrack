import React, { useState, useEffect, useCallback } from "react";
import {
  initializeDatabase,
  storeHashedCode,
  createDatabaseBackup,
  loadDatabaseFromFile,
} from "./lib/database";
import { verifySession, hashCode } from "./lib/auth";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import { AppSidebar } from "./components/sidebars/app-sidebar";
import { SidebarProvider } from "./components/ui/sidebar";
import { ConfirmationDialog } from "./components/ui/confirmation-dialog";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [exportFunction, setExportFunction] = useState(null);
  const [importFunction, setImportFunction] = useState(null);
  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState(false);
  const [showRestoreSuccess, setShowRestoreSuccess] = useState(false);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    type: [],
    quality: [],
    lot: "",
    soldTo: "",
    minThickness: "",
    maxThickness: "",
    minWidth: "",
    maxWidth: "",
    minWeight: "",
    maxWeight: "",
    showSoldOnly: false,
    showUnsoldOnly: false,
    showDCOnly: false,
    showNonDCOnly: false,
  });
  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialize database
        await initializeDatabase();
        console.log("Database initialized");

        // Check if user is already authenticated
        const authenticated = verifySession();
        setIsAuthenticated(authenticated);

        // Check if we're reloading after a database restore
        const dbRestored = localStorage.getItem("db_restored");
        if (dbRestored === "true") {
          // Clear the flag to prevent showing the alert again
          localStorage.removeItem("db_restored");
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };
  const handleLogout = () => {
    setIsAuthenticated(false);
  };
  const handleExportFunction = useCallback((exportFn) => {
    setExportFunction(() => exportFn);
  }, []);

  const handleImportFunction = useCallback((importFn) => {
    setImportFunction(() => importFn);
  }, []);

  const handleExportCSV = useCallback(
    (exportType) => {
      if (exportFunction) {
        exportFunction(exportType);
      }
    },
    [exportFunction]
  );

  const handleImportCSV = useCallback(() => {
    if (importFunction) {
      importFunction();
    }
  }, [importFunction]);
  const clearFilters = useCallback(() => {
    setFilters({
      startDate: null,
      endDate: null,
      type: [],
      quality: [],
      lot: "",
      soldTo: "",
      minThickness: "",
      maxThickness: "",
      minWidth: "",
      maxWidth: "",
      minWeight: "",
      maxWeight: "",
      showSoldOnly: false,
      showUnsoldOnly: false,
      showDCOnly: false,
      showNonDCOnly: false,
    });
  }, []);

  const handleDatabaseBackup = useCallback(async () => {
    try {
      const backupPath = await createDatabaseBackup();
      if (backupPath) {
        alert(`Database backup created successfully!\nSaved to: ${backupPath}`);
      }
    } catch (error) {
      console.error("Error creating backup:", error);
      throw error;
    }
  }, []);
  const handleDatabaseRestore = useCallback(() => {
    // Show custom confirmation dialog instead of native confirm
    setShowRestoreConfirmation(true);
  }, []);
  const handleRestoreConfirmed = useCallback(async () => {
    setShowRestoreConfirmation(false);

    try {
      const success = await loadDatabaseFromFile();
      if (success) {
        // Show success dialog instead of alert
        setShowRestoreSuccess(true);
      }
    } catch (error) {
      console.error("Error loading database:", error);
      alert("Failed to load database: " + error.message);
    }
  }, []);
  const handleRestoreCancelled = useCallback(() => {
    setShowRestoreConfirmation(false);
  }, []);

  const handleRestoreSuccessAcknowledged = useCallback(() => {
    setShowRestoreSuccess(false);
    // Force a page reload to ensure all components refresh with new data
    window.location.reload();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing system...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="App bg-background min-h-screen">
      {isAuthenticated ? (
        <SidebarProvider>
          <main className="flex-1">
            {" "}
            <Dashboard
              onLogout={handleLogout}
              filters={filters}
              onFilterChange={setFilters}
              onClearFilters={clearFilters}
              onSetExportFunction={handleExportFunction}
              onSetImportFunction={handleImportFunction}
            />
          </main>{" "}
          <AppSidebar
            side="right"
            filters={filters}
            onFilterChange={setFilters}
            onClearFilters={clearFilters}
            onExportCSV={handleExportCSV}
            onImportCSV={handleImportCSV}
            onDatabaseBackup={handleDatabaseBackup}
            onDatabaseRestore={handleDatabaseRestore}
            onLogout={handleLogout}
          />
        </SidebarProvider>
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}{" "}
      <ConfirmationDialog
        isOpen={showRestoreConfirmation}
        onClose={handleRestoreCancelled}
        onConfirm={handleRestoreConfirmed}
        title="Load Database"
        description="Loading a new database will replace your current data. A backup will be created automatically. Do you want to continue?"
        confirmText="OK"
        cancelText="Cancel"
        showCancelButton={true}
        variant="destructive"
      />
      <ConfirmationDialog
        isOpen={showRestoreSuccess}
        onClose={handleRestoreSuccessAcknowledged}
        onConfirm={handleRestoreSuccessAcknowledged}
        title="Success"
        description="Database loaded successfully! The application will reload the data."
        confirmText="OK"
        showCancelButton={false}
        variant="default"
      />
    </div>
  );
}

export default App;
