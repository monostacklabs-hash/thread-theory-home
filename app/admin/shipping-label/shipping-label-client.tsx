"use client";

import { useEffect, useRef, useState } from "react";
import "./shipping-label.css";

type InitialRecipient = {
  name: string;
  phone: string;
  address: string;
  bookingId: string;
};

type RecipientState = InitialRecipient;

type Props = {
  initialRecipients: InitialRecipient[];
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

export default function ShippingLabelClient({ initialRecipients }: Props) {
  const [fromName, setFromName] = useState("Thread Theory Home");
  const [fromAddr, setFromAddr] = useState("");
  const [fromPhone, setFromPhone] = useState("");

  const [recipients, setRecipients] = useState<RecipientState[]>(initialRecipients);

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

  function updateRecipient(index: number, patch: Partial<RecipientState>) {
    setRecipients((current) =>
      current.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry))
    );
  }

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

  const renderedFromName = cleanInline(fromName) || "—";
  const renderedFromAddr = cleanMultiline(fromAddr) || "—";
  const renderedFromPhone = cleanInline(fromPhone) || "—";

  const labelCount = recipients.length;
  const printButtonLabel =
    labelCount > 1 ? `Print ${labelCount} labels` : "Print label";

  return (
    <main className="admin-shell">
      <div className="container shipping-label-page">
        <section className="admin-header reveal">
          <span className="eyebrow">Speed Post</span>
          <h1>Shipping label</h1>
          <p>
            Pre-filled from the booking — adjust as needed, then print on A4. The sender block
            stays saved on this device. Two labels fit on one sheet.
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
              <div className="shipping-label-save-row">
                <button type="submit" className="btn btn-secondary btn-compact">
                  Save sender
                </button>
                <span
                  className={`shipping-label-saved${savedVisible ? " show" : ""}`}
                  aria-live="polite"
                >
                  ✓ Sender saved
                </span>
              </div>
            </form>
          </div>

          <div className="shipping-label-recipients">
            {recipients.map((recipient, index) => {
              const headingSuffix = labelCount > 1 ? ` ${index + 1}` : "";
              const idSuffix = `-${index}`;
              return (
                <div className="admin-panel" key={`${recipient.bookingId || "manual"}-${index}`}>
                  <span className="shipping-label-panel-label">
                    Recipient{headingSuffix}
                    {recipient.bookingId ? (
                      <small className="shipping-label-panel-ref">
                        Ref: {recipient.bookingId}
                      </small>
                    ) : null}
                  </span>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor={`toName${idSuffix}`}>Customer name</label>
                      <input
                        type="text"
                        id={`toName${idSuffix}`}
                        placeholder="Recipient full name"
                        value={recipient.name}
                        onChange={(event) =>
                          updateRecipient(index, { name: event.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`toAddr${idSuffix}`}>Delivery address</label>
                      <textarea
                        id={`toAddr${idSuffix}`}
                        rows={3}
                        placeholder={
                          "House / Flat no., Street,\nArea / Landmark,\nCity, State – PIN"
                        }
                        value={recipient.address}
                        onChange={(event) =>
                          updateRecipient(index, { address: event.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`toPhone${idSuffix}`}>Recipient phone</label>
                      <input
                        type="text"
                        id={`toPhone${idSuffix}`}
                        placeholder="98XXXX XXXX"
                        value={recipient.phone}
                        onChange={(event) =>
                          updateRecipient(index, { phone: event.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`orderId${idSuffix}`}>Order reference (optional)</label>
                      <input
                        type="text"
                        id={`orderId${idSuffix}`}
                        placeholder="TTH001"
                        value={recipient.bookingId}
                        onChange={(event) =>
                          updateRecipient(index, { bookingId: event.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shipping-label-actions reveal reveal-delay-2">
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            {printButtonLabel}
          </button>
        </div>

        <div className="shipping-label-preview-wrap reveal reveal-delay-3">
          <div className="shipping-label-sheet">
            {recipients.map((recipient, index) => {
              const renderedToName = cleanInline(recipient.name) || "—";
              const renderedToAddr = cleanMultiline(recipient.address) || "—";
              const renderedToPhone = `📞 ${cleanInline(recipient.phone) || "—"}`;
              const cleanedOrderId = cleanInline(recipient.bookingId);
              const renderedOrderId = cleanedOrderId ? `Ref: ${cleanedOrderId}` : "";
              return (
                <div
                  className="shipping-label-doc"
                  key={`slip-${recipient.bookingId || "manual"}-${index}`}
                >
                  <span className="l-cut-mark-tl" />
                  <span className="l-cut-mark-tr" />
                  <span className="l-cut-mark-bl" />
                  <span className="l-cut-mark-br" />

                  <div className="l-brand-block">
                    <div className="l-brand">Thread Theory Home</div>
                    <div className="l-handle">@threadtheoryhome.in</div>
                  </div>

                  <div className="l-body">
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
                  </div>

                  <div className="l-footer">
                    <span>{renderedOrderId}</span>
                    <span>{todayLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
