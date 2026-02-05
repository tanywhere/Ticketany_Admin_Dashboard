import React, { useEffect, useMemo, useState } from "react";
import { FiDownload, FiRefreshCw, FiX } from "react-icons/fi";


const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/';

function AllTickets() {
  const [tickets, setTickets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState(null);

  const authHeaders = () => {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken");
    const h = {};
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  const fetchAll = async (url) => {
    const res = await fetch(url, {
      headers: authHeaders(),
      credentials: "omit",
    });
    if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data?.results) return data.results;
    return [];
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [ts, os, cs, es] = await Promise.all([
        fetchAll(`${API_BASE}tickets/`),
        fetchAll(`${API_BASE}orders/`),
        fetchAll(`${API_BASE}customers/`),
        fetchAll(`${API_BASE}events/`),
      ]);
      setTickets(Array.isArray(ts) ? ts : []);
      setOrders(Array.isArray(os) ? os : []);
      setCustomers(Array.isArray(cs) ? cs : []);
      setEvents(Array.isArray(es) ? es : []);
    } catch (e) {
      setError(e.message || "Unable to load data");
    } finally {
      setLoading(false);
    }
  };

  const exportTicketsCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}tickets/export_csv/`, {
        method: "GET",
        headers: {
          ...authHeaders(),
        },
        credentials: "omit",
      });

      if (!res.ok) throw new Error(`Failed to export CSV (${res.status})`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const disposition = res.headers?.get?.("content-disposition") || "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename=([^;]+)/i);
      const rawName = (match?.[1] || match?.[2] || "").trim();
      const fileName = rawName
        ? decodeURIComponent(rawName.replace(/^"|"$/g, ""))
        : `tickets_export_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "Unable to export CSV");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const toId = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const m = v.match(/(\d+)(?!.*\d)/);
      return m ? Number(m[1]) : null;
    }
    return null;
  };

  const orderToCustomer = useMemo(() => {
    const map = {};
    for (const o of orders) {
      const oid = toId(o?.id);
      const cid = toId(o?.customer);
      if (oid != null && cid != null) map[oid] = cid;
    }
    return map;
  }, [orders]);

  const customerToEmail = useMemo(() => {
    const map = {};
    for (const c of customers) {
      const cid = toId(c?.id);
      if (cid != null) map[cid] = c?.email || null;
    }
    return map;
  }, [customers]);

  const enhancedTickets = useMemo(() => {
    return tickets.map((t) => {
      const oid = toId(t?.order);
      const cid = orderToCustomer[oid];
      const email = cid != null ? customerToEmail[cid] : null;
      return { ...t, _order_id: oid, _customer_email: email };
    });
  }, [tickets, orderToCustomer, customerToEmail]);

  const eventNameById = useMemo(() => {
    const map = {};
    for (const e of events) {
      const eid = toId(e?.id);
      if (eid != null) map[eid] = e?.event_name || null;
    }
    return map;
  }, [events]);

  const selectedEventName = useMemo(() => {
    const eid = toId(selectedTicket?.event);
    if (eid == null) return "—";
    return eventNameById[eid] || `Event #${eid}`;
  }, [selectedTicket, eventNameById]);

  const columnCount = useMemo(() => {
    switch (filter) {
      case "paid":
        // Order ID, Email, Passport, Facebook, Member, Status, Details, Customer Payment, Payment Date
        return 9;
      case "complete":
        // Order ID, Email, Passport, Facebook, Member, Status, Details, Selling Price, Zone, Row, Seat
        return 11;
      case "cancel":
        // Order ID, Email, Passport, Facebook, Member, Customer Payment, Status, Details
        return 8;
      case "pending":
      case "all":
      default:
        // Order ID, Email, Passport, Facebook, Member, Status, Details
        return 7;
    }
  }, [filter]);

  const byFilter = useMemo(() => {
    if (filter === "all") return enhancedTickets;
    const lower = (filter || "").toLowerCase();
    return enhancedTickets.filter(
      (t) => (t.status || "").toLowerCase() === lower
    );
  }, [enhancedTickets, filter]);

  const STATUS_LABELS = {
    pending: "Pending",
    paid: "Paid",
    complete: "Completed",
    cancel: "Cancelled",
  };
  const REFUND_LABELS = {
    none: "None",
    in_process: "In Process",
    refunded: "Refunded",
  };

  const statusBadgeClass = (s) => {
    switch ((s || "").toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "paid":
        return "bg-blue-100 text-blue-800";
      case "complete":
        return "bg-green-100 text-green-800";
      case "cancel":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const refundBadgeClass = (r) => {
    switch ((r || "").toLowerCase()) {
      case "in_process":
        return "bg-orange-100 text-orange-800";
      case "refunded":
        return "bg-teal-100 text-teal-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-full mx-auto">
      <h1 className="text-xl sm:text-2xl font-semibold text-black mb-4">
        All Orders and Tickets
      </h1>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "paid", "complete", "cancel"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                filter === status
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {status === "all"
                ? "All"
                : status === "complete"
                ? "Completed"
                : status === "cancel"
                ? "Cancelled"
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportTicketsCsv}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-sm bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export all tickets to CSV"
          >
            <FiDownload size={16} />
            {exporting ? "Exporting…" : "Export"}
          </button>

          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-sm bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiRefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {loading && <div className="mb-4 text-gray-600">Loading…</div>}

      <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm">
        <table className="min-w-[980px] w-full text-left bg-white">
          <thead className="border-b border-gray-400">
            {filter === "all" && (
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Passport Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Facebook Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Member Code
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Details
                </th>
              </tr>
            )}

            {filter === "pending" && (
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Passport Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Facebook Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Member Code
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Details
                </th>
              </tr>
            )}
            {filter === "paid" && (
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Passport Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Facebook Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Member Code
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Customer Payment
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Payment Date
                </th>
              </tr>
            )}
            {filter === "complete" && (
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Passport Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Facebook Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Member Code
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Selling Price
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Zone
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Row
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Seat
                </th>
              </tr>
            )}
            {filter === "cancel" && (
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Passport Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Facebook Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Member Code
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Customer Payment
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Details
                </th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {byFilter.map((t) => (
              <tr key={t.id} className="hover:bg-gray-100 transition-colors">
                {filter === "all" && (
                  <>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t._order_id ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 break-all">
                      {t._customer_email ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.passport_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.facebook_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.member_code ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(
                          t.status
                        )}`}
                      >
                        {STATUS_LABELS[(t.status || "").toLowerCase()] ||
                          t.status ||
                          "—"}
                        {t.status?.toLowerCase() === "cancel" &&
                        t.refund_status &&
                        t.refund_status !== "none"
                          ? ` (${t.refund_status
                              .replace("_", " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())})`
                          : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 text-sm hover:bg-gray-50"
                      >
                        View details
                      </button>
                    </td>
                  </>
                )}

                {filter === "pending" && (
                  <>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t._order_id ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 break-all">
                      {t._customer_email ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.passport_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.facebook_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.member_code ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(
                          t.status
                        )}`}
                      >
                        {STATUS_LABELS[(t.status || "").toLowerCase()] ||
                          t.status ||
                          "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 text-sm hover:bg-gray-50"
                      >
                        View details
                      </button>
                    </td>
                  </>
                )}
                {filter === "paid" && (
                  <>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t._order_id ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 break-all">
                      {t._customer_email ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.passport_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.facebook_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.member_code ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(
                          t.status
                        )}`}
                      >
                        {STATUS_LABELS[(t.status || "").toLowerCase()] ||
                          t.status ||
                          "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 text-sm hover:bg-gray-50"
                      >
                        View details
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.customer_payment ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.payment_date ?? "—"}
                    </td>
                  </>
                )}
                {filter === "complete" && (
                  <>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t._order_id ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 break-all">
                      {t._customer_email ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.passport_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.facebook_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.member_code ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(
                          t.status
                        )}`}
                      >
                        {STATUS_LABELS[(t.status || "").toLowerCase()] ||
                          t.status ||
                          "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 text-sm hover:bg-gray-50"
                      >
                        View details
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.selling_price ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.zone ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.row ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.seat ?? "—"}
                    </td>
                  </>
                )}
                {filter === "cancel" && (
                  <>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t._order_id ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 break-all">
                      {t._customer_email ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.passport_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.facebook_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.member_code ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t.customer_payment ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(
                          t.status
                        )}`}
                      >
                        {STATUS_LABELS[(t.status || "").toLowerCase()] ||
                          t.status ||
                          "—"}
                        {t.status?.toLowerCase() === "cancel" &&
                        t.refund_status &&
                        t.refund_status !== "none"
                          ? ` (${t.refund_status
                              .replace("_", " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())})`
                          : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 text-sm hover:bg-gray-50"
                      >
                        View details
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!loading && byFilter.length === 0 && (
              <tr>
                <td
                  className="px-6 py-8 text-center text-gray-500 text-sm"
                  colSpan={columnCount}
                >
                  No tickets in this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedTicket(null)}
          />

          <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Order details
                </h2>
                <p className="text-sm text-gray-500">Order ID: {selectedTicket._order_id ?? "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Ticket details
                </h3>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Order ID
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900">
                      {selectedTicket._order_id ?? "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Event
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-gray-900">
                      {selectedEventName}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Name
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-gray-900">
                      {selectedTicket.passport_name ?? "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Facebook Name
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-gray-900">
                      {selectedTicket.facebook_name ?? "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Member Code
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-gray-900">
                      {selectedTicket.member_code ?? "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Status
                    </div>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold ${statusBadgeClass(
                          selectedTicket.status
                        )}`}
                      >
                        {STATUS_LABELS[(selectedTicket.status || "").toLowerCase()] ||
                          selectedTicket.status ||
                          "—"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Price (all priorities)
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          1st priority
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {selectedTicket.fst_pt ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          2nd priority
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {selectedTicket.snd_pt ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          3rd priority
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {selectedTicket.trd_pt ?? selectedTicket.thrd_pt ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllTickets;
