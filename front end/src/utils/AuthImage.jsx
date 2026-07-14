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

const isApiImageUrl = (imageUrl) => {
  if (!imageUrl) return false;

  try {
    const candidate = new URL(imageUrl, window.location.origin);
    const assetOrigin = new URL(API_ASSET_BASE_URL, window.location.origin).origin;
    return candidate.origin === assetOrigin || candidate.origin === window.location.origin;
  } catch {
    return false;
  }
};

const shouldUseDirectImage = (imageUrl) => {
  if (!imageUrl) return false;

  const normalized = String(imageUrl).trim().toLowerCase();
  return normalized.startsWith("data:") || normalized.startsWith("blob:");
};

const isStaticAssetImageUrl = (imageUrl) => {
  if (!imageUrl) return false;

  try {
    const candidate = new URL(imageUrl, window.location.origin);
    return /^\/images\//i.test(candidate.pathname);
  } catch {
    return /^\/?images\//i.test(String(imageUrl).trim());
  }
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

    if (shouldUseDirectImage(imageSrc) || isStaticAssetImageUrl(imageSrc)) {
      setResolvedSrc(imageSrc);
      return () => {
        active = false;
      };
    }

    const token = getStoredAuthToken();

    if (isApiImageUrl(imageSrc) && token) {
      const loadImage = async () => {
        try {
          const response = await fetch(imageSrc, {
            headers: {
              Authorization: `Bearer ${token}`,
              "ngrok-skip-browser-warning": "true",
            },
          });

          if (!response.ok) {
            throw new Error(`Image request failed with status ${response.status}`);
          }

          const blob = await response.blob();
          if (!active) return;

          objectUrl = URL.createObjectURL(blob);
          setResolvedSrc(objectUrl);
          return;
        } catch (error) {
          if (active) {
            console.log("Image fetch failed:", imageSrc, error);
            setResolvedSrc(imageSrc);
          }
        }
      };

      loadImage();
    } else {
      setResolvedSrc(imageSrc);
    }

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
