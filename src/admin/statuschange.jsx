import React, { useEffect, useState } from 'react'

const API_BASE = 'http://127.0.0.1:8000'

function StatusChange() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const [payModal, setPayModal] = useState({
    open: false,
    ticket: null,
    customer_payment: '',
    payment_date: '',
  })

  const [completeModal, setCompleteModal] = useState({
    open: false,
    ticket: null,
    selling_price: '',
    zone: '',
    row: '',
    seat: '',
  })

  const [confirmPending, setConfirmPending] = useState({
    open: false,
    ticket: null,
  })

  const STATUS_DISPLAY = {
    pending: 'Pending',
    paid: 'Paid',
    complete: 'Completed',
    cancel: 'Cancelled',
  }

  const statusBadgeClass = (s) => {
    switch ((s || '').toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-blue-100 text-blue-800'
      case 'complete':
        return 'bg-green-100 text-green-800'
      case 'cancel':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const authHeaders = (json = false) => {
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken')

    const h = {}
    if (token) h.Authorization = `Bearer ${token}`
    if (json) h['Content-Type'] = 'application/json'
    return h
  }

  const fetchAll = async (url) => {
    const res = await fetch(url, { headers: authHeaders() })
    if (!res.ok) throw new Error(`Failed (${res.status})`)
    const data = await res.json()
    return Array.isArray(data) ? data : data.results || []
  }

  const loadTickets = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchAll(`${API_BASE}/api/tickets/`)
      setTickets(list)
    } catch (e) {
      setError(e.message || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  const patchTicket = async (id, payload) => {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Update failed')
  }

  /* ===== ACTION HANDLERS (UNCHANGED LOGIC) ===== */

  const openPaidModal = (t) =>
    setPayModal({
      open: true,
      ticket: t,
      customer_payment: '',
      payment_date: '',
    })

  const openCompleteModal = (t) =>
    setCompleteModal({
      open: true,
      ticket: t,
      selling_price: '',
      zone: '',
      row: '',
      seat: '',
    })

  const openConfirmPending = (t) =>
    setConfirmPending({ open: true, ticket: t })

  const submitPaid = async () => {
    await patchTicket(payModal.ticket.id, {
      status: 'paid',
      customer_payment: payModal.customer_payment,
      payment_date: payModal.payment_date,
    })
    setPayModal({ open: false, ticket: null })
    loadTickets()
  }

  const submitCompleted = async () => {
    await patchTicket(completeModal.ticket.id, {
      status: 'complete',
      selling_price: completeModal.selling_price,
      zone: completeModal.zone,
      row: completeModal.row,
      seat: completeModal.seat,
    })
    setCompleteModal({ open: false, ticket: null })
    loadTickets()
  }

  const markCancelled = async (t) => {
    await patchTicket(t.id, {
      status: 'cancel',
      refund_status: 'in_process',
    })
    loadTickets()
  }

 const revertToPending = async () => {
  const t = confirmPending.ticket
  if (!t) return

  const payload = { status: 'pending' }

  // IMPORTANT: clear refund_status if coming from cancelled
  if ((t.status || '').toLowerCase() === 'cancel') {
    payload.refund_status = 'none'   // or null, depending on backend
  }

  await patchTicket(t.id, payload)
  setConfirmPending({ open: false, ticket: null })
  loadTickets()
}


  const filteredTickets = tickets.filter((t) => {
    if (activeTab === 'all') return true
    return (t.status || '').toLowerCase() === activeTab
  })

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        Ticket Status Management
      </h1>

      {/* Tabs + Refresh */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'paid', 'complete', 'cancel'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium border
                ${
                  activeTab === tab
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
            >
              {tab === 'all' ? 'All' : STATUS_DISPLAY[tab]}
            </button>
          ))}
        </div>

        <button
          onClick={loadTickets}
          disabled={loading}
          className="px-4 py-2 rounded-md border border-gray-300 text-sm hover:bg-gray-100"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Passport Name</th>
              <th className="px-3 py-2">Facebook Name</th>
              <th className="px-3 py-2">Priority Date</th>
              <th className="px-3 py-2">1st</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((t) => {
              const statusLower = (t.status || '').toLowerCase()
              return (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{t.id}</td>
                  <td className="px-3 py-2">{t.passport_name || '—'}</td>
                  <td className="px-3 py-2">{t.facebook_name || '—'}</td>
                  <td className="px-3 py-2">{t.priority_date || '—'}</td>
                  <td className="px-3 py-2">{t.fst_pt || '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(
                        t.status
                      )}`}
                    >
                      {STATUS_DISPLAY[statusLower]}
                    </span>
                  </td>

                  {/* ACTION COLUMN */}
                  <td className="px-3 py-2 space-x-2">
                    {statusLower === 'pending' && (
                      <button
                        onClick={() => openPaidModal(t)}
                        className="px-3 py-1 rounded text-white"
                        style={{ backgroundColor: '#e51f4b' }}
                      >
                        Mark Paid
                      </button>
                    )}

                    {statusLower === 'paid' && (
                      <select
                        className="border rounded px-2 py-1"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'pending') openConfirmPending(t)
                          if (v === 'complete') openCompleteModal(t)
                          if (v === 'cancel') markCancelled(t)
                          e.target.value = ''
                        }}
                      >
                        <option value="" disabled>
                          Change status
                        </option>
                        <option value="pending">Pending</option>
                        <option value="complete">Completed</option>
                        <option value="cancel">Cancelled</option>
                      </select>
                    )}

                    {(statusLower === 'complete' ||
                      statusLower === 'cancel') && (
                      <button
                        onClick={() => openConfirmPending(t)}
                        className="px-3 py-1 rounded border border-gray-300"
                      >
                        Back to Pending
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}

            {!loading && filteredTickets.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-6 text-gray-500"
                >
                  No tickets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== MODALS (UNCHANGED INPUTS) ===== */}

      {payModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              Mark Ticket as Paid
            </h2>
            <input
              className="w-full border p-2 mb-3"
              placeholder="Customer Payment"
              value={payModal.customer_payment}
              onChange={(e) =>
                setPayModal((m) => ({
                  ...m,
                  customer_payment: e.target.value,
                }))
              }
            />
            <input
              className="w-full border p-2 mb-4"
              placeholder="Payment Date"
              value={payModal.payment_date}
              onChange={(e) =>
                setPayModal((m) => ({
                  ...m,
                  payment_date: e.target.value,
                }))
              }
            />
            <div className="flex justify-end gap-2">
              <button
                className="border px-4 py-2"
                onClick={() => setPayModal({ open: false, ticket: null })}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-white"
                style={{ backgroundColor: '#e51f4b' }}
                onClick={submitPaid}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {completeModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              Mark Ticket as Completed
            </h2>
            {['selling_price', 'zone', 'row', 'seat'].map((f) => (
              <input
                key={f}
                className="w-full border p-2 mb-3"
                placeholder={f.replace('_', ' ')}
                value={completeModal[f]}
                onChange={(e) =>
                  setCompleteModal((m) => ({
                    ...m,
                    [f]: e.target.value,
                  }))
                }
              />
            ))}
            <div className="flex justify-end gap-2">
              <button
                className="border px-4 py-2"
                onClick={() =>
                  setCompleteModal({ open: false, ticket: null })
                }
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-white bg-green-600"
                onClick={submitCompleted}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPending.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              Confirm Revert
            </h2>
            <p className="mb-4">
              Are you sure you want to go back to pending?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="border px-4 py-2"
                onClick={() =>
                  setConfirmPending({ open: false, ticket: null })
                }
              >
                No
              </button>
              <button
                className="px-4 py-2 text-white bg-gray-700"
                onClick={revertToPending}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StatusChange
