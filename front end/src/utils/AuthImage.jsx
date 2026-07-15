import React, {
  useEffect,
  useState,
} from "react";
import { API_ASSET_BASE_URL } from "../config/api";

const getStoredAuthToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("adminToken") ||
  localStorage.getItem("doctorToken") ||
  localStorage.getItem("receptionistToken") ||
  "";



const shouldUseDirectImage = (imageUrl) => {
  if (!imageUrl) return false;

  const normalized = String(imageUrl).trim().toLowerCase();
  return normalized.startsWith("data:") || normalized.startsWith("blob:");
};



// =========================================
// IMAGE URL FIXER
// =========================================

export const resolveApiImageUrl = (
  imageUrl
) => {
  if (!imageUrl) {
    return "";
  }

  const cleanUrl =
    String(imageUrl).trim();

  const normalizeUrl = (value) => {
    try {
      return new URL(value).toString();
    } catch {
      return encodeURI(value);
    }
  };

  const buildAssetUrl = (path) => {
    const cleanPath = String(path || "").trim();

    if (!cleanPath) {
      return "";
    }

    const pathWithSlash = cleanPath.startsWith("/")
      ? cleanPath
      : `/${cleanPath}`;

    return normalizeUrl(`${API_ASSET_BASE_URL}${pathWithSlash}`);
  };

  // =====================================
  // FULL URL
  // =====================================

  if (
    cleanUrl.startsWith("http://") ||
    cleanUrl.startsWith("https://")
  ) {
    return normalizeUrl(cleanUrl);
  }

  // =====================================
  // RELATIVE URL
  // =====================================

  if (
    cleanUrl.startsWith("/")
  ) {
    return buildAssetUrl(cleanUrl);
  }

  // =====================================
  // DEFAULT
  // =====================================

  return buildAssetUrl(cleanUrl);
};

// =========================================
// COMPONENT
// =========================================

function AuthImage({
  src,
  alt,
  className,
  style,
  fallback,
}) {
  const [failed, setFailed] =
    useState(false);
  const [resolvedSrc, setResolvedSrc] =
    useState("");

  const imageSrc =
    resolveApiImageUrl(src);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    setFailed(false);
    setResolvedSrc("");

    if (!imageSrc) {
      return () => {
        active = false;
      };
    }

    // Blob, data, and localhost URLs: use directly
    if (shouldUseDirectImage(imageSrc) || imageSrc.includes("localhost")) {
      setResolvedSrc(imageSrc);
      return () => {
        active = false;
      };
    }

    // All other URLs (API images via ngrok, etc.): fetch with headers
    const loadImage = async () => {
      try {
        const token = getStoredAuthToken();
        const headers = {
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const response = await fetch(imageSrc, { headers });

        if (!response.ok) {
          throw new Error(`Image request failed with status ${response.status}`);
        }

        const blob = await response.blob();
        if (!active) return;

        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      } catch (error) {
        if (active) {
          console.log("Image fetch failed:", imageSrc, error);
          // Fallback: try direct src
          setResolvedSrc(imageSrc);
        }
      }
    };

    loadImage();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageSrc]);

  // =====================================
  // FALLBACK
  // =====================================

  if (!resolvedSrc || failed) {
    return fallback || null;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        console.log(
          "Image failed:",
          resolvedSrc
        );

        setFailed(true);
      }}
    />
  );
}

export default AuthImage;
