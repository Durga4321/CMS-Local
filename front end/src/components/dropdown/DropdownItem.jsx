import React from "react";
import { ChevronRight } from "lucide-react";
import "./Dropdown.css";

/**
 * Standardized Healthcare Dropdown Menu Item Card
 * Matches clinical reference specification:
 * - Stadium pill shape with smooth borders and soft elevation
 * - 3D glossy teardrop blood droplet badge pointing DOWNWARD (or circle badge)
 * - Hero pill variant with right crimson syringe square badge
 * - Radiant orange pill variant with white droplet badge and white DESK tag
 * - Blush pink and danger pill variants with right tags (ONLINE, EXIT)
 */
export function DropdownItem({
  icon: Icon,
  title,
  subtitle,
  chevron = false,
  variant = "default", // "default" | "pink" | "hero" | "orange" | "danger"
  leftBadgeType = "droplet", // "droplet" | "circle" | "none"
  dropletVariant, // "crimson" | "white" | "danger"
  tag,
  tagVariant,
  rightBadge,
  badge,
  danger = false,
  onClick,
  staggerIndex,
  revealed = true,
  disabled = false,
  className = "",
  dropletBadge = true,
  children,
}) {
  const handleClick = (e) => {
    if (disabled) return;
    if (onClick) onClick(e);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onClick) onClick(e);
    }
  };

  const isDanger = danger || variant === "danger";
  const isOrange = variant === "orange";
  const isHero = variant === "hero";
  const isPink = variant === "pink" || (!isOrange && !isHero && !isDanger);

  // Determine variant class
  let variantClass = "hc-dropdown-item--pink";
  if (isHero) variantClass = "hc-dropdown-item--hero";
  else if (isOrange) variantClass = "hc-dropdown-item--orange";
  else if (isDanger) variantClass = "hc-dropdown-item--danger";

  // Determine droplet color variant
  const effectiveDropletVariant = dropletVariant || (isOrange ? "white" : isDanger ? "danger" : "crimson");

  // Determine tag variant
  const effectiveTagVariant = tagVariant || (isOrange ? "white" : isDanger ? "danger" : "pink");

  const revealClasses = staggerIndex !== undefined
    ? `hc-droplet-reveal ${revealed ? "revealed" : ""}`
    : "";

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      className={`hc-dropdown-item ${variantClass} ${revealClasses} ${className}`}
      data-stagger={staggerIndex}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled}
    >
      {/* Left Icon Badge */}
      {Icon && (
        leftBadgeType === "circle" ? (
          <span className="hc-hero-circle-badge">
            {React.isValidElement(Icon) ? Icon : <Icon size={15} strokeWidth={2.2} />}
          </span>
        ) : dropletBadge ? (
          <span className="hc-hero-circle-badge">
            {React.isValidElement(Icon) ? Icon : <Icon size={15} strokeWidth={2.2} />}
          </span>
        ) : (
          <div className="hc-dropdown-item-icon-box">
            {React.isValidElement(Icon) ? Icon : <Icon size={15} />}
          </div>
        )
      )}

      {/* Content Area (Title & Subtitle) */}
      <div className="hc-dropdown-item-content">
        {title && (
          <span
            className={`hc-dropdown-item-title ${
              isOrange ? "is-orange-title" : isDanger ? "is-danger-title" : isPink ? "is-pink-title" : ""
            }`}
          >
            {title}
          </span>
        )}
        {subtitle && (
          <span
            className={`hc-dropdown-item-subtitle ${
              isOrange ? "is-orange-subtitle" : isDanger ? "is-danger-subtitle" : isPink ? "is-pink-subtitle" : ""
            }`}
          >
            {subtitle}
          </span>
        )}
        {children}
      </div>

      {/* Right Tag Badge (e.g. ONLINE, DESK, EXIT) */}
      {tag && (
        <span className={`hc-pill-tag hc-pill-tag--${effectiveTagVariant}`}>
          {tag}
        </span>
      )}

      {/* Right Custom Badge (e.g. Crimson Syringe Square Badge) */}
      {rightBadge && (
        <div className="hc-dropdown-item-right-badge">
          {rightBadge}
        </div>
      )}

      {/* Legacy badge support */}
      {badge && !tag && !rightBadge && (
        <span className="hc-profile-badge">{badge}</span>
      )}

      {/* Chevron if enabled */}
      {chevron && (
        <ChevronRight size={17} className="hc-dropdown-item-chevron" />
      )}
    </button>
  );
}

export default DropdownItem;
