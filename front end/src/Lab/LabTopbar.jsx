import React, { useMemo, useState } from "react";
import { ChevronRight, Menu, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import NotificationPopup from "../components/NotificationPopup";
import UserProfileMenu from "../profile/UserProfileMenu";
import { labModuleSearchItems, searchModuleItems } from "../utils/moduleSearch";

function LabTopbar({ title, onMenu }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const crumbs = location.pathname.split("/").filter(Boolean).slice(1);
  const results = useMemo(() => searchModuleItems(labModuleSearchItems, query), [query]);
  const goTo = (path) => {
    setQuery("");
    setShowResults(false);
    navigate(path);
  };
  const submitSearch = (event) => {
    event.preventDefault();
    if (results[0]) goTo(results[0].path);
  };
  return (
    <header className="rc-topbar lab-topbar">
      <div className="rc-topbar-left">
        <button type="button" className="rc-topbar-menu" onClick={onMenu}>
          <Menu size={20} />
        </button>
        <div>
          <h1>{title}</h1>
          <div className="rc-crumbs">
            <span>Home</span>
            <ChevronRight size={13} />
            <span>Lab</span>
            {crumbs[0] ? <><ChevronRight size={13} /><span>{crumbs[0]}</span></> : null}
          </div>
        </div>
      </div>
      <div className="rc-top-actions">
        <form className="rc-search rc-module-search" onSubmit={submitSearch} onBlur={() => window.setTimeout(() => setShowResults(false), 120)}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search lab modules..."
          />
          {showResults ? (
            <div className="rc-search-results">
              {results.length ? results.slice(0, 7).map((item) => (
                <button key={item.path} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(item.path)}>
                  {item.label}
                </button>
              )) : <span>No matching module</span>}
            </div>
          ) : null}
        </form>
        <NotificationPopup />
        <UserProfileMenu roleType="lab" />
      </div>
    </header>
  );
}

export default LabTopbar;
