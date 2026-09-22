import React, {
  useEffect,
  useState,
} from "react";
import { API_ASSET_BASE_URL } from "../config/api";


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
    String(imageUrl)
      .trim()
      .replace(/\\/g, "/")
      .replace(/^[a-z]:\/+[^/]*\/+/i, "/")
      .replace(/^.*?wwwroot\//i, "/");

  if (/^(data:|blob:)/i.test(cleanUrl)) {
    return cleanUrl;
  }

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

    // Use image URLs directly. Browser image loading avoids the CORS preflight/fetch
    // failures that appear when static assets are requested with auth headers.
    setResolvedSrc(imageSrc);

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

