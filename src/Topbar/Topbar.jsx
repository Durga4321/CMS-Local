// import React, { useState } from "react";
// import { Bell, Menu, Search, ChevronDown } from "lucide-react";
// import "./Topbar.css";

// function Topbar({ onMenu }) {
//   const [open, setOpen] = useState(false);

//   return (
//     <header className="topbar">

//       {/* LEFT */}
//       <div className="topbar-left">
//         <button className="topbar-menu-btn" onClick={onMenu}>
//           <Menu size={20} />
//         </button>

//         <div className="topbar-search-box">
//           <Search size={16} className="topbar-search-icon" />
//           <input
//             type="text"
//             placeholder="Search patients, doctors, appointments..."
//           />
//         </div>
//       </div>

//       {/* RIGHT */}
//       <div className="topbar-right">

//         {/* Notification */}
//         <div className="topbar-notification">
//           <Bell size={18} />
//           <span className="topbar-dot"></span>
//         </div>

//         {/* Profile */}
//         <div className="topbar-profile" onClick={() => setOpen(!open)}>
//           <div className="topbar-avatar">A</div>

//           <div className="topbar-user-info">
//             <p>Admin</p>
//             <span>Administrator</span>
//           </div>

//           <ChevronDown size={14} />

//           {open && (
//             <div className="topbar-dropdown">
//               <div className="topbar-dropdown-header">
//                 <p className="topbar-name">Admin</p>
//                 <span className="topbar-email">admin@medicore.io</span>
//               </div>

//               <div className="topbar-dropdown-item topbar-logout">
//                 Sign out
//               </div>
//             </div>
//           )}
//         </div>

//       </div>
//     </header>
//   );
// }

// export default Topbar;



import React, { useEffect, useMemo, useState } from "react";

import {
  Menu,
  Search,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import "./Topbar.css";
import NotificationPopup from "../components/NotificationPopup";
import UserProfileMenu from "../profile/UserProfileMenu";
import { apiUrl } from "../config/api";

const DASHBOARD_API = apiUrl("Dashboard");

const getAdminToken = () =>
  localStorage.getItem("adminToken") ||
  localStorage.getItem("token");

const getActivityCount = (data) => {
  const activities =
    data?.recentActivities ||
    data?.data?.recentActivities ||
    data?.result?.recentActivities;

  if (Array.isArray(activities)) return activities.length;

  return Number(
    data?.recentActivityCount ||
    data?.data?.recentActivityCount ||
    data?.result?.recentActivityCount ||
    0
  );
};

const adminSearchItems = [
  { label: "Dashboard", keywords: "home stats overview", path: "/dashboard" },
  { label: "Doctors", keywords: "doctor physicians schedule register", path: "/doctors" },
  { label: "Receptionists", keywords: "front desk receptionist", path: "/receptionists" },
  { label: "Patients", keywords: "patient records medical", path: "/patients" },
  { label: "Appointments", keywords: "booking appointment token", path: "/appointments" },
  { label: "Schedule Settings", keywords: "doctor schedule slots timing", path: "/DoctorSchedule/schedule" },
  { label: "Reports", keywords: "analysis revenue export", path: "/reports" },
];

const superAdminSearchItems = [
  { label: "Super Admin Dashboard", keywords: "overview stats analytics", path: "/superadmin/dashboard" },
  { label: "Clinics", keywords: "clinic hospital branch", path: "/superadmin/clinics" },
  { label: "Admins", keywords: "clinic admins management", path: "/superadmin/admins" },
  { label: "Users", keywords: "users accounts active", path: "/superadmin/users" },
  { label: "Roles & Permissions", keywords: "roles permissions access", path: "/superadmin/roles" },
  { label: "Settings", keywords: "configuration email sms payment", path: "/superadmin/settings" },
  { label: "Reports", keywords: "analysis revenue export pdf csv", path: "/superadmin/reports" },
  { label: "Audit Logs", keywords: "login audit history activity", path: "/superadmin/audit-logs" },
  { label: "Notifications", keywords: "send notification message", path: "/superadmin/notifications" },
];

function Topbar({ onMenu }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [activityCount, setActivityCount] = useState(0);
  const isSuperAdmin = location.pathname.startsWith("/superadmin");
  const searchItems = isSuperAdmin ? superAdminSearchItems : adminSearchItems;
  const placeholder = isSuperAdmin
    ? "Search dashboard, clinics, admins, reports..."
    : "Search patients, doctors, appointments...";

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return searchItems;

    return searchItems.filter((item) =>
      `${item.label} ${item.keywords}`.toLowerCase().includes(value)
    );
  }, [query, searchItems]);

  const goTo = (path) => {
    setQuery("");
    setShowResults(false);
    navigate(path);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (results[0]) goTo(results[0].path);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      setActivityCount(0);
      return undefined;
    }

    let active = true;

    const loadActivityCount = async () => {
      try {
        const token = getAdminToken();
        const response = await fetch(DASHBOARD_API, {
          headers: {
            "ngrok-skip-browser-warning": "true",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (active) setActivityCount(getActivityCount(data));
      } catch {
        // Keep the last successful count when a background refresh fails.
      }
    };

    loadActivityCount();
    const intervalId = window.setInterval(loadActivityCount, 30000);
    window.addEventListener("focus", loadActivityCount);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadActivityCount);
    };
  }, [isSuperAdmin]);

  return (

    <header className="topbar">

      {/* LEFT */}

      <div className="topbar-left">

        <button
          className="topbar-menu-btn"
          onClick={onMenu}
        >
          <Menu size={20} />
        </button>

        <form
          className="topbar-search-box"
          onSubmit={submitSearch}
          onBlur={() => window.setTimeout(() => setShowResults(false), 120)}
        >

          <Search
            size={16}
            className="topbar-search-icon"
          />

          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder={placeholder}
          />

          {showResults ? (
            <div className="topbar-search-results">
              {results.length ? (
                results.slice(0, 7).map((item) => (
                  <button
                    type="button"
                    key={item.path}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => goTo(item.path)}
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                <span>No matching module</span>
              )}
            </div>
          ) : null}

        </form>

      </div>

      {/* RIGHT */}

      <div className="topbar-right">
        <NotificationPopup isSuperAdmin={isSuperAdmin} activityCount={activityCount} />

        <UserProfileMenu roleType="admin" />

      </div>

    </header>
  );
}

export default Topbar;
