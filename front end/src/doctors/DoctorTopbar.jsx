import React from "react";
import { Menu, Search } from "lucide-react";
import NotificationPopup from "../components/NotificationPopup";
import UserProfileMenu from "../profile/UserProfileMenu";
import "./DoctorTopbar.css";

function DoctorTopbar({ title, onMenuToggle }) {
  return (
    <header className="dr-topbar">
      <div className="dr-topbar-left">
        <button
          className="dr-topbar-icon-btn"
          type="button"
          onClick={onMenuToggle}
          title="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="dr-topbar-title">{title}</h1>
      </div>

      <div className="dr-topbar-search">
        <Search size={15} className="dr-search-icon" />
        <input
          className="dr-search-input"
          placeholder="Search patient by name, ID or phone..."
          readOnly
        />
        <kbd className="dr-search-kbd">Ctrl + K</kbd>
      </div>

      <div className="dr-topbar-right">
        <NotificationPopup />
        <UserProfileMenu roleType="doctor" />
      </div>
    </header>
  );
}

export default DoctorTopbar;
