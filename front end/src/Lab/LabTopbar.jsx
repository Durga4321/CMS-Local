import React from "react";
import { ChevronRight, Menu, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import NotificationPopup from "../components/NotificationPopup";
import UserProfileMenu from "../profile/UserProfileMenu";

function LabTopbar({ title, onMenu }) {
  const location = useLocation();
  const crumbs = location.pathname.split("/").filter(Boolean).slice(1);
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
        <label className="rc-search">
          <Search size={18} />
          <input placeholder="Search patients, tests, samples..." />
        </label>
        <NotificationPopup />
        <UserProfileMenu roleType="lab" />
      </div>
    </header>
  );
}

export default LabTopbar;
