import React from "react";

function Header({ title, subtitle, action }) {
  return (
    <div className="sa-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="sa-page-actions">{action}</div> : null}
    </div>
  );
}

export default Header;

