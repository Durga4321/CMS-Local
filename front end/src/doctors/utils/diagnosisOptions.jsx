import { apiUrl } from "../../config/api";
import { getAuthToken } from "./doctorSession";

const DIAGNOSIS_DROPDOWN_API = apiUrl("Consultation/diagnosis-dropdown");

export const DEFAULT_DIAGNOSIS_OPTIONS = [
  "Acne",
  "Anemia",
  "Anxiety Disorder",
  "Appendicitis",
  "Arrhythmia",
  "Arthritis",
  "Asthma",
  "Aortic Aneurysm",
  "Back Pain",
  "Brain Hemorrhage",
  "Brain Tumor",
  "Breast Cancer",
  "Burn Injury",
  "Cataract",
  "Chronic Kidney Disease (CKD)",
  "Chronic Obstructive Pulmonary Disease (COPD)",
  "Colon Cancer",
  "Congenital Heart Disease",
  "Coronary Artery Disease (CAD)",
  "COVID-19",
  "Dengue",
  "Depression",
  "Diabetes Mellitus",
  "Diabetic Retinopathy",
  "Ear Infection",
  "Eczema",
  "Epilepsy",
  "Fatty Liver Disease",
  "Gallstones",
  "Gastric Ulcer",
  "Gastritis",
  "GERD (Acid Reflux)",
  "Glaucoma",
  "Gout",
  "Heart Attack (Myocardial Infarction)",
  "Heart Failure",
  "Hearing Loss",
  "Hernia",
  "High-Risk Pregnancy",
  "Hypertension",
  "Hypothyroidism",
  "Hyperthyroidism",
  "Inflammatory Bowel Disease (IBD)",
  "Kidney Failure",
  "Kidney Stones",
  "Leukemia",
  "Ligament Injury",
  "Liver Cirrhosis",
  "Liver Failure",
  "Lung Cancer",
  "Lupus (SLE)",
  "Malaria",
  "Migraine",
  "Multiple Sclerosis",
  "Nephrotic Syndrome",
  "Neonatal Jaundice",
  "Neuropathy",
  "Osteoarthritis",
  "Osteoporosis",
  "Ovarian Cyst",
  "Parkinson's Disease",
  "Peptic Ulcer Disease",
  "Peripheral Artery Disease",
  "Pneumonia",
  "Polycystic Ovary Syndrome (PCOS)",
  "Prematurity",
  "Prostate Enlargement (BPH)",
  "Psoriasis",
  "Pulmonary Embolism",
  "Rheumatoid Arthritis",
  "Sepsis",
  "Schizophrenia",
  "Sinusitis",
  "Skin Infection",
  "Spinal Disc Disease",
  "Sports Injury",
  "Stroke",
  "Thyroid Disorders",
  "Tonsillitis",
  "Tuberculosis (TB)",
  "Urinary Tract Infection (UTI)",
  "Varicose Veins",
  "Valve Heart Disease",
  "Viral Fever",
];


const normalizeSpecialization = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

const optionSet = (items) => new Set(items.map((item) => item.toLowerCase()));

