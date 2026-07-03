import React from "react";

function DataTable({
  columns = [],
  rows = [],
  loading = false,
  error = "",
  emptyMessage = "No records found.",
  getRowKey,
  rowIndexOffset = 0,
}) {
  const gridTemplateColumns = columns
    .map((column) => column.width || "minmax(0, 1fr)")
    .join(" ");

  if (error) {
    return <div className="sa-state sa-state--error">{error}</div>;
  }

  return (
    <div className="sa-table">
      <div className="sa-table-head" style={{ gridTemplateColumns }}>
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
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
                className={`sa-table-cell${column.cellClassName ? ` ${column.cellClassName}` : ""}`}
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

