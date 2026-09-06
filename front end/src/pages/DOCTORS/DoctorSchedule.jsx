import React, { useEffect, useMemo, useState } from "react";
import "./DoctorSchedule.css";
import { apiUrl } from "../../config/api";
import {
  fetchBranchesForHospital,
  buildBranchOptions,
  getStoredHospitalId,
  getAuthToken,
} from "../../utils/branchApi";
import { getLoggedInDoctor } from "../../doctors/utils/doctorSession";
import { getRoleProfile } from "../../profile/sessionProfile";
import { canUseModulePermission, useRolePermissionsSync } from "../../utils/rolePermissions";
import {
  CalendarClock,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ShieldCheck,
  Zap,
  Edit3,
  Trash2,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const formatLocalDateInput = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
};
const todayKey = () => formatLocalDateInput(new Date());
const plusDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDateInput(d);
};

const headers = () => ({
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
  ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
});

const parseList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.branches)) return data.branches;
  return [];
};

const readError = async (response, fallback) => {
  const data = await response.json().catch(() => null);
  return data?.message || data?.title || fallback;
};

const request = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (!response.ok) throw new Error(await readError(response, "Request failed."));
  return response.status === 204 ? null : response.json().catch(() => ({}));
};

const overrideApiPath = (type, id = "") => {
  const suffix = id ? `/${encodeURIComponent(String(id))}` : "";
  if (type === "Leave") return `Schedule/overrides/leave${suffix}`;
  if (type === "TimeChange") return `Schedule/overrides/time-change${suffix}`;
  if (type === "BranchShift") return `Schedule/overrides/branch-shift${suffix}`;
  return `Schedule/overrides${suffix}`;
};

const branchIdOf = (b) => String(b?.branchId ?? b?.BranchId ?? b?.id ?? b?.Id ?? "");
const branchNameOf = (b) => b?.branchName ?? b?.BranchName ?? b?.name ?? b?.Name ?? `Branch ${branchIdOf(b)}`;
const doctorIdOf = (d) => String(d?.doctorId ?? d?.DoctorId ?? d?.id ?? d?.Id ?? "");
const recordIdOf = (item) => String(item?.id ?? item?.Id ?? "");
const overrideTypeOf = (o) => o?.overrideType ?? o?.OverrideType ?? o?.type ?? o?.Type ?? "";
const fieldOf = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];

