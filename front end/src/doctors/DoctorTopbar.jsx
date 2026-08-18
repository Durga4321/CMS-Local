import React, { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import NotificationPopup from "../components/NotificationPopup";
import UserProfileMenu from "../profile/UserProfileMenu";
import { doctorModuleSearchItems, searchModuleItems } from "../utils/moduleSearch";
import "./DoctorTopbar.css";

function DoctorTopbar({ title, sidebarOpen, onMenuToggle, search = "", onSearch = () => {} }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [showResults, setShowResults] = useState(false);
  const results = useMemo(() => searchModuleItems(doctorModuleSearchItems, search), [search]);

  const goTo = (path) => {
    onSearch("");
    setShowResults(false);
    navigate(path);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (results[0]) goTo(results[0].path);
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="dr-topbar">
      <div className="dr-topbar-left">
        <button
          className="dr-topbar-icon-btn"
          type="button"
          onClick={onMenuToggle}
          title="Toggle menu"
          aria-label="Toggle navigation menu"
          aria-expanded={sidebarOpen}
        >
          <Menu size={20} />
        </button>
        <h1 className="dr-topbar-title">{title}</h1>
      </div>

      <form className="dr-topbar-search" onSubmit={submitSearch} onBlur={() => window.setTimeout(() => setShowResults(false), 120)}>
        <Search size={15} className="dr-search-icon" />
        <input
          ref={inputRef}
          className="dr-search-input"
          placeholder="Search patient by name, ID or phone..."
          aria-label="Search patients"
          value={search}
          onChange={(e) => {
            onSearch(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
        />
        <kbd className="dr-search-kbd">Ctrl + K</kbd>
        {showResults ? (
          <div className="dr-search-results">
            {results.length ? results.slice(0, 7).map((item) => (
              <button key={item.path} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(item.path)}>
                {item.label}
              </button>
            )) : <span>No matching module</span>}
          </div>
        ) : null}
      </form>

      <div className="dr-topbar-right">
        <NotificationPopup />
        <UserProfileMenu roleType="doctor" />
      </div>
    </header>
  );
}

export default DoctorTopbar;
