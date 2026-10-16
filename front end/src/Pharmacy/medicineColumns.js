// Shared field definitions keep the Excel importer and catalogue in sync.
export const medicineColumns = [
  ["MedicineCode", "Medicine code", "code|drugcode|itemcode"],
  ["Name", "Medicine name", "medicinename|drugname|itemname"],
  ["GenericName", "Generic name", "generic"],
  ["BrandName", "Brand name", "brand"],
  ["Category", "Category", "medicinecategory"],
  ["DosageForm", "Dosage form", "dosage|form"],
  ["Strength", "Strength", ""],
  ["Manufacturer", "Manufacturer", "manufacturername"],
  ["PackSize", "Pack size", "packing|pack"],
  ["SupplierCode", "Supplier code", "vendorcode"],
  ["SupplierName", "Supplier name", "supplier|vendorname"],
  ["BatchNumber", "Batch number", "batch|batchno"],
  ["ManufactureDate", "Manufacture date", "manufacturingdate|mfgdate|mfg"],
  ["ExpiryDate", "Expiry date", "expirationdate|expiry|expdate"],
  ["Quantity", "Quantity", "stock|availablequantity|stockquantity|qty"],
  ["PurchasePrice", "Purchase price", "costprice|buyingprice"],
  ["SellingPrice", "Selling price", "saleprice|salesprice"],
  ["GST", "GST", "gstpercent|gstpercentage|gstrate"],
  ["MinimumStock", "Minimum stock", "minstock"],
  ["MaximumStock", "Maximum stock", "maxstock"],
  ["ReorderLevel", "Reorder level", "reorderpoint"],
  ["StorageLocation", "Storage location", "location|rack|racknumber"],
];

export const normalizeColumn = (value) => String(value ?? "").normalize("NFKC")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const aliases = new Map(medicineColumns.flatMap(([key, label, alternatives]) =>
  [key, label, ...alternatives.split("|").filter(Boolean)].map((alias) => [normalizeColumn(alias), key])
));

export const canonicalColumn = (header) => aliases.get(normalizeColumn(header)) || String(header).trim();

// The import API uses different names from the catalogue's display fields.
const importHeaders = { Name: "medicinename", Quantity: "stockquantity" };

export function normalizeMedicine(record) {
  const normalized = {};
  for (const [key, value] of Object.entries(record || {})) {
    const field = canonicalColumn(key);
    if (normalized[field] === undefined || normalized[field] === null || normalized[field] === "") {
      normalized[field] = value;
    }
  }
  return normalized;
}

export function normalizeHeaderRow(row) {
  const seen = new Set();
  return row.map((header) => {
    if (header === null || header === undefined || String(header).trim() === "") return header;
    const field = canonicalColumn(header);
    const identity = normalizeColumn(field);
    if (seen.has(identity)) throw new Error(`Multiple Excel columns map to ${field}. Merge or rename those columns before importing.`);
    seen.add(identity);
    return field;
  });
}

export async function normalizeMedicineWorkbook(file) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  let found = false;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    // Find a medicine header row even when the sheet starts with a report title.
    for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 49); row += 1) {
      const headers = Array.from({ length: range.e.c + 1 }, (_, c) => sheet[XLSX.utils.encode_cell({ r: row, c })]?.v);
      const fields = headers.map(canonicalColumn);
      if (!fields.includes("Name") || !fields.some((field) => ["MedicineCode", "Quantity", "BatchNumber"].includes(field))) continue;
      const missing = ["Name", "Quantity"].filter((field) => !fields.includes(field));
      if (missing.length) {
        throw new Error(`Missing Excel columns: ${missing.map((field) => importHeaders[field]).join(", ")}. Add these columns with the medicine data before importing.`);
      }
      normalizeHeaderRow(headers).forEach((header, c) => {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c })];
        if (cell && header !== undefined && header !== null) {
          cell.v = importHeaders[header] || header;
          cell.t = "s";
          delete cell.w;
          delete cell.f;
        }
      });
      // Keep all data and extra columns; exclude introductory title rows from the table range.
      sheet["!ref"] = XLSX.utils.encode_range({ s: { r: row, c: range.s.c }, e: range.e });
      found = true;
      break;
    }
  }
  if (!found) throw new Error("No medicine header row found. Include Medicine name and Medicine code, Quantity, or Batch number columns.");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new File([bytes], file.name.replace(/\.(xlsx|xls)$/i, ".xlsx"), {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
