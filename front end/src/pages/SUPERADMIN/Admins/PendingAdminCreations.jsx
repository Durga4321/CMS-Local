import React, { useCallback, useEffect, useState } from "react";
import DataTable from "../../../components/superadmin/DataTable";
import { fetchPendingAdminCreations, fetchPendingAdminCreation, createAdminFromPurchase, formatPurchasedModules } from "../../../utils/subscriptionFlow";
import { useToast } from "../../../components/ToastProvider";
export default function PendingAdminCreations({ onCreated }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows(await fetchPendingAdminCreations()); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const view = async (row) => {
    setBusy(true); setError(""); setSelected(null);
    try { setSelected({ id: row.id, details: await fetchPendingAdminCreation(row.id) }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const create = async () => {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      await createAdminFromPurchase(selected.id);
      setSelected(null); toast.success("Admin created from paid purchase.");
      await load(); await onCreated();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <section className="sa-form-card">
    <div className="sa-subscription-panel-head"><h3>Paid purchases awaiting Admin creation</h3>
      <button type="button" className="sa-btn" onClick={load} disabled={loading || busy}>Refresh</button></div>
    {error ? <div className="sa-state sa-state--error" role="alert">{error}</div> : null}
    <div className="sa-subscription-table-scroll"><DataTable loading={loading} rows={rows} emptyMessage="No paid purchases awaiting Admin creation." columns={[
      { key: "name", label: "Customer", render: row => row.name ?? row.customerName ?? row.Name ?? "-" },
      { key: "email", label: "Email", render: row => row.email ?? row.Email ?? "-" },
      { key: "modules", label: "Purchased modules", width: "260px", render: formatPurchasedModules },
      { key: "actions", label: "Action", render: row => <button type="button" className="sa-btn" disabled={busy || row.id == null} onClick={() => view(row)}>View</button> }
    ]} /></div>
    {selected ? <div className="sa-form-card">
      <h3>Purchase details</h3><div className="sa-form-grid">
        {Object.entries(selected.details || {}).map(([key, value]) => <div className="sa-form-field" key={key}><label>{key}</label><div>{value == null ? "-" : typeof value === "object" ? JSON.stringify(value) : String(value)}</div></div>)}
      </div><div className="sa-page-actions">
        <button type="button" className="sa-btn" disabled={busy} onClick={() => setSelected(null)}>Close</button>
        <button type="button" className="sa-btn sa-btn-primary" disabled={busy} onClick={create}>{busy ? "Creating..." : "Create Admin from paid purchase"}</button>
      </div>
    </div> : null}
  </section>;
}
