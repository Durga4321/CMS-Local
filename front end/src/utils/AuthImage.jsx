import React, {
  useEffect,
  useState,
} from "react";
import { API_ASSET_BASE_URL, apiUrl } from "../config/api";
import { getApiHeaders } from "./branchApi";


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
  authenticatedFallback = false,
}) {
  const [retrySrc, setRetrySrc] = useState("");
  const retry = retrySrc === resolveApiImageUrl(src);
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
    if (retry && authenticatedFallback && !shouldUseDirectImage(imageSrc)) {
      const imageOrigin = new URL(imageSrc, window.location.origin).origin;
      const trustedOrigins = [new URL(apiUrl(""), window.location.origin).origin, new URL(API_ASSET_BASE_URL, window.location.origin).origin];
      fetch(imageSrc, { headers: trustedOrigins.includes(imageOrigin) ? getApiHeaders() : {} })
        .then(response => {
          if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("Image unavailable");
          return response.blob();
        })
        .then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setResolvedSrc(objectUrl); } })
        .catch(() => { if (active) setFailed(true); });
    } else setResolvedSrc(imageSrc);

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageSrc, retry, authenticatedFallback]);

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
        if (authenticatedFallback && !retry && !shouldUseDirectImage(imageSrc)) setRetrySrc(imageSrc);
        else setFailed(true);
      }}
    />
  );
}

export default AuthImage;