const SPECIALIZATION_DIAGNOSIS_MAP = [
  {
    keys: ["cardiology", "cardiologist", "heart"],
    diagnoses: [
      "Arrhythmia",
      "Congenital Heart Disease",
      "Coronary Artery Disease (CAD)",
      "Heart Attack (Myocardial Infarction)",
      "Heart Failure",
      "Hypertension",
      "Peripheral Artery Disease",
      "Pulmonary Embolism",
      "Valve Heart Disease",
    ],
  },
  {
    keys: ["gynecology", "gynaecology", "gynecologist", "obstetrics", "obgyn"],
    diagnoses: [
      "Anemia",
      "High-Risk Pregnancy",
      "Ovarian Cyst",
      "Polycystic Ovary Syndrome (PCOS)",
      "Thyroid Disorders",
      "Urinary Tract Infection (UTI)",
    ],
  },
  {
    keys: ["dermatology", "dermatologist", "skin"],
    diagnoses: ["Acne", "Eczema", "Psoriasis", "Skin Infection", "Lupus (SLE)"],
  },
  {
    keys: ["neurology", "neurologist", "neuro"],
    diagnoses: [
      "Brain Hemorrhage",
      "Brain Tumor",
      "Epilepsy",
      "Migraine",
      "Multiple Sclerosis",
      "Neuropathy",
      "Parkinson's Disease",
      "Stroke",
    ],
  },
  {
    keys: ["orthopedic", "orthopaedic", "ortho"],
    diagnoses: [
      "Arthritis",
      "Back Pain",
      "Gout",
      "Ligament Injury",
      "Osteoarthritis",
      "Osteoporosis",
      "Rheumatoid Arthritis",
      "Spinal Disc Disease",
      "Sports Injury",
    ],
  },
  {
    keys: ["gastroenterology", "gastroenterologist", "gastro", "gastrointestinal"],
    diagnoses: [
      "Appendicitis",
      "Colon Cancer",
      "Fatty Liver Disease",
      "Gallstones",
      "Gastric Ulcer",
      "Gastritis",
      "GERD (Acid Reflux)",
      "Inflammatory Bowel Disease (IBD)",
      "Liver Cirrhosis",
      "Liver Failure",
      "Peptic Ulcer Disease",
    ],
  },
  {
    keys: ["pulmonology", "pulmonologist", "respiratory", "chest"],
    diagnoses: [
      "Asthma",
      "Chronic Obstructive Pulmonary Disease (COPD)",
      "COVID-19",
      "Lung Cancer",
      "Pneumonia",
      "Pulmonary Embolism",
      "Tuberculosis (TB)",
    ],
  },
  {
    keys: ["nephrology", "nephrologist", "urology", "urologist", "kidney"],
    diagnoses: [
      "Chronic Kidney Disease (CKD)",
      "Kidney Failure",
      "Kidney Stones",
      "Nephrotic Syndrome",
      "Prostate Enlargement (BPH)",
      "Urinary Tract Infection (UTI)",
    ],
  },
  {
    keys: ["ent", "ear nose throat"],
    diagnoses: ["Ear Infection", "Hearing Loss", "Sinusitis", "Tonsillitis"],
  },
  {
    keys: ["ophthalmology", "ophthalmologist", "eye"],
    diagnoses: ["Cataract", "Diabetic Retinopathy", "Glaucoma"],
  },
  {
    keys: ["pediatrics", "paediatrics", "pediatrician", "child"],
    diagnoses: [
      "Anemia",
      "Asthma",
      "Dengue",
      "Malaria",
      "Neonatal Jaundice",
      "Pneumonia",
      "Prematurity",
      "Sepsis",
      "Viral Fever",
    ],
  },
  {
    keys: ["psychiatry", "psychiatrist", "psychology"],
    diagnoses: ["Anxiety Disorder", "Depression", "Schizophrenia"],
  },
  {
    keys: ["general medicine", "general physician", "internal medicine", "physician"],
    diagnoses: [
      "Anemia",
      "Anxiety Disorder",
      "Asthma",
      "COVID-19",
      "Dengue",
      "Diabetes Mellitus",
      "Hypertension",
      "Hypothyroidism",
      "Malaria",
      "Thyroid Disorders",
      "Tuberculosis (TB)",
      "Urinary Tract Infection (UTI)",
      "Viral Fever",
    ],
  },
];

const getSpecializationConfig = (specialization) => {
  const normalized = normalizeSpecialization(specialization);
  if (!normalized) return null;

  return SPECIALIZATION_DIAGNOSIS_MAP.find((entry) =>
    entry.keys.some((key) => normalized.includes(key))
  );
};

const filterOptionsByAllowedList = (options, allowedOptions = []) => {
  const list = Array.isArray(options) ? options : [];
  if (!allowedOptions.length) return list;

  const allowed = optionSet(allowedOptions);
  return list.filter((option) => allowed.has(String(option || "").trim().toLowerCase()));
};

export const filterDiagnosisOptionsBySpecialization = (options, specialization) => {
  const config = getSpecializationConfig(specialization);
  return config ? filterOptionsByAllowedList(options, config.diagnoses) : options;
};


const getDiagnosisText = (item) => {
  if (typeof item === "string") return item;

  return item?.diagnosis || item?.name || item?.value || "";
};

export const normalizeDiagnosisOptions = (data) => {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.diagnoses)
        ? data.diagnoses
        : [];

  const seen = new Set();

  return list.reduce((options, item) => {
    const value = String(getDiagnosisText(item) || "").trim();
    const key = value.toLowerCase();

    if (!value || seen.has(key)) return options;

    seen.add(key);
    return [...options, value];
  }, []);
};

export const mergeDiagnosisOption = (options, diagnosis) => {
  const value = String(diagnosis || "").trim();
  if (!value) return Array.isArray(options) ? options : [];

  const list = Array.isArray(options) ? options : [];
  const exists = list.some(
    (option) => option.trim().toLowerCase() === value.toLowerCase()
  );

  return exists ? list : [value, ...list];
};

export const fetchDiagnosisOptions = async (specialization = "") => {
  const token = getAuthToken();
  const headers = {
    "ngrok-skip-browser-warning": "true",
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(DIAGNOSIS_DROPDOWN_API, {
    headers,
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data.message || "Unable to load diagnosis list.");
  }

  return filterDiagnosisOptionsBySpecialization(normalizeDiagnosisOptions(data), specialization);
};

