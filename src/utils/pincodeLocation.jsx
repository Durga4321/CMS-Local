import { apiUrl } from "../config/api";
import { INDIA_COUNTRY } from "./indianLocations";
import { onlyPincodeValue } from "./address";

const API_HEADERS = {
  accept: "application/json",
  "ngrok-skip-browser-warning": "true",
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of ["data", "result", "items", "records", "locations", "postOffices", "areas"]) {
    if (Array.isArray(value[key])) return value[key];
    if (value[key] && typeof value[key] === "object") return [value[key]];
  }

  return [value];
};

const pickValue = (source = {}, keys = []) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
};

const fetchJson = async (url) => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("superAdminToken");

  const response = await fetch(url, {
    headers: {
      ...API_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch location details.");
  }

  return response.json();
};

const normalizePostOffice = (office) => {
  if (typeof office === "string") return { Name: office };
  return office && typeof office === "object" ? office : null;
};

const getPostOffices = (payload) => {
  const records = asArray(payload);
  const nestedPostOffices = records.flatMap((record) =>
    asArray(
      record?.PostOffice ||
      record?.postOffice ||
      record?.PostOffices ||
      record?.postOffices ||
      record?.locations ||
      record?.Locations ||
      record?.areas ||
      record?.Areas ||
      record?.areaOptions ||
      record?.AreaOptions
    )
  );

  if (nestedPostOffices.length) {
    return nestedPostOffices.map(normalizePostOffice).filter(Boolean);
  }

  return records.map(normalizePostOffice).filter(Boolean);
};

const buildLocationFromPostOffices = (postOffices, pincode) => {
  if (!postOffices.length) {
    throw new Error("No location found for this pincode.");
  }

  const firstOffice = postOffices[0] || {};
  const areaOptions = Array.from(
    new Set(
      postOffices
        .map((office) =>
          pickValue(office, [
            "Name",
            "name",
            "Area",
            "area",
            "AreaName",
            "areaName",
            "PostOfficeName",
            "postOfficeName",
            "Locality",
            "locality",
            "Village",
            "village",
            "StreetVillage",
            "streetVillage",
            "Street",
            "street",
          ])
        )
        .filter(Boolean)
    )
  );

  return {
    pincode,
    state: pickValue(firstOffice, ["State", "state", "StateName", "stateName"]),
    city: pickValue(firstOffice, [
      "District",
      "district",
      "DistrictName",
      "districtName",
      "City",
      "city",
      "CityName",
      "cityName",
      "Block",
      "block",
    ]),
    country: pickValue(firstOffice, ["Country", "country"]) || INDIA_COUNTRY,
    village: pickValue(firstOffice, [
      "Village",
      "village",
      "StreetVillage",
      "streetVillage",
      "Street",
      "street",
      "Name",
      "name",
      "Area",
      "area",
      "PostOfficeName",
      "postOfficeName",
    ]),
    area: areaOptions[0] || "",
    areaOptions,
    postOffices,
  };
};

export const fetchPincodeLocation = async (pincode) => {
  const cleanPincode = onlyPincodeValue(pincode);
  if (cleanPincode.length !== 6) {
    throw new Error("Pincode must be exactly 6 digits.");
  }

  const payload = await fetchJson(apiUrl(`Location/pincode/${cleanPincode}`));
  const postOffices = getPostOffices(payload);

  if (postOffices.length) {
    return buildLocationFromPostOffices(postOffices, cleanPincode);
  }

  throw new Error("No location found for this pincode.");
};
