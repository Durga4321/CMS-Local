import React from "react";
function DataTable({
  columns = [],
  rows = [],
  loading = false,
  error = "",
  emptyMessage = "No records found.",
  getRowKey,
  rowIndexOffset = 0,
  className = "",
  preserveColumnFractions = false,
}) {
  const normalizeColumnWidth = (width = "minmax(96px, 1fr)") =>
    String(width);

  const gridTemplateColumns = columns
    .map((column) => normalizeColumnWidth(column.width))
    .join(" ");

  if (error) {
    return <div className="sa-state sa-state--error">{error}</div>;
  }

  return (
    <div className={`sa-table${className ? ` ${className}` : ""}`}>
      <div className="sa-table-head" style={{ gridTemplateColumns }}>
        {columns.map((column) => (
          <span
            key={column.key}
            className={
              column.key === "actions" ||
              String(column.cellClassName || "").includes("actions") ||
              String(column.label || "").toLowerCase() === "actions"
                ? "sa-actions-header"
                : column.key === "status" ||
                  String(column.cellClassName || "").includes("status") ||
                  String(column.label || "").toLowerCase() === "status"
                ? "sa-status-head"
                : column.key === "sno" ||
                  column.key === "index" ||
                  String(column.label || "").toLowerCase() === "s.no." ||
                  String(column.label || "").toLowerCase() === "s.no"
                ? "sa-sno-head"
                : ""
            }
          >
            {column.label}
          </span>
        ))}
      </div>

      {loading ? <div className="sa-state">Loading records...</div> : null}

      {!loading && !rows.length ? (
        <div className="sa-state">{emptyMessage}</div>
      ) : null}

      {!loading &&
        rows.map((row, index) => (
          <div
            className="sa-table-row"
            style={{ gridTemplateColumns }}
            key={getRowKey ? getRowKey(row) : row.id || index}
          >
            {columns.map((column) => (
              <div
                className={`sa-table-cell${column.cellClassName ? ` ${column.cellClassName}` : ""}${
                  column.key === "status" ||
                  String(column.cellClassName || "").includes("status") ||
                  String(column.label || "").toLowerCase() === "status"
                    ? " sa-table-cell--status"
                    : column.key === "sno" ||
                      column.key === "index" ||
                      String(column.label || "").toLowerCase() === "s.no." ||
                      String(column.label || "").toLowerCase() === "s.no"
                    ? " sa-table-cell--sno"
                    : ""
                }`}
                key={column.key}
              >
                {column.render ? column.render(row, rowIndexOffset + index) : row[column.key] || "-"}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

export default DataTable;

