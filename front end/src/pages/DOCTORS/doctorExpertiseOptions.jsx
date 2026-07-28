export const SPECIALIZATION_EXPERTISE_MAP = {
  Cardiology: [
    "Heart Diseases",
    "Coronary Artery Disease",
    "Heart Failure",
    "Arrhythmias",
    "Hypertension",
    "Preventive Cardiology",
    "Cardiac Rehabilitation",
  ],
  Dentist: [
    "Tooth Extraction",
    "Root Canal Treatment",
    "Dental Implants",
    "Cosmetic Dentistry",
    "Gum Disease Treatment",
  ],
  Dermatology: [
    "Skin Diseases",
    "Hair Disorders",
    "Nail Disorders",
    "Acne Treatment",
    "Psoriasis",
    "Eczema",
  ],
  ENT: [
    "Ear Disorders",
    "Hearing Loss",
    "Sinus Diseases",
    "Nose Disorders",
    "Throat Disorders",
    "Voice Disorders",
  ],
  "General Specialist": [
    "Diabetes",
    "Hypertension",
    "Fever Management",
    "Infectious Diseases",
    "Lifestyle Disorders",
    "Preventive Health",
  ],
  Gynecology: [
    "Pregnancy Care",
    "High-Risk Pregnancy",
    "Infertility",
    "Menstrual Disorders",
    "PCOS",
    "Gynecological Surgery",
  ],
  Gastroenterology: [
    "Liver Diseases",
    "Pancreatic Disorders",
    "Acid Reflux",
    "Inflammatory Bowel Disease",
    "Endoscopy",
    "ERCP",
  ],
  Nephrology: [
    "Kidney Diseases",
    "Dialysis",
    "Hypertension",
    "Electrolyte Disorders",
    "Chronic Kidney Disease",
  ],
  Neurology: [
    "Stroke",
    "Epilepsy",
    "Headache Disorders",
    "Parkinson's Disease",
    "Neuromuscular Disorders",
    "Multiple Sclerosis",
  ],
  Orthopedics: [
    "Joint Replacement",
    "Sports Injuries",
    "Fractures",
    "Spine Disorders",
    "Arthritis Treatment",
  ],
  Ophthalmology: [
    "Cataract Surgery",
    "Glaucoma",
    "Retina Disorders",
    "Corneal Diseases",
    "Vision Correction",
  ],
  Pediatrics: [
    "Child Health",
    "Vaccination",
    "Growth Disorders",
    "Childhood Infections",
    "Nutrition",
  ],
  Physiotherapy: [
    "Rehabilitation",
    "Sports Rehabilitation",
    "Stroke Rehabilitation",
    "Orthopedic Rehabilitation",
    "Pain Relief",
  ],
  Psychiatry: [
    "Depression",
    "Anxiety Disorders",
    "Bipolar Disorder",
    "Schizophrenia",
    "Addiction Medicine",
  ],
  Pulmonology: [
    "Asthma",
    "COPD",
    "Lung Infections",
    "Sleep Disorders",
    "Bronchoscopy",
    "Interstitial Lung Disease",
  ],
  Urology: [
    "Kidney Stones",
    "Prostate Disorders",
    "Urinary Infections",
    "Bladder Disorders",
    "Urologic Surgery",
  ],
  Radiology: [
    "MRI Reporting",
    "CT Reporting",
    "Ultrasound",
    "Mammography",
    "X-Ray Interpretation",
    "Interventional Imaging",
  ],
};

export const SPECIALIZATION_OPTIONS = Object.keys(SPECIALIZATION_EXPERTISE_MAP);

const SPECIALIZATION_DISPLAY_NAMES = {
  "Cardiothoracic & Vascular Surgery": "Heart And Vascular Specialist",
  "Dental Surgery": "Dentist",
  "Dermatology & Venereology": "Dermatology",
  "ENT (Otorhinolaryngology)": "ENT",
  "Gastrointestinal Surgery": "Gastroenterologist",
  "Medical Gastroenterology": "Gastroenterology",
  "General & Laparoscopic Surgery": "General Specialist",
  "Gynaecology & Obstetrics": "Gynecology",
  "Nephrology & Dialysis": "Nephrology",
  Neurosurgery: "Neurologist",
  "Orthopaedic Surgery & Joint Replacements": "Orthopaedist",
  Paediatrics: "Pediatrics",
  "Oro Maxillofacial Surgery": "Dental And Face Specialist",
  "Plastic & Reconstructive Surgery": "Plastic Specialist",
  "Respiratory Medicine / Pulmonology": "Pulmonology",
  "Surgical Oncology": "Cancer Specialist",
  "Vascular Surgery": "Vascular Specialist",
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const SPECIALIZATION_ALIASES = {
  "cardiothoracic and cardiovascular surgery": "Cardiothoracic & Vascular Surgery",
  "dental surgery": "Dentist",
  "dental and maxillofacial surgery": "Dentist",
  "dermatology and venereology": "Dermatology",
  "ent otorhinolaryngology": "ENT",
  "general medicine": "General Specialist",
  "gynaecology and obstetrics": "Gynecology",
  "obstetrics and gynaecology": "Gynecology",
  paediatrics: "Pediatrics",
  "orthopaedic surgery and joint replacements": "Orthopedics",
  "plastic and cosmetic surgery": "Plastic & Reconstructive Surgery",
  "respiratory medicine pulmonology": "Pulmonology",
  "medical gastroenterology": "Gastroenterology",
  "gastrointestinal surgery": "Gastroenterology",
  "surgical gastroenterology laparoscopic and mis": "Gastroenterology",
  "vascular and endovascular surgery": "Vascular Surgery",
};

export const getCanonicalSpecialization = (specialization) => {
  const normalized = normalizeKey(specialization);
  if (!normalized) return "";

  const exact = SPECIALIZATION_OPTIONS.find(
    (option) => normalizeKey(option) === normalized
  );

  return exact || SPECIALIZATION_ALIASES[normalized] || "";
};

export const getSpecializationDisplayName = (specialization) => {
  const canonical = getCanonicalSpecialization(specialization) || String(specialization || "").trim();
  return SPECIALIZATION_DISPLAY_NAMES[canonical] || canonical;
};

export const getExpertiseOptionsForSpecialization = (specialization) => {
  const canonical = getCanonicalSpecialization(specialization);
  return canonical ? SPECIALIZATION_EXPERTISE_MAP[canonical] || [] : [];
};
