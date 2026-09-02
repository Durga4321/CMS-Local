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
      <header className="ds-head">
        <div>
          <h2>{selfMode ? "My Schedule" : "Doctor Schedule"}</h2>
          <p>Recurring hours, leave, same-day time changes and branch shifts are validated by the backend.</p>
        </div>
      </header>

      {error ? <div className="ds-alert error">{error}</div> : null}
      {message ? <div className="ds-alert success">{message}</div> : null}

      <div className="ds-grid">
        <div className="ds-card">
          <h3>1. Recurring schedule</h3>
          <label>Branch<select value={branchId} onChange={(e) => { setBranchId(e.target.value); if (!selfMode) setDoctorId(""); setSourceBranchId(e.target.value); setPreviewBranchId(e.target.value); }}>
            <option value="">Select Branch</option>{assignedBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
          {!selfMode ? <label>Doctor<select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Select Doctor</option>{doctors.map((d) => <option key={doctorIdOf(d)} value={doctorIdOf(d)}>{d.name || d.doctorName || doctorIdOf(d)}</option>)}
          </select></label> : null}
          <div className="ds-days">{DAYS.map((d) => <button type="button" key={d} className={days.includes(d) ? "active" : ""} onClick={() => toggleDay(d)} disabled={scheduleId ? !canEditSchedule : !canCreateSchedule}>{d.slice(0,3)}</button>)}</div>
          <div className="ds-two"><label>Start date<input type="date" min={todayKey()} value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={scheduleId ? !canEditSchedule : !canCreateSchedule} /></label><label>End date<input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={scheduleId ? !canEditSchedule : !canCreateSchedule} /></label></div>
          <div className="ds-two"><label>Work start<input value={workStart} onChange={(e) => setWorkStart(e.target.value)} disabled={scheduleId ? !canEditSchedule : !canCreateSchedule} /></label><label>Work end<input value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} disabled={scheduleId ? !canEditSchedule : !canCreateSchedule} /></label></div>
          <div className="ds-two"><label>Break start<input value={breakStart} onChange={(e) => setBreakStart(e.target.value)} disabled={scheduleId ? !canEditSchedule : !canCreateSchedule} /></label><label>Break end<input value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} disabled={scheduleId ? !canEditSchedule : !canCreateSchedule} /></label></div>
          <button className="ds-primary" disabled={saving || (scheduleId ? !canEditSchedule : !canCreateSchedule)} onClick={saveBaseSchedule}>{saving ? "Saving..." : scheduleId ? "Update recurring schedule" : "Save recurring schedule"}</button>
        </div>

        <div className="ds-card">
          <h3>2. One-day change</h3>
          <p className="ds-note">Use this instead of changing the whole monthly schedule. Existing booked appointments are protected.</p>
          <label>Change type<select value={overrideType} onChange={(e) => setOverrideType(e.target.value)}><option value="Leave">Leave</option><option value="TimeChange">Change hours</option><option value="BranchShift">Shift to another branch</option></select></label>
          <label>Date<input type="date" min={todayKey()} value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} /></label>
          {overrideType === "BranchShift" ? <div className="ds-two"><label>From branch<select value={sourceBranchId} onChange={(e) => setSourceBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>To branch<select value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div> : null}
          {overrideType !== "Leave" ? <><div className="ds-two"><label>New/shift start<input value={overrideStart} onChange={(e) => setOverrideStart(e.target.value)} /></label><label>New/shift end<input value={overrideEnd} onChange={(e) => setOverrideEnd(e.target.value)} /></label></div><div className="ds-two"><label>Break start (optional)<input value={overrideBreakStart} onChange={(e) => setOverrideBreakStart(e.target.value)} /></label><label>Break end (optional)<input value={overrideBreakEnd} onChange={(e) => setOverrideBreakEnd(e.target.value)} /></label></div></> : null}
          <label>Reason<textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Leave reason / branch shift reason" /></label>
          <button className="ds-primary" disabled={saving || (editingOverrideId ? !canEditSchedule : !canCreateSchedule)} onClick={saveOverride}>{editingOverrideId ? "Update change" : "Save change"}</button>
          {editingOverrideId ? <button className="ds-secondary" onClick={() => setEditingOverrideId("")}>Cancel edit</button> : null}
        </div>

        <div className="ds-card ds-preview-card">
          <h3>3. Effective slot preview</h3>
          <div className="ds-two"><label>Date<input type="date" min={todayKey()} value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} /></label><label>Branch<select value={previewBranchId} onChange={(e) => setPreviewBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div>
          <button className="ds-secondary" onClick={previewSlots}>Refresh slots</button>
          {slotMessage ? <p className="ds-note">{slotMessage}</p> : null}
          <div className="ds-slots">{slots.length ? slots.map((s, i) => <div key={`${s.start}-${i}`} className={`ds-slot ${String(s.status).toLowerCase() === "booked" ? "booked" : "available"}`}><strong>{s.start} - {s.end}</strong><span>{s.status}</span><small>{s.source || "Schedule"}</small></div>) : <div className="ds-empty">No slots for this branch/date.</div>}</div>
        </div>
      </div>

      <div className="ds-card ds-overrides-card">
        <h3>Upcoming leave / time / branch changes</h3>
        <div className="ds-table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Branch</th><th>From Branch</th><th>Time</th><th>Reason</th><th>Actions</th></tr></thead><tbody>
          {overrides.length ? overrides.map((o) => {
            const id = recordIdOf(o);
            const type = overrideTypeOf(o);
            const date = fieldOf(o, "date", "Date");
            const targetBranch = String(fieldOf(o, "branchId", "BranchId") || "");
            const sourceBranch = String(fieldOf(o, "sourceBranchId", "SourceBranchId") || "");
            const start = fieldOf(o, "workStart", "WorkStart");
            const end = fieldOf(o, "workEnd", "WorkEnd");
            return <tr key={id}><td>{String(date).slice(0,10)}</td><td>{type}</td><td>{branches.find((b) => b.id === targetBranch)?.name || targetBranch || "All"}</td><td>{branches.find((b) => b.id === sourceBranch)?.name || sourceBranch || "-"}</td><td>{start ? `${start} - ${end}` : "All day"}</td><td>{fieldOf(o, "reason", "Reason") || "-"}</td><td>{canEditSchedule ? <button onClick={() => editOverride(o)}>Edit</button> : null}{canDeleteSchedule ? <button className="danger" onClick={() => deleteOverride(id)}>Delete</button> : null}</td></tr>;
          }) : <tr><td colSpan="7">No upcoming changes.</td></tr>}
        </tbody></table></div>
      </div>
    </section>
  );
}

export default DoctorSchedule;
