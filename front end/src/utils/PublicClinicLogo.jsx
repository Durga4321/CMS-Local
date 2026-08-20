import React, { useEffect, useMemo, useState } from "react";
import { assetUrl } from "../config/api";
import { getDefaultClinicLogo, getPublicClinicLogoUrl } from "./clinicBranding";

const readLogoValue = (data) => {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return readLogoValue(data[0]);

  const source =
    data.data && typeof data.data === "object" && !Array.isArray(data.data)
      ? data.data
      : data;

  return (
    source.logoUrl ||
    source.LogoUrl ||
    source.logoPath ||
    source.LogoPath ||
    source.logoFilePath ||
    source.LogoFilePath ||
    source.logoFileName ||
    source.LogoFileName ||
    source.logo ||
    source.Logo ||
    source.fileUrl ||
    source.FileUrl ||
    source.url ||
    source.Url ||
    ""
  );
};

const resolveLogoUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
  return assetUrl(raw);
};

function PublicClinicLogo({ clinicId, clinicName, alt = "" }) {
  const fallbackLogo = useMemo(
    () => getDefaultClinicLogo(clinicName, clinicId),
    [clinicId, clinicName]
  );
  const publicLogoUrl = useMemo(() => getPublicClinicLogoUrl(clinicId), [clinicId]);
  const [src, setSrc] = useState(fallbackLogo);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    setSrc(fallbackLogo);

    const loadLogo = async () => {
      if (!publicLogoUrl) return;

      try {
        const response = await fetch(publicLogoUrl, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (!response.ok) return;

        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (contentType.startsWith("image/")) {
          const blob = await response.blob();
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
          return;
        }

        const text = await response.text();
        if (!text) return;
        let data = text;
        try {
          data = JSON.parse(text);
        } catch {
          // Plain text logo paths are valid too.
        }

        const logoUrl = resolveLogoUrl(readLogoValue(data));
        if (active && logoUrl) setSrc(logoUrl);
      } catch {
        if (active) setSrc(fallbackLogo);
      }
    };

    loadLogo();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fallbackLogo, publicLogoUrl]);

  return (
    <img
      src={src}
      alt={alt}
      onError={() => {
        if (src !== fallbackLogo) setSrc(fallbackLogo);
      }}
    />
  );
}

export default PublicClinicLogo;
