import React, { useRef } from "react";
import { Calendar } from "lucide-react";
import "./DatePickerField.css";

export const formatDisplayDate = (value) => {
  const raw = String(value || "").slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
};

export const parseDisplayDate = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
};

function DatePickerField({
  value,
  onChange,
  min,
  max,
  disabled = false,
  className = "",
  inputClassName = "",
  id,
  name,
}) {
  const pickerRef = useRef(null);

  const openPicker = () => {
    if (disabled) return;
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
    } else {
      picker.click();
    }
  };

  return (
    <span className={`date-picker-field ${className}`.trim()}>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        placeholder="DD-MM-YYYY"
        value={formatDisplayDate(value)}
        onChange={(event) => onChange?.(parseDisplayDate(event.target.value), event)}
        disabled={disabled}
        className={inputClassName}
      />
      <button
        type="button"
        className="date-picker-trigger"
        onClick={openPicker}
        disabled={disabled}
        title="Select date"
        aria-label="Select date"
      >
        <Calendar size={16} />
      </button>
      <input
        ref={pickerRef}
        className="date-picker-native"
        type="date"
        min={min}
        max={max}
        value={value || ""}
        onChange={(event) => onChange?.(event.target.value, event)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />
    </span>
  );
}

export default DatePickerField;
