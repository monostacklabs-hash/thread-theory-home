"use client";

import { useEffect, useRef, useState } from "react";
import "./shipping-label.css";

type InitialRecipient = {
  name: string;
  phone: string;
  address: string;
  bookingId: string;
};

type Props = {
  initialRecipient: InitialRecipient;
};

const LS_KEYS = {
  fromName: "tth_label_fromName",
  fromAddr: "tth_label_fromAddr",
  fromPhone: "tth_label_fromPhone"
} as const;

function cleanInline(value: string): string {
  return (value || "").trim().replace(/\s+/g, " ");
}

function cleanMultiline(value: string): string {
  return (value || "")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function ShippingLabelClient({ initialRecipient }: Props) {
  const [fromName, setFromName] = useState("Thread Theory Home");
  const [fromAddr, setFromAddr] = useState("");
  const [fromPhone, setFromPhone] = useState("");

  const [toName, setToName] = useState(initialRecipient.name);
  const [toAddr, setToAddr] = useState(initialRecipient.address);
  const [toPhone, setToPhone] = useState(initialRecipient.phone);
  const [orderId, setOrderId] = useState(initialRecipient.bookingId);

  const [savedVisible, setSavedVisible] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const storedName = window.localStorage.getItem(LS_KEYS.fromName);
      const storedAddr = window.localStorage.getItem(LS_KEYS.fromAddr);
      const storedPhone = window.localStorage.getItem(LS_KEYS.fromPhone);
      if (storedName !== null) setFromName(storedName || "Thread Theory Home");
      if (storedAddr !== null) setFromAddr(storedAddr);
      if (storedPhone !== null) setFromPhone(storedPhone);
    } catch {
      /* localStorage unavailable */
    }
    setTodayLabel(formatDate(new Date()));
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function saveSender() {
    try {
      window.localStorage.setItem(LS_KEYS.fromName, fromName);
      window.localStorage.setItem(LS_KEYS.fromAddr, fromAddr);
      window.localStorage.setItem(LS_KEYS.fromPhone, fromPhone);
    } catch {
      /* ignore quota / private-mode errors */
    }
    setSavedVisible(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedVisible(false), 1800);
  }

  function handlePrint() {
    window.print();
  }

  const renderedToName = cleanInline(toName) || "—";
  const renderedToAddr = cleanMultiline(toAddr) || "—";
  const renderedToPhone = `📞 ${cleanInline(toPhone) || "—"}`;
  const renderedFromName = cleanInline(fromName) || "—";
  const renderedFromAddr = cleanMultiline(fromAddr) || "—";
  const renderedFromPhone = cleanInline(fromPhone) || "—";
  const cleanedOrderId = cleanInline(orderId);
  const renderedOrderId = cleanedOrderId ? `Ref: ${cleanedOrderId}` : "";

  return (
    <main className="admin-shell">
      <div className="container shipping-label-page">
        <section className="admin-header reveal">
          <span className="eyebrow">Speed Post</span>
          <h1>Shipping label</h1>
          <p>
            Pre-filled from the booking — adjust as needed, then print on A4. The sender block
            stays saved on this device.
          </p>
          <a className="login-back" href="/admin">
            Back to bookings
          </a>
        </section>

        <div className="shipping-label-grid reveal reveal-delay-1">
          <div className="admin-panel">
            <span className="shipping-label-panel-label">Return address</span>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                saveSender();
              }}
            >
              <div className="field">
                <label htmlFor="fromName">Sender name</label>
                <input
                  type="text"
                  id="fromName"
                  placeholder="Thread Theory Home"
                  value={fromName}
                  onChange={(event) => setFromName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="fromAddr">Pickup address</label>
                <textarea
                  id="fromAddr"
                  rows={3}
                  placeholder={"House / Street, Area,\nCity, State – PIN"}
                  value={fromAddr}
                  onChange={(event) => setFromAddr(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="fromPhone">Sender phone</label>
                <input
                  type="text"
                  id="fromPhone"
                  placeholder="+91 98XXXX XXXX"
                  value={fromPhone}
                  onChange={(event) => setFromPhone(event.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-secondary btn-compact">
                Save sender
              </button>
            </form>
          </div>

          <div className="admin-panel">
            <span className="shipping-label-panel-label">Recipient</span>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="toName">Customer name</label>
                <input
                  type="text"
                  id="toName"
                  placeholder="Recipient full name"
                  value={toName}
                  onChange={(event) => setToName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="toAddr">Delivery address</label>
                <textarea
                  id="toAddr"
                  rows={3}
                  placeholder={
                    "House / Flat no., Street,\nArea / Landmark,\nCity, State – PIN"
                  }
                  value={toAddr}
                  onChange={(event) => setToAddr(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="toPhone">Recipient phone</label>
                <input
                  type="text"
                  id="toPhone"
                  placeholder="98XXXX XXXX"
                  value={toPhone}
                  onChange={(event) => setToPhone(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="orderId">Order reference (optional)</label>
                <input
                  type="text"
                  id="orderId"
                  placeholder="TTH001"
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="shipping-label-actions reveal reveal-delay-2">
          <div className="shipping-label-actions-left">
            <span
              className={`shipping-label-saved${savedVisible ? " show" : ""}`}
              aria-live="polite"
            >
              ✓ Sender saved
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            Print label
          </button>
        </div>

        <div className="shipping-label-preview-wrap reveal reveal-delay-3">
          <div className="shipping-label-doc">
            <span className="l-cut-mark-tr" />
            <span className="l-cut-mark-bl" />

            <div className="l-brand-block">
              <div className="l-brand">Thread Theory Home</div>
              <div className="l-handle">@threadtheoryhome.in</div>
            </div>

            <div className="l-to">
              <div className="l-section-label">Deliver to</div>
              <div className="l-to-name">{renderedToName}</div>
              <div className="l-to-addr">{renderedToAddr}</div>
              <div className="l-to-phone">{renderedToPhone}</div>
            </div>

            <div className="l-from">
              <div className="l-section-label">If undelivered, return to</div>
              <div className="l-from-name">{renderedFromName}</div>
              <div className="l-from-addr">{renderedFromAddr}</div>
              <div className="l-from-phone">{renderedFromPhone}</div>
            </div>

            <div className="l-footer">
              <span>{renderedOrderId}</span>
              <span>{todayLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