function DoctorSchedule({ selfMode = false }) {
  const loggedDoctor = getLoggedInDoctor();
  const doctorRoleProfile = getRoleProfile("doctor");
  const permissionProfile = selfMode
    ? {
        ...doctorRoleProfile,
        doctorId: loggedDoctor.id,
        email: loggedDoctor.email || doctorRoleProfile.email,
        name: loggedDoctor.name || doctorRoleProfile.name,
        role: "Doctor",
      }
    : getRoleProfile("admin");
  const permissionModule = selfMode ? "My Schedule" : "Doctors";
  useRolePermissionsSync(permissionProfile);
  const canCreateSchedule = canUseModulePermission(permissionProfile, permissionModule, "Create");
  const canEditSchedule = canUseModulePermission(permissionProfile, permissionModule, "Edit");
  const canDeleteSchedule = canUseModulePermission(permissionProfile, permissionModule, "Delete");
  const [branches, setBranches] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState(selfMode ? String(loggedDoctor?.id || "") : "");
  const [scheduleId, setScheduleId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [days, setDays] = useState(DAYS.slice(0, 5));
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(plusDays(30));
  const [workStart, setWorkStart] = useState("09:00 AM");
  const [workEnd, setWorkEnd] = useState("06:00 PM");
  const [breakStart, setBreakStart] = useState("01:00 PM");
  const [breakEnd, setBreakEnd] = useState("02:00 PM");

  const [overrideType, setOverrideType] = useState("Leave");
  const [overrideDate, setOverrideDate] = useState(todayKey());
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [overrideStart, setOverrideStart] = useState("02:00 PM");
  const [overrideEnd, setOverrideEnd] = useState("06:00 PM");
  const [overrideBreakStart, setOverrideBreakStart] = useState("");
  const [overrideBreakEnd, setOverrideBreakEnd] = useState("");
  const [reason, setReason] = useState("");
  const [overrides, setOverrides] = useState([]);
  const [editingOverrideId, setEditingOverrideId] = useState("");

  const [previewDate, setPreviewDate] = useState(todayKey());
  const [previewBranchId, setPreviewBranchId] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotMessage, setSlotMessage] = useState("");

  const assignedBranches = useMemo(() => branches, [branches]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (selfMode) {
          const id = String(loggedDoctor?.id || "");
          if (!id) return;
          const data = await request(`Doctor/${id}/branches`);
          const list = parseList(data).map((b) => ({ id: branchIdOf(b), name: branchNameOf(b) })).filter((b) => b.id);
          if (!active) return;
          setBranches(list);
          const initial = String(localStorage.getItem("doctorBranchId") || loggedDoctor?.branchId || list[0]?.id || "");
          setBranchId(initial);
          setSourceBranchId(initial);
          setTargetBranchId(list.find((b) => b.id !== initial)?.id || initial);
          setPreviewBranchId(initial);
        } else {
          const raw = await fetchBranchesForHospital(getStoredHospitalId());
          const list = buildBranchOptions(raw).map((b) => ({ id: String(b.value ?? b.id ?? b.branchId), name: b.label ?? b.name ?? b.branchName })).filter((b) => b.id);
          if (!active) return;
          setBranches(list);
          setBranchId("");
          setDoctorId("");
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    };
    load();
    return () => { active = false; };
  }, [selfMode]);

  useEffect(() => {
    if (selfMode) return;
    let active = true;
    request("Doctor")
      .then((data) => {
        const allDoctors = parseList(data);
        const list = branchId ? allDoctors.filter((d) => {
          const direct = String(d.branchId ?? d.BranchId ?? "");
          const ids = [...(d.branchIds || d.BranchIds || []), ...(d.branches || []).map(branchIdOf)].map(String);
          return direct === String(branchId) || ids.includes(String(branchId));
        }) : allDoctors;
        if (!active) return;
        setDoctors(list);
      })
      .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [branchId, selfMode]);

  const loadSchedule = async () => {
    if (!doctorId || !branchId) return;
    try {
      const data = await request(`Schedule/doctor/${doctorId}?branchId=${branchId}`);
      if (!data?.exists) {
        setScheduleId("");
        setMessage("No recurring schedule yet for this doctor and branch.");
        return;
      }
      setScheduleId(String(data.id || data.scheduleId || ""));
      setDays(Array.isArray(data.days) ? data.days : DAYS.slice(0, 5));
      setStartDate(String(data.startDate || todayKey()).slice(0, 10));
      setEndDate(String(data.endDate || plusDays(30)).slice(0, 10));
      setWorkStart(data.workStart || "09:00 AM");
      setWorkEnd(data.workEnd || "06:00 PM");
      setBreakStart(data.breakStart || "01:00 PM");
      setBreakEnd(data.breakEnd || "02:00 PM");
      setMessage("Existing recurring schedule loaded. You can edit and update it.");
    } catch (e) {
      setError(e.message);
    }
  };

  const loadOverrides = async () => {
    if (!doctorId) return;
    try {
      const query = new URLSearchParams({
        doctorId: String(doctorId),
        from: todayKey(),
        to: plusDays(90),
      });
      const data = await request(`Schedule/overrides?${query.toString()}`);
      setOverrides(parseList(data));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    setError(""); setMessage("");
    if (doctorId && branchId) loadSchedule();
    if (doctorId) loadOverrides();
    if (!doctorId || !branchId) setScheduleId("");
  }, [doctorId, branchId]);

  const toggleDay = (day) => setDays((prev) => prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day]);

  const saveBaseSchedule = async () => {
    if (scheduleId ? !canEditSchedule : !canCreateSchedule) return setError("You do not have permission to save this schedule.");
    if (!doctorId || !branchId || !days.length) return setError("Select doctor, branch and at least one working day.");
    setSaving(true); setError(""); setMessage("");
    const payload = { doctorId: Number(doctorId), branchId: Number(branchId), days, startDate, endDate, workStart, workEnd, breakStart, breakEnd };
    try {
      const data = scheduleId
        ? await request(`Schedule/${scheduleId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await request("Schedule", { method: "POST", body: JSON.stringify(payload) });
      setScheduleId(String(data?.scheduleId || scheduleId || ""));
      setMessage(data?.message || "Schedule saved successfully.");
      await loadSchedule();
      await previewSlots();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const saveOverride = async () => {
    if (editingOverrideId ? !canEditSchedule : !canCreateSchedule) return setError("You do not have permission to save schedule changes.");
    if (!doctorId || !overrideDate) return setError("Select doctor and override date.");
    const isShift = overrideType === "BranchShift";
    const branch = isShift ? targetBranchId : branchId;
    const payload = {
      doctorId: Number(doctorId),
      branchId: branch ? Number(branch) : null,
      sourceBranchId: isShift && sourceBranchId ? Number(sourceBranchId) : null,
      date: overrideDate,
      overrideType,
      workStart: overrideType === "Leave" ? null : overrideStart,
      workEnd: overrideType === "Leave" ? null : overrideEnd,
      breakStart: overrideType === "Leave" ? null : (overrideBreakStart || null),
      breakEnd: overrideType === "Leave" ? null : (overrideBreakEnd || null),
      reason,
    };
    setSaving(true); setError(""); setMessage("");
    try {
      let data;
      if (editingOverrideId && overrideType === "Leave") {
        data = await request(overrideApiPath("Leave", editingOverrideId), { method: "PUT", body: JSON.stringify(payload) });
      } else {
        if (editingOverrideId) {
          await request(overrideApiPath(null, editingOverrideId), { method: "DELETE" });
        }
        data = await request(overrideApiPath(overrideType), { method: "POST", body: JSON.stringify(payload) });
      }
      setMessage(data?.message || "Schedule exception saved.");
      setEditingOverrideId(""); setReason("");
      await loadOverrides();
      setPreviewDate(overrideDate); setPreviewBranchId(branch || branchId);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const editOverride = (item) => {
    if (!canEditSchedule) return setError("You do not have permission to edit schedule changes.");
    setEditingOverrideId(recordIdOf(item));
    setOverrideType(overrideTypeOf(item));
    setOverrideDate(String(fieldOf(item, "date", "Date")).slice(0, 10));
    setSourceBranchId(String(fieldOf(item, "sourceBranchId", "SourceBranchId") || branchId || ""));
    setTargetBranchId(String(fieldOf(item, "branchId", "BranchId") || branchId || ""));
    setOverrideStart(fieldOf(item, "workStart", "WorkStart") || "02:00 PM");
    setOverrideEnd(fieldOf(item, "workEnd", "WorkEnd") || "06:00 PM");
    setOverrideBreakStart(fieldOf(item, "breakStart", "BreakStart") || "");
    setOverrideBreakEnd(fieldOf(item, "breakEnd", "BreakEnd") || "");
    setReason(fieldOf(item, "reason", "Reason") || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteOverride = async (id) => {
    if (!canDeleteSchedule) return setError("You do not have permission to delete schedule changes.");
    if (!window.confirm("Remove this schedule exception?")) return;
    try {
      const item = overrides.find((o) => recordIdOf(o) === String(id));
      const data = await request(overrideApiPath(overrideTypeOf(item), id), { method: "DELETE" });
      setMessage(data?.message || "Override removed.");
      await loadOverrides();
    } catch (e) { setError(e.message); }
  };

  const previewSlots = async () => {
    if (!doctorId || !previewBranchId || !previewDate) return;
    try {
      const data = await request(`Schedule/day-slots?doctorId=${doctorId}&branchId=${previewBranchId}&date=${previewDate}`);
      setSlots(parseList(data?.slots ?? data));
      setSlotMessage(data?.message || "");
    } catch (e) { setSlots([]); setSlotMessage(e.message); }
  };

  useEffect(() => { if (doctorId && previewBranchId && previewDate) previewSlots(); }, [doctorId, previewBranchId, previewDate, overrides.length]);

  return (
    <section className="doctor-schedule-page">
      {/* ── Medical & Surgical Telemetry Background ── */}
      <div className="ds-medical-bg" aria-hidden="true">
        <div className="ds-ecg-track">
          <svg className="ds-ecg-svg" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path
              className="ds-ecg-line-base"
              d="M 0,40 L 180,40 L 195,35 L 205,45 L 215,40 L 240,40 L 250,10 L 262,72 L 274,28 L 284,48 L 295,40 L 330,40 Q 350,24 370,40 L 540,40 L 555,35 L 565,45 L 575,40 L 600,40 L 610,10 L 622,72 L 634,28 L 644,48 L 655,40 L 690,40 Q 710,24 730,40 L 900,40 L 915,35 L 925,45 L 935,40 L 960,40 L 970,10 L 982,72 L 994,28 L 1004,48 L 1015,40 L 1050,40 Q 1070,24 1090,40 L 1200,40"
            />
            <path
              className="ds-ecg-line-pulse"
              d="M 0,40 L 180,40 L 195,35 L 205,45 L 215,40 L 240,40 L 250,10 L 262,72 L 274,28 L 284,48 L 295,40 L 330,40 Q 350,24 370,40 L 540,40 L 555,35 L 565,45 L 575,40 L 600,40 L 610,10 L 622,72 L 634,28 L 644,48 L 655,40 L 690,40 Q 710,24 730,40 L 900,40 L 915,35 L 925,45 L 935,40 L 960,40 L 970,10 L 982,72 L 994,28 L 1004,48 L 1015,40 L 1050,40 Q 1070,24 1090,40 L 1200,40"
            />
          </svg>
        </div>

        <div className="ds-telemetry-bar">
          <div className="ds-telemetry-badge">
            <span className="ds-telemetry-cross">✚</span>
            <span>SURGICAL ROSTER STATION</span>
          </div>
          <div className="ds-telemetry-badge">
            <Activity size={13} className="ds-telemetry-wave-icon" />
            <span>OT DUTY SHIFTS &bull; ACTIVE</span>
          </div>
          <div className="ds-telemetry-badge">
            <span className="ds-telemetry-bead-live" />
            <span>TELEMETRY SYNCHRONIZED</span>
          </div>
        </div>

        <div className="ds-watermark-cross ds-watermark-cross--tl">✚</div>
        <div className="ds-watermark-cross ds-watermark-cross--br">ROSTER</div>
      </div>

      {/* ── Roster Console Header ── */}
      <header className="ds-head">
        <div className="ds-head-content">
          <div className="ds-head-badge">
            <CalendarClock size={16} className="ds-head-icon" />
            <span>SURGICAL & CLINICAL DUTY ROSTER</span>
          </div>
          <h2>{selfMode ? "My Schedule" : "Doctor Schedule"}</h2>
          <p>Recurring hours, leave, same-day time changes and branch shifts are validated by the backend.</p>
        </div>
      </header>

      {error ? (
        <div className="ds-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="ds-alert success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      ) : null}

      <div className="ds-grid">
        {/* ── Card 1: Recurring Schedule (Emerald Accent) ── */}
        <div className="ds-card ds-card--recurring">
          <div className="ds-card-header">
            <div className="ds-card-header-icon ds-icon--emerald">
              <Clock size={18} />
            </div>
            <div>
              <h3>1. Recurring schedule</h3>
              <span className="ds-card-badge">CLINICAL SHIFTS</span>
            </div>
          </div>

          <label>
            Branch
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                if (!selfMode) setDoctorId("");
                setSourceBranchId(e.target.value);
                setPreviewBranchId(e.target.value);
              }}
            >
              <option value="">Select Branch</option>
              {assignedBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          {!selfMode ? (
            <label>
              Doctor
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">Select Doctor</option>
                {doctors.map((d) => (
                  <option key={doctorIdOf(d)} value={doctorIdOf(d)}>
                    {d.name || d.doctorName || doctorIdOf(d)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {/* Working Days Selector Switch Panel */}
          <div className="ds-days-wrapper">
            <span className="ds-sub-label">Operating Days</span>
            <div className="ds-days">
              {DAYS.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`ds-day-btn ${days.includes(d) ? "active" : ""}`}
                  onClick={() => toggleDay(d)}
                  disabled={scheduleId ? !canEditSchedule : !canCreateSchedule}
                  title={`${d}: ${days.includes(d) ? "Active Shift" : "Off Duty"}`}
                >
                  <span className="ds-day-text">{d.slice(0, 3)}</span>
                  <span className="ds-day-indicator" />
                </button>
              ))}
            </div>
          </div>

          <div className="ds-two">
            <label>
              Start date
              <input
                type="date"
                min={todayKey()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={scheduleId ? !canEditSchedule : !canCreateSchedule}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={scheduleId ? !canEditSchedule : !canCreateSchedule}
              />
            </label>
          </div>

          <div className="ds-two">
            <label>
              Work start
              <input
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                disabled={scheduleId ? !canEditSchedule : !canCreateSchedule}
              />
            </label>
            <label>
              Work end
              <input
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                disabled={scheduleId ? !canEditSchedule : !canCreateSchedule}
              />
            </label>
          </div>

          <div className="ds-two">
            <label>
              Break start
              <input
                value={breakStart}
                onChange={(e) => setBreakStart(e.target.value)}
                disabled={scheduleId ? !canEditSchedule : !canCreateSchedule}
              />
            </label>
            <label>
              Break end
              <input
                value={breakEnd}
                onChange={(e) => setBreakEnd(e.target.value)}
                disabled={scheduleId ? !canEditSchedule : !canCreateSchedule}
              />
            </label>
          </div>

          {/* Autoclave Shift Lock Instrument Button */}
          <button
            className="ds-primary ds-instrument--autoclave"
            disabled={saving || (scheduleId ? !canEditSchedule : !canCreateSchedule)}
            onClick={saveBaseSchedule}
            type="button"
            title="Surgical Autoclave Shift Seal"
          >
            <span className="ds-instrument-body">
              <span className="ds-instrument-grip" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <ShieldCheck size={16} className="ds-instrument-icon" />
              <span className="ds-instrument-text">
                {saving ? "Locking Shift..." : scheduleId ? "Update Recurring Schedule" : "Save Recurring Schedule"}
              </span>
              <span className="ds-instrument-bead ds-bead--emerald" aria-hidden="true" />
            </span>
          </button>
        </div>

        {/* ── Card 2: One-Day Change (Amber Accent) ── */}
        <div className="ds-card ds-card--override">
          <div className="ds-card-header">
            <div className="ds-card-header-icon ds-icon--amber">
              <Zap size={18} />
            </div>
            <div>
              <h3>2. One-day change</h3>
              <span className="ds-card-badge ds-badge--amber">DUTY EXCEPTION</span>
            </div>
          </div>

          <p className="ds-note">
            Use this instead of changing the whole monthly schedule. Existing booked appointments are protected.
          </p>

          <label>
            Change type
            <select value={overrideType} onChange={(e) => setOverrideType(e.target.value)}>
              <option value="Leave">Leave</option>
              <option value="TimeChange">Change hours</option>
              <option value="BranchShift">Shift to another branch</option>
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              min={todayKey()}
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
            />
          </label>

          {overrideType === "BranchShift" ? (
            <div className="ds-two">
              <label>
                From branch
                <select value={sourceBranchId} onChange={(e) => setSourceBranchId(e.target.value)}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label>
                To branch
                <select value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {overrideType !== "Leave" ? (
            <>
              <div className="ds-two">
                <label>
                  New/shift start
                  <input value={overrideStart} onChange={(e) => setOverrideStart(e.target.value)} />
                </label>
                <label>
                  New/shift end
                  <input value={overrideEnd} onChange={(e) => setOverrideEnd(e.target.value)} />
                </label>
              </div>
              <div className="ds-two">
                <label>
                  Break start (optional)
                  <input
                    value={overrideBreakStart}
                    onChange={(e) => setOverrideBreakStart(e.target.value)}
                  />
                </label>
                <label>
                  Break end (optional)
                  <input
                    value={overrideBreakEnd}
                    onChange={(e) => setOverrideBreakEnd(e.target.value)}
                  />
                </label>
              </div>
            </>
          ) : null}

          <label>
            Reason
            <textarea
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Leave reason / branch shift reason"
            />
          </label>

          {/* Precision Surgical Scalpel / Exception Applicator Button */}
          <button
            className="ds-primary ds-instrument--scalpel"
            disabled={saving || (editingOverrideId ? !canEditSchedule : !canCreateSchedule)}
            onClick={saveOverride}
            type="button"
            title="Surgical Scalpel Exception Applicator"
          >
            <span className="ds-instrument-body">
              <span className="ds-instrument-grip" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <Zap size={16} className="ds-instrument-icon" />
              <span className="ds-instrument-text">
                {saving ? "Applying Exception..." : editingOverrideId ? "Update Schedule Exception" : "Apply Schedule Exception"}
              </span>
              <span className="ds-instrument-bead ds-bead--amber" aria-hidden="true" />
            </span>
          </button>

          {editingOverrideId ? (
            <button
              className="ds-secondary ds-instrument--cancel"
              onClick={() => setEditingOverrideId("")}
              type="button"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        {/* ── Card 3: Slot Telemetry Preview (Cyan Accent) ── */}
        <div className="ds-card ds-preview-card">
          <div className="ds-card-header">
            <div className="ds-card-header-icon ds-icon--cyan">
              <Layers size={18} />
            </div>
            <div>
              <h3>3. Effective slot preview</h3>
              <span className="ds-card-badge ds-badge--cyan">SLOT TELEMETRY</span>
            </div>
          </div>

          <div className="ds-two">
            <label>
              Date
              <input
                type="date"
                min={todayKey()}
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
              />
            </label>
            <label>
              Branch
              <select value={previewBranchId} onChange={(e) => setPreviewBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Ultrasonic Telemetry Slot Scanner Button */}
          <button
            className="ds-secondary ds-instrument--scanner"
            onClick={previewSlots}
            type="button"
            title="Ultrasonic Telemetry Slot Scanner"
          >
            <span className="ds-instrument-body">
              <RefreshCw size={14} className="ds-instrument-icon" />
              <span className="ds-instrument-text">Refresh Duty Slots</span>
              <span className="ds-instrument-bead ds-bead--cyan" aria-hidden="true" />
            </span>
          </button>

          {slotMessage ? <p className="ds-note">{slotMessage}</p> : null}

          <div className="ds-slots">
            {slots.length ? (
              slots.map((s, i) => (
                <div
                  key={`${s.start}-${i}`}
                  className={`ds-slot ${String(s.status).toLowerCase() === "booked" ? "booked" : "available"}`}
                >
                  <div className="ds-slot-info">
                    <span className="ds-slot-time-badge" />
                    <strong>{s.start} - {s.end}</strong>
                  </div>
                  <span className="ds-slot-status">{s.status}</span>
                  <small>{s.source || "Clinical Schedule"}</small>
                </div>
              ))
            ) : (
              <div className="ds-empty">No clinical duty slots for this branch/date.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Upcoming Exceptions Table Console ── */}
      <div className="ds-card ds-overrides-card">
        <div className="ds-card-header ds-card-header--table">
          <div className="ds-card-header-icon ds-icon--teal">
            <Calendar size={18} />
          </div>
          <div>
            <h3>Upcoming leave / time / branch changes</h3>
            <span className="ds-card-badge">REGISTERED EXCEPTIONS</span>
          </div>
        </div>

        <div className="ds-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Branch</th>
                <th>From Branch</th>
                <th>Time</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overrides.length ? (
                overrides.map((o) => {
                  const id = recordIdOf(o);
                  const type = overrideTypeOf(o);
                  const date = fieldOf(o, "date", "Date");
                  const targetBranch = String(fieldOf(o, "branchId", "BranchId") || "");
                  const sourceBranch = String(fieldOf(o, "sourceBranchId", "SourceBranchId") || "");
                  const start = fieldOf(o, "workStart", "WorkStart");
                  const end = fieldOf(o, "workEnd", "WorkEnd");
                  return (
                    <tr key={id}>
                      <td className="ds-cell-date">{String(date).slice(0, 10)}</td>
                      <td>
                        <span className={`ds-type-badge ds-type--${String(type).toLowerCase()}`}>
                          {type}
                        </span>
                      </td>
                      <td>{branches.find((b) => b.id === targetBranch)?.name || targetBranch || "All"}</td>
                      <td>{branches.find((b) => b.id === sourceBranch)?.name || sourceBranch || "-"}</td>
                      <td>{start ? `${start} - ${end}` : "All day"}</td>
                      <td className="ds-cell-reason">{fieldOf(o, "reason", "Reason") || "-"}</td>
                      <td className="ds-table-actions">
                        {canEditSchedule ? (
                          <button
                            className="ds-action-btn ds-action-btn--edit"
                            onClick={() => editOverride(o)}
                            type="button"
                            title="Micro-Surgical Forceps / Edit Exception"
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>
                        ) : null}
                        {canDeleteSchedule ? (
                          <button
                            className="ds-action-btn ds-action-btn--delete danger"
                            onClick={() => deleteOverride(id)}
                            type="button"
                            title="Biohazard Disposal Clamp / Remove Exception"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="ds-empty-table">No upcoming schedule exceptions recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default DoctorSchedule;

