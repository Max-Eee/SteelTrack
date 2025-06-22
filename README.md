# <i>**`Steel`** Inventory Management Application</i>

A comprehensive **`tauri app`** built with modern technologies for tracking steel materials, dimensions, sales, and distribution center operations.

---

<samp>

## 📥 Download

For **Windows users**, prebuilt applications is available in the [**Drive**](https://drive.google.com/drive/u/2/folders/1CT8e_kR-C6gZjb1G5birkLrMQOnOcxqK). <br>
Download the latest version for immediate use without requiring development setup.
  
> [!IMPORTANT]
> **Default Password**:  ST#Pas
> 
> **Secure Access Control**: This application features encrypted data storage and secure authentication to protect your sensitive inventory information.

## ✨ Features

- **`Comprehensive Inventory Management`** : Track steel materials with detailed dimensions, weights, grades, and quality specifications
- **`Multi-Dimensional Support`** : Handle items with multiple thickness and width combinations seamlessly
- **`Advanced Sales Tracking`** : Record and manage sales transactions with customer details and quantity tracking
- **`Distribution Center Integration`** : Send items to DC and track their status with full traceability
- **`Smart Filtering System`** : Filter inventory by date range, type, quality, dimensions, weight, and sales status
- **`CSV Import/Export`** : Import inventory data from CSV files and export reports in multiple formats
- **`Real-time Balance Calculation`** : Automatic calculation of remaining stock after sales transactions
- **`Bulk Operations`** : Perform bulk edits, bulk DC operations, and bulk data management
- **`Data Encryption`** : All sensitive data is encrypted for security and compliance
- **`Portable Application`** : Built with Tauri for cross-platform desktop deployment

## ⚙️ Usage

### Getting Started

1. **Launch the application** and create your secure access credentials
2. **Import existing data** using CSV files or start with manual entry
3. **Configure filters** to view specific inventory segments
4. **Manage sales** by double-clicking on inventory items
5. **Export reports** for analysis and record-keeping

### Key Operations

- **Add New Items**: Use the + button or press <kbd>Alt</kbd> + <kbd>N</kbd> to add new inventory items with dimensions
- **Bulk Edit**: Select multiple items and perform bulk operations for efficient data management
- **Manage Sales**: Double-click items and press <kbd>Alt</kbd> + <kbd>S</kbd> to add a sale
- **DC Operations**: Send items to distribution center and track their status
- **Export Data**: Export filtered data in multiple formats (inventory, sales, combined)

## ⬇️ Installation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Max-Eee/SteelTrack
   cd "SteelTrack"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup Rust/Tauri (if not already installed)**
   - Install Rust: https://rustup.rs/
   - Install Tauri CLI: `cargo install tauri-cli`

4. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

### Production Build

1. **Build for production**
   ```bash
   npm run tauri build
   ```

3. **Create portable version**
   ```bash
   npm run tauri:build:portable
   ```

## 🔧 Technical Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Tauri (Rust)
- **Database**: SQLite with encryption
- **UI Components**: ShadCn, Radix UI, Lucide React

## 📁 Project Structure

```
src/
├── components/
│   ├── dialogs/           # Modal dialogs
│   ├── sidebars/          # Navigation components
│   └── ui/                # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Core utilities
│   ├── auth.js           # Authentication logic
│   ├── database.js       # Database operations
│   └── utils.js          # Helper functions
└── screens/
    ├── Dashboard.jsx     # Main inventory dashboard
    └── Login.jsx         # Authentication screen
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

</samp>
