import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, CheckCircle2, Clock3, History, Search, XCircle } from 'lucide-react';

// Fictional transactions for the screen design; never read or write billing data.
const samples = Array.from({ length: 24 }, (_, index) => ({
  id: `DEMO-TXN-${String(1024 - index).padStart(4, '0')}`,
  invoice: `DEMO-INV-${String(224 - index).padStart(4, '0')}`,
  patient: `Demo Patient ${String(index + 1).padStart(2, '0')}`,
  patientId: `DEMO-P-${101 + index}`,
  date: `2026-11-${String(6 - Math.floor(index / 4)).padStart(2, '0')}`,
  time: ['09:40 AM', '09:25 AM', '09:10 AM', '08:55 AM'][index % 4],
  method: ['UPI', 'Card', 'Net banking', 'Cash'][index % 4],
  status: ['Paid', 'Paid', 'Pending', 'Paid', 'Failed', 'Refunded'][index % 6],
  amount: [750, 1200, 2500, 500, 1800, 950][index % 6],
  service: ['Consultation', 'Pharmacy', 'Diagnostics'][index % 3],
}));
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function AdminPaymentHistory() {
  const [filters, setFilters] = useState({ search: '', method: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const update = (name, value) => { setFilters(current => ({ ...current, [name]: value })); setPage(0); setExpanded(null); };
  const invalidDates = filters.from && filters.to && filters.from > filters.to;
  const filtered = samples.filter(row => !invalidDates &&
    (!filters.method || row.method === filters.method) && (!filters.status || row.status === filters.status) &&
    (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to) &&
    `${row.id} ${row.invoice} ${row.patient} ${row.patientId}`.toLowerCase().includes(filters.search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const rows = filtered.slice(page * 10, (page + 1) * 10);
  const total = status => filtered.filter(row => row.status === status).reduce((sum, row) => sum + row.amount, 0);
  const metrics = [
    { title: 'Collected', value: money(total('Paid')), Icon: CheckCircle2, tone: 'paid' },
    { title: 'Pending', value: money(total('Pending')), Icon: Clock3, tone: 'pending' },
    { title: 'Refunded', value: money(total('Refunded')), Icon: ArrowDownLeft, tone: 'refunded' },
    { title: 'Failed transactions', value: filtered.filter(row => row.status === 'Failed').length, Icon: XCircle, tone: 'failed' },
  ];

  return <main className="payment-settings-page">
    <header className="payment-settings-heading">
      <div className="payment-settings-title-icon"><History size={26} /></div>
      <div><p className="payment-settings-eyebrow">CLINIC ADMINISTRATION</p><h1>Payment History</h1><p>Review patient payments across your clinic’s payment methods.</p></div>
      <span className="payment-settings-badge">Screen preview</span>
    </header>
    <nav className="payment-settings-tabs" aria-label="Payment settings sections"><Link to="/payment-settings">Payment options</Link><Link to="/payment-settings/history" aria-current="page">Payment history</Link></nav>
    <div className="payment-settings-info" role="note">Sample data for UI preview only. These fictional transactions are not connected to billing.</div>
    <div className="payment-history-metrics">
      {metrics.map(({ title, value, Icon, tone }) => <article key={title} className="payment-history-metric"><span className={`payment-history-metric-icon payment-history-status-${tone}`}><Icon size={20} /></span><div><p>{title}</p><strong>{value}</strong><small>Sample · current filters</small></div></article>)}
    </div>
    <section className="payment-settings-card payment-history-card" aria-labelledby="payment-history-title">
      <div className="payment-settings-section-heading"><h2 id="payment-history-title">Transactions</h2><span>{filtered.length} sample records</span></div>
      <p>Search and filter the sample payment history.</p>
      <div className="payment-history-filters">
        <label className="payment-settings-field payment-history-search"><span>Search transactions</span><div><Search size={17} aria-hidden="true" /><input type="search" placeholder="Patient, invoice or transaction ID" value={filters.search} onChange={event => update('search', event.target.value)} /></div></label>
        <label className="payment-settings-field"><span>Payment method</span><select value={filters.method} onChange={event => update('method', event.target.value)}><option value="">All methods</option>{['UPI', 'Card', 'Net banking', 'Cash'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="payment-settings-field"><span>Status</span><select value={filters.status} onChange={event => update('status', event.target.value)}><option value="">All statuses</option>{['Paid', 'Pending', 'Failed', 'Refunded'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="payment-settings-field"><span>From date</span><input type="date" value={filters.from} onChange={event => update('from', event.target.value)} /></label>
        <label className="payment-settings-field"><span>To date</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={event => update('to', event.target.value)} /></label>
      </div>
      <div className="payment-history-filter-footer"><span>Sample period: 01–06 Nov 2026</span><button type="button" onClick={() => { setFilters({ search: '', method: '', status: '', from: '', to: '' }); setPage(0); setExpanded(null); }}>Clear filters</button></div>
      {invalidDates && <p role="alert" className="payment-settings-error">The to date must be on or after the from date.</p>}
      <div className="payment-history-table-scroll">
        <table className="payment-history-table">
          <caption className="payment-history-sr-only">Fictional patient payment transactions for UI preview</caption>
          <thead><tr><th scope="col">Transaction / Invoice</th><th scope="col">Patient</th><th scope="col">Date & time</th><th scope="col">Method</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
          <tbody>{!rows.length ? <tr><td colSpan={7} className="payment-history-empty"><Search size={26} /><strong>No matching transactions</strong><span>Try another search or clear the filters.</span></td></tr> : rows.map(row => <React.Fragment key={row.id}>
            <tr><td><strong>{row.id}</strong><small>{row.invoice}</small></td><td><strong>{row.patient}</strong><small>{row.patientId}</small></td><td>{dateLabel(row.date)}<small>{row.time}</small></td><td>{row.method}</td><td className="payment-history-amount">{money(row.amount)}</td><td><span className={`payment-history-status payment-history-status-${row.status.toLowerCase()}`}><i aria-hidden="true" />{row.status}</span></td><td><button type="button" className="payment-history-view" aria-expanded={expanded === row.id} aria-controls={`detail-${row.id}`} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{expanded === row.id ? 'Close' : 'View details'}<span className="payment-history-sr-only"> for {row.id}</span></button></td></tr>
            {expanded === row.id && <tr id={`detail-${row.id}`}><td colSpan={7}><div className="payment-history-detail"><div><small>Service</small><strong>{row.service}</strong></div><div><small>Reference number</small><strong>{row.method === 'Cash' ? 'Not applicable (cash)' : `DEMO-REF-${row.id.slice(-4)}`}</strong></div><div><small>Recorded by</small><strong>Demo Reception</strong></div><div><small>Transaction note</small><strong>{row.status === 'Paid' ? 'Sample payment received' : row.status === 'Pending' ? 'Sample payment awaiting confirmation' : row.status === 'Refunded' ? 'Sample refund completed' : 'Sample payment unsuccessful'}</strong></div></div></td></tr>}
          </React.Fragment>)}</tbody>
        </table>
      </div>
      <nav className="payment-history-pagination" aria-label="Payment history pages"><span>Showing {filtered.length ? page * 10 + 1 : 0}–{Math.min((page + 1) * 10, filtered.length)} of {filtered.length}</span><div><button type="button" disabled={!page} onClick={() => { setPage(page - 1); setExpanded(null); }}>Previous</button>{Array.from({ length: pages }, (_, number) => <button type="button" key={number} aria-current={page === number ? 'page' : undefined} onClick={() => { setPage(number); setExpanded(null); }}>{number + 1}</button>)}<button type="button" disabled={page + 1 >= pages} onClick={() => { setPage(page + 1); setExpanded(null); }}>Next</button></div></nav>
    </section>
  </main>;
}
