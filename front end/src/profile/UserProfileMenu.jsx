import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, KeyRound, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getInitials, getRoleProfile, logoutAndClearSessions } from "./sessionProfile";
import "./UserProfile.css";

function UserProfileMenu({ roleType = "admin" }) {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const profile = getRoleProfile(roleType);

  useEffect(() => {
    const close = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const logout = async () => {
    await logoutAndClearSessions(roleType);
    navigate("/login", { replace: true });
  };

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="user-profile-wrap" ref={wrapRef}>
      <button
        className={`user-profile-chip${open ? " open" : ""}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={`${profile.name} ${profile.email}`.trim()}
      >
        <span className="user-profile-avatar-shell">
          <span className="user-profile-avatar">{getInitials(profile.name || profile.email)}</span>
          <span className="user-profile-online-dot" />
        </span>
        <span className="user-profile-copy">
          <strong>{profile.name}</strong>
          <em>{profile.email}</em>
        </span>
        <ChevronDown size={18} className="user-profile-chevron" />
      </button>

      {open ? (
        <div className="user-profile-dropdown">
          <div className="user-profile-head">
            <span className="user-profile-head-avatar">{getInitials(profile.name || profile.email)}</span>
            <span className="user-profile-head-copy">
              <strong>{profile.name}</strong>
              <span>{profile.email}</span>
              <em>{profile.roleLabel}</em>
            </span>
          </div>
          <button type="button" onClick={() => goTo(profile.profilePath)}>
            <span className="user-profile-menu-icon">
              <UserRound size={20} />
            </span>
            <span className="user-profile-menu-copy">
              <b>My Profile</b>
              <small>View and edit your profile</small>
            </span>
            <ChevronRight size={17} className="user-profile-menu-arrow" />
          </button>
          <button type="button" onClick={() => goTo(profile.passwordPath)}>
            <span className="user-profile-menu-icon">
              <KeyRound size={20} />
            </span>
            <span className="user-profile-menu-copy">
              <b>Change Password</b>
              <small>Update your password</small>
            </span>
            <ChevronRight size={17} className="user-profile-menu-arrow" />
          </button>
          <button type="button" className="danger" onClick={logout}>
            <span className="user-profile-menu-icon danger">
              <LogOut size={20} />
            </span>
            <span className="user-profile-menu-copy">
              <b>Logout</b>
              <small>Sign out from your account</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UserProfileMenu;

