import React, { useEffect, useState } from "react";
import { Check, Palette, Pipette, X } from "lucide-react";
import { applyTheme, getSavedTheme, THEME_OPTIONS } from "../theme/theme";
import "./ThemePicker.css";

function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(getSavedTheme());
  const [customOpen, setCustomOpen] = useState(false);
  const [customColor, setCustomColor] = useState(getSavedTheme().color);

  useEffect(() => {
    const handleThemeChange = (event) => setSelected(event.detail || getSavedTheme());
    window.addEventListener("cms-theme-change", handleThemeChange);
    return () => window.removeEventListener("cms-theme-change", handleThemeChange);
  }, []);

  const chooseTheme = (theme) => {
    setCustomOpen(false);
    setSelected(applyTheme(theme));
  };

  const chooseCustomTheme = () => {
    const color = customColor.trim();
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;

    const customTheme = {
      id: "custom",
      name: "Custom",
      color,
      dark: color,
      soft: `${color}1a`,
      glow: `${color}45`,
    };
    setSelected(applyTheme(customTheme));
  };

  return (
    <div className="theme-picker">
      <button
        className="theme-picker-trigger"
        type="button"
        aria-label="Choose theme colour"
        title="Choose theme colour"
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={19} />
      </button>

      {open ? (
        <div className="theme-picker-popover" role="dialog" aria-label="Choose a theme colour">
          <div className="theme-picker-header">
            <div>
              <strong>Pick a theme colour</strong>
              <span>Choose a light professional palette for your application.</span>
            </div>
            <button type="button" className="theme-picker-close" aria-label="Close theme picker" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="theme-picker-grid">
            {THEME_OPTIONS.map((theme) => (
              <button
                type="button"
                className={`theme-option${selected.id === theme.id ? " is-selected" : ""}`}
                key={theme.id}
                onClick={() => chooseTheme(theme)}
              >
                <span className="theme-option-swatch" style={{ background: `linear-gradient(180deg, ${theme.soft} 0 52%, ${theme.color} 52%)` }} />
                <span>{theme.name}</span>
                {selected.id === theme.id ? <Check className="theme-option-check" size={14} /> : null}
              </button>
            ))}
            <button type="button" className={`theme-option${selected.id === "custom" ? " is-selected" : ""}`} onClick={() => setCustomOpen((value) => !value)}>
              <span className="theme-option-custom"><Pipette size={17} /></span>
              <span>Custom</span>
              {selected.id === "custom" ? <Check className="theme-option-check" size={14} /> : null}
            </button>
          </div>

          {customOpen ? (
            <div className="theme-custom-picker">
              <strong>Colour picker</strong>
              <div className="theme-custom-controls">
                <input type="color" value={customColor} onChange={(event) => setCustomColor(event.target.value)} aria-label="Custom theme colour" />
                <input type="text" value={customColor} onChange={(event) => setCustomColor(event.target.value)} aria-label="Custom theme hex value" maxLength={7} />
                <button type="button" onClick={chooseCustomTheme}>Apply</button>
              </div>
            </div>
          ) : null}

          <button type="button" className="theme-picker-done" onClick={() => setOpen(false)}>Done</button>
        </div>
      ) : null}
    </div>
  );
}

export default ThemePicker;

