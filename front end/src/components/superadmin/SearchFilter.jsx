import React from "react";
import { Search } from "lucide-react";

function SearchFilter({
  value,
  onChange,
  placeholder = "Search...",
  filters = [],
  selectedFilter = "All",
  onFilterChange,
}) {
  return (
    <div className="sa-search-filter">
      <div className="sa-search-box">
        <Search size={16} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </div>

      {filters.length ? (
        <select
          value={selectedFilter}
          onChange={(event) => onFilterChange(event.target.value)}
        >
          {filters.map((filter) => (
            <option key={filter} value={filter}>
              {filter}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

export default SearchFilter;

