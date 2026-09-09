import React, { useCallback, useEffect, useRef, useState } from "react";
import "./Dropdown.css";

/**
 * Healthcare DropdownMenu Container
 * Manages open/close state machine, click-outside, escape key, keyboard navigation,
 * and optional syringe/droplet synchronization.
 */
export function DropdownMenu({
  trigger,
  children,
  isOpen: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  placement = "bottom-end",
  variant = "dark",
  syringeMode = false,
  className = "",
  style = {},
  ariaLabel = "Menu",
}) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  // Animation state machine: "closed" | "opening" | "open" | "closing"
  const [animState, setAnimState] = useState(open ? "open" : "closed");
  const [dropletsFired, setDropletsFired] = useState(false);

  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const timerRef = useRef(null);

  const updateOpen = useCallback((nextOpen) => {
    const isCurrentlyActive = animState === "open" || animState === "opening";
    if (nextOpen === isCurrentlyActive) {
      if (onOpenChange) onOpenChange(nextOpen);
      return;
    }

    if (nextOpen) {
      setAnimState("opening");
      if (syringeMode) {
        setDropletsFired(true);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setAnimState("open");
      }, 200);
    } else {
      setAnimState("closing");
      setDropletsFired(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setAnimState("closed");
      }, 180);
    }

    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    if (onOpenChange) {
      onOpenChange(nextOpen);
    }
  }, [animState, isControlled, onOpenChange, syringeMode]);

  // Synchronize external controlled state changes
  useEffect(() => {
    if (!isControlled) return;
    if (controlledOpen && animState !== "open" && animState !== "opening") {
      updateOpen(true);
    } else if (!controlledOpen && animState !== "closed" && animState !== "closing") {
      updateOpen(false);
    }
  }, [controlledOpen, isControlled, animState, updateOpen]);

  // Click outside listener: closes dropdown when clicking outside menu & trigger
  useEffect(() => {
    if (animState === "closed") return;

    const handleClickOutside = (event) => {
      // If clicking inside menu, let the button handlers execute!
      if (menuRef.current && menuRef.current.contains(event.target)) {
        return;
      }
      // If clicking inside trigger container, let trigger toggle handler run!
      if (containerRef.current && containerRef.current.contains(event.target)) {
        return;
      }
      // Otherwise, click was outside on screen -> close dropdown
      updateOpen(false);
    };

    const attachTimer = setTimeout(() => {
      window.addEventListener("pointerdown", handleClickOutside, true);
      window.addEventListener("click", handleClickOutside, true);
    }, 30);

    return () => {
      clearTimeout(attachTimer);
      window.removeEventListener("pointerdown", handleClickOutside, true);
      window.removeEventListener("click", handleClickOutside, true);
    };
  }, [animState, updateOpen]);

  // Keyboard navigation (Escape & Arrow Keys)
  useEffect(() => {
    if (animState === "closed") return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        updateOpen(false);
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const menu = menuRef.current;
        if (!menu) return;

        const items = Array.from(
          menu.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')
        );
        if (!items.length) return;

        const currentIndex = items.indexOf(document.activeElement);
        let nextIndex = 0;

        if (event.key === "ArrowDown") {
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }

        items[nextIndex]?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [animState, updateOpen]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toggle = () => {
    updateOpen(animState === "closed" || animState === "closing");
  };

  const close = () => updateOpen(false);
  const openMenu = () => updateOpen(true);

  // Render trigger element
  const renderTrigger = () => {
    if (typeof trigger === "function") {
      return trigger({
        isOpen: animState === "open" || animState === "opening",
        animState,
        open: openMenu,
        close,
        toggle,
      });
    }

    if (React.isValidElement(trigger)) {
      return React.cloneElement(trigger, {
        onClick: (e) => {
          if (trigger.props.onClick) trigger.props.onClick(e);
          toggle();
        },
        "aria-expanded": animState === "open" || animState === "opening",
        "aria-haspopup": "true",
      });
    }

    return (
      <button
        type="button"
        className="hc-dropdown-trigger-default"
        onClick={toggle}
        aria-expanded={animState === "open" || animState === "opening"}
        aria-haspopup="true"
      >
        {trigger}
      </button>
    );
  };

  const placementClass = `hc-dropdown-menu--${placement}`;
  const variantClass = variant === "light" ? "hc-dropdown-menu--light" : "hc-dropdown-menu--dark";
  const animClass = `is-${animState}`;

  return (
    <div className={`hc-dropdown-wrap ${className}`} ref={containerRef}>
      {renderTrigger()}

      {/* Menu Container */}
      <div
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`hc-dropdown-menu ${placementClass} ${variantClass} ${animClass}`}
        style={style}
      >
        {typeof children === "function"
          ? children({ close, animState, isRevealed: animState === "open" || animState === "opening" })
          : children}
      </div>
    </div>
  );
}

export default DropdownMenu;
