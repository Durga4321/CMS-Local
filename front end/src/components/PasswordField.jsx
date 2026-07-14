import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./PasswordField.css";

function PasswordField({ className = "", wrapperClassName = "", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-field ${wrapperClassName}`.trim()}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={className}
      />
      <button
        type="button"
        className="password-field-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        disabled={props.disabled}
      >
        {visible ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
    </div>
  );
}

export default PasswordField;
