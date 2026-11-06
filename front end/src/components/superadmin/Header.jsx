import React from "react";

function Header({ title, subtitle, action, leading, search }) {
  return (
    <div className="sa-page-header" data-page-header>
      {leading ? <div className="sa-page-header__leading" aria-hidden="true">{leading}</div> : null}
      <div className="sa-page-header__copy">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {search ? <div className="admin-heading-search">{search}</div> : null}
      {action ? <div className="sa-page-actions">{action}</div> : null}
    </div>
  );
}

export default Header;

