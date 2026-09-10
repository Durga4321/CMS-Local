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
        {columns.map((column) => {
          const isActionCol =
            column.key === "actions" ||
            String(column.cellClassName || "").includes("actions") ||
            String(column.label || "").toLowerCase() === "actions";
          const isStatusCol =
            column.key === "status" ||
            String(column.cellClassName || "").includes("status") ||
            String(column.label || "").toLowerCase() === "status";
          const isSnoCol =
            column.key === "sno" ||
            column.key === "index" ||
            column.key === "serial" ||
            String(column.label || "").toLowerCase() === "s.no." ||
            String(column.label || "").toLowerCase() === "s.no" ||
            String(column.label || "").toLowerCase() === "s. no.";
          const isNameCol =
            column.key === "name" ||
            String(column.cellClassName || "").includes("name") ||
            String(column.label || "").toLowerCase() === "name" ||
            String(column.label || "").toLowerCase() === "admin name" ||
            String(column.label || "").toLowerCase() === "clinic name";

          const isCentered =
            column.align === "center" || isActionCol || isStatusCol || isSnoCol;
          const isRight = column.align === "right";

          const headClasses = [
            isActionCol ? "sa-actions-header" : "",
            isStatusCol ? "sa-status-head" : "",
            isSnoCol ? "sa-sno-head" : "",
            isNameCol ? "sa-name-head" : "",
            column.headerClassName || "",
            isCentered ? "sa-align-center" : isRight ? "sa-align-right" : "sa-align-left",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span key={column.key} className={headClasses}>
              {column.label}
            </span>
          );
        })}
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
            {columns.map((column) => {
              const isActionCol =
                column.key === "actions" ||
                String(column.cellClassName || "").includes("actions") ||
                String(column.label || "").toLowerCase() === "actions";
              const isStatusCol =
                column.key === "status" ||
                String(column.cellClassName || "").includes("status") ||
                String(column.label || "").toLowerCase() === "status";
              const isSnoCol =
                column.key === "sno" ||
                column.key === "index" ||
                column.key === "serial" ||
                String(column.label || "").toLowerCase() === "s.no." ||
                String(column.label || "").toLowerCase() === "s.no" ||
                String(column.label || "").toLowerCase() === "s. no.";
              const isNameCol =
                column.key === "name" ||
                String(column.cellClassName || "").includes("name") ||
                String(column.label || "").toLowerCase() === "name" ||
                String(column.label || "").toLowerCase() === "admin name" ||
                String(column.label || "").toLowerCase() === "clinic name";

              const isCentered =
                column.align === "center" || isActionCol || isStatusCol || isSnoCol;
              const isRight = column.align === "right";

              const cellClasses = [
                "sa-table-cell",
                column.cellClassName || "",
                isActionCol ? "sa-table-cell--actions" : "",
                isStatusCol ? "sa-table-cell--status" : "",
                isSnoCol ? "sa-table-cell--sno" : "",
                isNameCol ? "sa-table-cell--name" : "",
                isCentered ? "sa-align-center" : isRight ? "sa-align-right" : "sa-align-left",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div className={cellClasses} key={column.key}>
                  {column.render ? column.render(row, rowIndexOffset + index) : row[column.key] || "-"}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}

export default DataTable;

