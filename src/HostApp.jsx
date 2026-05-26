import { useState, useEffect, useCallback, useRef } from "react";
import FieldInput, { FieldError } from "./components/FieldInput.jsx";
import QrScanner from "./components/QrScanner.jsx";
import EventHeader from "./components/EventHeader.jsx";
import ColombiaAddressPicker from "./components/ColombiaAddressPicker.jsx";
import HeaderImageUpload from "./components/HeaderImageUpload.jsx";
import LocationMap from "./components/LocationMap.jsx";
import NavigateButtons from "./components/NavigateButtons.jsx";
import EventCrm from "./components/EventCrm.jsx";
import ShareEventModal from "./components/ShareEventModal.jsx";
import ConfirmTicket from "./components/ConfirmTicket.jsx";
import InicioView from "./pages/InicioView.jsx";
import MisEventosView from "./pages/MisEventosView.jsx";
import DashboardView from "./pages/DashboardView.jsx";
import MiCuentaView from "./pages/MiCuentaView.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { api, apiEnabled } from "./lib/api.js";
import { loadEvents, saveEvents } from "./lib/storage.js";
import {
  performCheckIn,
  validateRegistrationForm,
  buildParticipant,
  daysInMonth,
} from "./lib/tickets.js";
import { isSoldOut, capacityLabel } from "./lib/capacity.js";
import {
  EVENT_TYPE_OTHER,
  EVENT_TYPE_PRESETS,
  formatEventType,
} from "./lib/colombia.js";
import {
  VERDE_PASTEL_BG,
  VERDE_CORPORATIVO,
  NEGRO_PURO,
  NEGRO_MUTED_70,
  NEGRO_MUTED_50,
  BLANCO_CONTRASTE,
  ROJO_SUAVE,
  inputStyle,
} from "./lib/theme.js";

const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const FIELD_TYPES = [
  { type: "text", label: "Texto corto", icon: "✏️" },
  { type: "email", label: "Email", icon: "✉️" },
  { type: "phone", label: "Teléfono", icon: "📱" },
  { type: "age", label: "Edad", icon: "👤" },
  { type: "number", label: "Número", icon: "#️⃣" },
  { type: "textarea", label: "Texto largo", icon: "📝" },
  { type: "select", label: "Selección única", icon: "🔘" },
  { type: "multi_select", label: "Selección múltiple", icon: "☑️" },
  { type: "checkbox", label: "Verificación", icon: "✅" },
];

const DEFAULTS = {
  text: "Nombre completo", email: "Correo electrónico", phone: "Teléfono",
  age: "Edad", number: "Número", textarea: "Comentarios u observaciones",
  select: "Selecciona una opción", multi_select: "¿Cómo te enteraste?",
  checkbox: "Acepto los términos",
};

// ─── ANIMACIONES NATIVAS ───────────────────────────────────────────────────────
const animationStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-6px); }
  }
  .animate-fade-in { animation: fadeIn 0.35s ease-out forwards; }
  .animate-fade-out { animation: fadeOut 0.25s ease-in forwards; }
`;

function Lbl({ children, top }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: NEGRO_PURO, marginBottom: 6, marginTop: top ? 16 : 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </div>
  );
}

function makeSlug(title) {
  const base = String(title || "evento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function publicUrl(ev) {
  return ev.publicUrl || `${window.location.origin}/e/${ev.slug || ev.id}`;
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function HostApp({ initialDraft = null, onDraftConsumed }) {
  const { user, token, logout, isSuperAdmin, apiEnabled: apiOn } = useAuth();

  const [draft, setDraft] = useState(() => {
    if (initialDraft) return initialDraft;
    const saved = localStorage.getItem("ef_pending_draft");
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return null;
  });

  const _hasDraft = Boolean(initialDraft || localStorage.getItem("ef_pending_draft"));
  const [view, setView] = useState(_hasDraft ? "builder" : "inicio");
  const [events, setEvents] = useState(() => (apiOn ? [] : loadEvents()));
  const [adminData, setAdminData] = useState(null);
  const [shareEv, setShareEv] = useState(null);
  const [evId, setEvId] = useState(null);
  const [regId, setRegId] = useState(null);
  const [editFid, setEditFid] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [vCode, setVCode] = useState("");
  const [vResult, setVResult] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);

  useEffect(() => {
    localStorage.removeItem("ef_pending_draft");
    onDraftConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventsRef = useRef(events);
  const evIdRef = useRef(evId);
  eventsRef.current = events;
  evIdRef.current = evId;

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = animationStyles;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  useEffect(() => {
    if (!apiOn) saveEvents(events);
  }, [events, apiOn]);

  useEffect(() => {
    if (!apiOn || !token) return;
    (async () => {
      try {
        const { events: list } = await api.events(token);
        setEvents(list.map((e) => ({ ...e, _persisted: true })));
        if (isSuperAdmin) {
          const data = await api.adminOverview(token);
          setAdminData(data);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [apiOn, token, isSuperAdmin]);

  const ev = events.find((e) => e.id === evId);

  const go = (v, id = null) => {
    setView(v);
    setEvId(id);
    setEditFid(null);
    setVResult(null);
    setVCode("");
    setForm({});
    setErrors({});
  };

  const openValidate = (id = null) => {
    setEvId(id);
    setView("validate");
    setVResult(null);
    setVCode("");
  };

  const deleteEvent = async (id) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    if (!window.confirm(`¿Eliminar "${ev.title}" y todas sus inscripciones?`)) return;
    if (apiOn && token) await api.deleteEvent(token, id);
    setEvents((p) => p.filter((e) => e.id !== id));
    if (evId === id) go(isSuperAdmin ? "superadmin" : "admin");
  };

  const persistEvent = async (ev) => {
    const payload = { ...ev, slug: ev.slug || makeSlug(ev.title) };
    if (apiOn && token) {
      const { event: saved } = await api.saveEvent(token, {
        ...payload,
        _persisted: ev._persisted,
      });
      return { ...saved, _persisted: true };
    }
    return payload;
  };

  const toggleSoldOut = async (id, manualSoldOut) => {
    if (apiOn && token) {
      const { event: updated } = await api.setSoldOut(token, id, manualSoldOut);
      setEvents((p) => p.map((e) => (e.id === id ? updated : e)));
      return;
    }
    setEvents((p) =>
      p.map((e) => (e.id === id ? { ...e, manualSoldOut } : e))
    );
  };

  const tryRegister = (id) => {
    const target = events.find((e) => e.id === id);
    if (target && isSoldOut(target)) return;
    go("register", id);
  };

  const startNew = () => {
    setDraft({
      id: "E" + uid(),
      title: "",
      eventType: "",
      eventTypeCustom: "",
      slug: "",
      date: "",
      city: "",
      location: "",
      address: "",
      lat: null,
      lng: null,
      capacity: "",
      headerImage: "",
      fields: [],
      registrations: [],
      eventDescription: "",
    });
    setWizardStep(1);
    setEvId(null);
    setView("create_wizard");
  };

  const editEvent = (event) => {
    setDraft({ ...event, fields: [...event.fields], registrations: [...event.registrations] });
    setEvId(event.id);
    setView("builder");
  };

  const generatePreliminaryForm = (finalDraft) => {
    const baseFields = [
      { id: "F" + uid(), type: "text", label: "Nombre completo del asistente", description: "Escribe tus nombres tal como aparecen en tu documento", placeholder: "", required: true, options: [] },
      { id: "F" + uid(), type: "email", label: "Correo electrónico", description: "Usa un correo al que tengas acceso; lo verás en tu boleto", placeholder: "", required: true, options: [] }
    ];

    if (finalDraft.capacity === "100-300" || finalDraft.capacity === "300+") {
      baseFields.push({ id: "F" + uid(), type: "phone", label: "Teléfono de Contacto", description: "", placeholder: "", required: true, options: [] });
    }

    setDraft({ ...finalDraft, fields: baseFields });
    setView("builder"); 
  };

  const addField = (type) => {
    const f = { id: "F" + uid(), type, label: DEFAULTS[type], description: "", placeholder: "", required: type !== "multi_select", options: (type === "select" || type === "multi_select") ? ["Opción 1", "Opción 2"] : [] };
    setDraft((p) => ({ ...p, fields: [...p.fields, f] }));
    setEditFid(f.id);
  };

  const updField = (fid, u) => setDraft((p) => ({ ...p, fields: p.fields.map((f) => (f.id === fid ? { ...f, ...u } : f)) }));
  const delField = (fid) => { setDraft((p) => ({ ...p, fields: p.fields.filter((f) => f.id !== fid) })); if (editFid === fid) setEditFid(null); };
  const moveField = (fid, d) => setDraft((p) => {
    const a = [...p.fields]; const i = a.findIndex((f) => f.id === fid); const j = i + d;
    if (j < 0 || j >= a.length) return p;
    [a[i], a[j]] = [a[j], a[i]]; return { ...p, fields: a };
  });

  const publish = async () => {
    if (!draft?.title?.trim()) {
      alert("El evento necesita un título antes de publicarse.");
      return;
    }
    if (!draft.fields?.length) {
      alert("Agrega al menos un campo al formulario.");
      return;
    }
    const toSave = { ...draft, slug: draft.slug || makeSlug(draft.title) };
    try {
      const saved = await persistEvent(toSave);
      setEvents((p) => {
        const ex = p.find((e) => e.id === saved.id);
        return ex
          ? p.map((e) => (e.id === saved.id ? saved : e))
          : [...p, saved];
      });
      setEvId(saved.id);
      setDraft(null);
      setView("detail");
      setShareEv(saved);
    } catch (e) {
      alert(e.message || "Error al publicar");
    }
  };

  const setFormField = (fid, value) => {
    setForm((prev) => ({ ...prev, [fid]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fid];
      return next;
    });
  };

  const submitReg = () => {
    const event = events.find((e) => e.id === evId);
    if (!event) return;
    if (isSoldOut(event)) return;
    const errs = validateRegistrationForm(event.fields, form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const r = {
      id: "TICKET-" + uid(),
      eventId: evId,
      data: { ...form },
      ts: Date.now(),
      used: false,
      checkedInAt: null,
    };
    setEvents((p) =>
      p.map((e) =>
        e.id === evId
          ? { ...e, registrations: [...e.registrations, r] }
          : e
      )
    );
    setRegId(r.id);
    setView("confirm");
  };

  const applyCheckInResult = (result) => {
    if (result.status === "ok") {
      setEvents(result.events);
      setVResult({
        s: "ok",
        ticketId: result.ticketId,
        event: result.event,
        reg: result.reg,
        participant: result.participant,
        checkedInAt: result.checkedInAt,
      });
      return;
    }
    if (result.status === "used") {
      setVResult({
        s: "used",
        ticketId: result.ticketId,
        event: result.event,
        reg: result.reg,
        participant: result.participant,
      });
      return;
    }
    setVResult({ s: "nf", ticketId: result.ticketId });
  };

  const runCheckIn = useCallback((rawCode) => {
    const result = performCheckIn(
      eventsRef.current,
      rawCode || vCode,
      evIdRef.current || null
    );
    applyCheckInResult(result);
  }, [vCode]);

  const handleQrScan = useCallback((decoded) => {
    setVCode(decoded);
    const result = performCheckIn(
      eventsRef.current,
      decoded,
      evIdRef.current || null
    );
    applyCheckInResult(result);
  }, []);

  const confirmEv = events.find((e) => e.id === evId);
  const confirmReg = confirmEv?.registrations.find((r) => r.id === regId);

  const showScannerNav = ["inicio", "mis_eventos", "detail", "validate"].includes(view);

  const NAV_ITEMS = [
    { key: "inicio", label: "Inicio" },
    { key: "mis_eventos", label: "Mis eventos" },
    { key: "stats", label: "Dashboard" },
    { key: "mi_cuenta", label: "Mi cuenta" },
  ];

  return (
    <div
      className="app-shell"
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        minHeight: "100vh",
        background: BLANCO_CONTRASTE,
        color: NEGRO_PURO,
        textAlign: "left",
      }}
    >
      {/* ── NAVEGACIÓN ── */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 20px", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: 8, boxShadow: "0 1px 4px rgba(13,59,102,0.06)" }}>
        <button type="button" onClick={() => go("inicio")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 17, color: "#0d1b2a" }}>
          <span style={{ color: VERDE_CORPORATIVO, fontSize: 20 }}>●</span> EventForm
        </button>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {NAV_ITEMS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => go(key)}
              className={`soft-btn ${view === key ? "soft-btn-primary" : "soft-btn-secondary"}`}
              style={{ fontSize: 12, padding: "8px 13px" }}>
              {label}
            </button>
          ))}
          <button type="button" onClick={startNew} className="soft-btn soft-btn-primary" style={{ fontSize: 12, padding: "8px 13px", marginLeft: 4 }}>
            + Crear evento
          </button>
        </div>
      </nav>

      {shareEv && (
        <ShareEventModal event={shareEv} onClose={() => setShareEv(null)} />
      )}

      <main className="app-main">
        {view === "inicio" && (
          <InicioView events={events} onNew={startNew} />
        )}
        {view === "mis_eventos" && (
          <MisEventosView
            events={events}
            onNew={startNew}
            onOpen={(id) => go("crm", id)}
            onEdit={editEvent}
            onValidate={(id) => openValidate(id)}
            onDelete={deleteEvent}
            onShare={(ev) => setShareEv(ev)}
            onToggleSoldOut={toggleSoldOut}
          />
        )}
        {view === "stats" && <DashboardView events={events} />}
        {view === "mi_cuenta" && <MiCuentaView />}
        {view === "create_wizard" && (
          <CreateEventWizard
            draft={draft}
            setDraft={setDraft}
            step={wizardStep}
            setStep={setWizardStep}
            onDone={generatePreliminaryForm}
            onCancel={() => go("inicio")}
          />
        )}
        {view === "builder" && draft && (
          <Builder
            draft={draft}
            setDraft={setDraft}
            editFid={editFid}
            setEditFid={setEditFid}
            onAdd={addField}
            onUpdate={updField}
            onDelete={delField}
            onMove={moveField}
            onPublish={publish}
          />
        )}
        {view === "crm" && ev && (
          <EventCrm
            event={ev}
            onBack={() => go("mis_eventos")}
            onToggleSoldOut={(v) => toggleSoldOut(ev.id, v)}
            onShare={() => setShareEv(ev)}
          />
        )}
        {view === "detail" && ev && (
          <Detail
            ev={ev}
            onEdit={() => editEvent(ev)}
            onValidate={() => openValidate(ev.id)}
            onCrm={() => go("crm", ev.id)}
            onShare={() => setShareEv(ev)}
            publicUrl={`${window.location.origin}/e/${ev.slug || ev.id}`}
          />
        )}
        {view === "register" && ev && (
          isSoldOut(ev) ? (
            <SoldOutView ev={ev} onBack={() => go("detail", evId)} />
          ) : (
            <Register ev={ev} form={form} setFormField={setFormField} errors={errors} onSubmit={submitReg} onBack={() => go("detail", evId)} />
          )
        )}
        {view === "confirm" && confirmEv && confirmReg && (
          <ConfirmTicket ev={confirmEv} reg={confirmReg} onDone={() => go("detail", evId)} />
        )}
        {view === "validate" && (
          <Validate
            event={ev}
            scopeLabel={evId && ev ? `Solo entradas de: ${ev.title}` : "Todos los eventos"}
            code={vCode} setCode={setVCode} result={vResult}
            onCheck={() => runCheckIn(vCode)} onScan={handleQrScan}
            onReset={() => { setVResult(null); setVCode(""); }}
          />
        )}
      </main>

      {view !== "create_wizard" && (
        <footer style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: 20, textAlign: "center", fontSize: 12, color: "#8fa3b1", marginTop: 48 }}>
          EventForm Colombia © 2026
        </footer>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function SoldOutView({ ev, onBack }) {
  return (
    <div style={{ border: `2px solid ${NEGRO_PURO}`, borderRadius: 16, padding: 24, textAlign: "center" }}>
      <EventHeader event={ev} compact />
      <span className="sold-out-badge" style={{ fontSize: 14, padding: "8px 16px", display: "inline-block", marginBottom: 16 }}>
        Sold out — cupos agotados
      </span>
      <p style={{ fontSize: 15, fontWeight: 600, color: NEGRO_MUTED_70, marginBottom: 20 }}>
        Este evento alcanzó su aforo máximo ({capacityLabel(ev)}). No se aceptan más inscripciones.
      </p>
      <button type="button" className="touch-target" onClick={onBack} style={{ background: NEGRO_PURO, color: BLANCO_CONTRASTE, border: "none", padding: "12px 24px", borderRadius: 8, fontWeight: 800, cursor: "pointer", width: "100%" }}>
        Volver
      </button>
    </div>
  );
}

function Dashboard({ events, onNew, onOpen, onRegister, onValidate, onAdmin }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 36,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              margin: 0,
              color: NEGRO_PURO,
              letterSpacing: "-0.02em",
            }}
          >
            Tus eventos
          </h1>
          <p style={{ fontSize: 14, color: NEGRO_MUTED_70, marginTop: 4 }}>
            {events.length} eventos · Colombia
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {events.length > 0 && (
          <button type="button" onClick={onAdmin} style={{ background: VERDE_CORPORATIVO, color: BLANCO_CONTRASTE, border: `2px solid ${NEGRO_PURO}`, borderRadius: 12, padding: "14px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Administración
          </button>
        )}
        <button
          type="button"
          onClick={onNew}
          style={{
            background: NEGRO_PURO,
            color: BLANCO_CONTRASTE,
            border: "none",
            borderRadius: 12,
            padding: "14px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Crear evento
        </button>
        </div>
      </div>

      {events.length === 0 && (
        <div
          style={{
            padding: "72px 24px",
            textAlign: "center",
            borderRadius: 20,
            background: VERDE_PASTEL_BG,
            border: `2px solid ${NEGRO_PURO}`,
          }}
        >
          <span
            style={{
              fontSize: 40,
              color: VERDE_CORPORATIVO,
              display: "block",
              marginBottom: 20,
            }}
          >
            ●
          </span>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 300,
              color: NEGRO_PURO,
              marginBottom: 10,
              lineHeight: 1.3,
            }}
          >
            Empecemos a crear<br />
            <strong style={{ fontWeight: 800 }}>tu próximo evento</strong>
          </h2>
          <p
            style={{
              fontSize: 14,
              color: NEGRO_MUTED_70,
              marginBottom: 28,
              maxWidth: 340,
              margin: "0 auto 28px",
              lineHeight: 1.6,
            }}
          >
            Configura en minutos, inscribe asistentes y gestiona el acceso
            con QR el día del evento.
          </p>
          <button
            type="button"
            onClick={onNew}
            style={{
              background: NEGRO_PURO,
              color: BLANCO_CONTRASTE,
              border: "none",
              borderRadius: 12,
              padding: "14px 32px",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Empezar →
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {events.map((e) => (
          <div
            key={e.id}
            onClick={() => onOpen(e.id)}
            style={{
              border: `2px solid ${NEGRO_PURO}`,
              borderRadius: 16,
              overflow: "hidden",
              cursor: "pointer",
              background: BLANCO_CONTRASTE,
            }}
          >
            <div
              style={{
                background: NEGRO_PURO,
                color: BLANCO_CONTRASTE,
                padding: 24,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: VERDE_CORPORATIVO,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                {e.date || "Fecha pendiente"}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{e.title}</h2>
              {formatEventType(e) && (
                <p style={{ fontSize: 13, margin: "8px 0 0", opacity: 0.85 }}>
                  {formatEventType(e)}
                </p>
              )}
              {isSoldOut(e) && (
                <span className="sold-out-badge" style={{ marginTop: 8, display: "inline-block" }}>Sold out</span>
              )}
            </div>
            <div
              style={{
                padding: "16px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: NEGRO_MUTED_70 }}>
                {capacityLabel(e)} · {e.registrations.filter((r) => r.used).length} check-in
              </span>
              <div style={{ display: "flex", gap: 8 }} onClick={(ev) => ev.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onRegister(e.id)}
                  disabled={isSoldOut(e)}
                  style={{
                    background: BLANCO_CONTRASTE,
                    color: NEGRO_PURO,
                    border: `2px solid ${NEGRO_PURO}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isSoldOut(e) ? "not-allowed" : "pointer",
                    opacity: isSoldOut(e) ? 0.4 : 1,
                  }}
                >
                  Inscripción
                </button>
                <button
                  type="button"
                  onClick={() => onValidate(e.id)}
                  style={{
                    background: VERDE_CORPORATIVO,
                    color: BLANCO_CONTRASTE,
                    border: `2px solid ${NEGRO_PURO}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Check-in
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WIZARD CORREGIDO (VALIDACIÓN DE BOTÓN FINAL CORREGIDA) ───────────────────
function CreateEventWizard({ draft, setDraft, step, setStep, onDone, onCancel }) {
  const totalSteps = 4;
  const progressPercentage = (step / totalSteps) * 100;
  const [animClass, setAnimClass] = useState("animate-fade-in");

  // Estados locales independientes para el constructor cronológico
  const [dDay, setDDay] = useState("");
  const [dMonth, setDMonth] = useState("");
  const [dYear, setDYear] = useState("2026");

  const maxDay = daysInMonth(dMonth, dYear);

  useEffect(() => {
    if (dDay && Number(dDay) > maxDay) setDDay(String(maxDay));
  }, [dMonth, dYear, maxDay, dDay]);

  const updateDraft = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const handleNextStep = () => {
    setAnimClass("animate-fade-out");
    setTimeout(() => {
      let updatedDate = draft.date;
      
      // Si estamos en el último paso, armamos la string de fecha antes de guardarla en el draft final
      if (step === 4 && dDay && dMonth && dYear) {
        updatedDate = `${dYear}-${String(dMonth).padStart(2, '0')}-${String(dDay).padStart(2, '0')}`;
      }

      const updatedDraft = { ...draft, date: updatedDate };
      setDraft(updatedDraft);
      
      if (step === totalSteps) {
        onDone(updatedDraft); // Salta al Constructor Preliminar directamente
      } else {
        setStep(step + 1);
        setAnimClass("animate-fade-in");
      }
    }, 250);
  };

  const handleBackStep = () => {
    setAnimClass("animate-fade-out");
    setTimeout(() => {
      if (step > 1) {
        setStep(step - 1);
        setAnimClass("animate-fade-in");
      } else {
        onCancel();
      }
    }, 250);
  };

  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      
      <div style={{ background: BLANCO_CONTRASTE, border: `2px solid ${NEGRO_PURO}`, borderRadius: 16, padding: "32px", width: "100%", boxSizing: "border-box" }}>
        
        {/* Barra de progreso contenida dentro del marco */}
        <div style={{ width: "100%", height: "6px", background: VERDE_PASTEL_BG, borderRadius: 10, marginBottom: 32, overflow: "hidden" }}>
          <div style={{ width: `${progressPercentage}%`, height: "100%", background: VERDE_CORPORATIVO, transition: "width 0.3s ease-out" }} />
        </div>

        <div className={animClass}>
          
          {/* PASO 1 */}
          {step === 1 && (
            <div style={{ textAlign: "center" }}>
              <label style={{ fontSize: 24, fontWeight: 900, display: "block", marginBottom: 20, color: NEGRO_PURO }}>
                ¿Qué nombre llevará tu evento? *
              </label>
              <input 
                type="text"
                style={{ width: "100%", border: "none", borderBottom: `2px solid ${NEGRO_PURO}`, padding: "10px 0", fontSize: 20, fontWeight: 700, outline: "none", color: NEGRO_PURO, textAlign: "center", marginBottom: 24, background: "transparent" }}
                placeholder="Ej. Evento Especial de Café"
                value={draft.title}
                onChange={(e) => updateDraft("title", e.target.value)}
                autoFocus
              />
              <button 
                onClick={handleNextStep} 
                disabled={!draft.title.trim()}
                style={{ background: NEGRO_PURO, color: BLANCO_CONTRASTE, border: "none", padding: "12px 32px", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: !draft.title.trim() ? 0.3 : 1 }}
              >
                SIGUIENTE →
              </button>
            </div>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <div>
              <label style={{ fontSize: 22, fontWeight: 900, display: "block", marginBottom: 20, textAlign: "center", color: NEGRO_PURO }}>
                ¿Qué tipo de evento vas a realizar?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {[...EVENT_TYPE_PRESETS, "Otro (especificar)"].map((type) => {
                  const isOtro = type === "Otro (especificar)";
                  const isSelected = isOtro
                    ? draft.eventType === EVENT_TYPE_OTHER
                    : (draft.eventType || draft.desc) === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        if (isOtro) {
                          updateDraft("eventType", EVENT_TYPE_OTHER);
                        } else {
                          setDraft((p) => ({ ...p, eventType: type, eventTypeCustom: "" }));
                        }
                      }}
                      style={{
                        width: "100%", textAlign: "left", padding: "16px", borderRadius: 10, fontSize: 15, fontWeight: 700,
                        border: `2px solid ${NEGRO_PURO}`,
                        background: isSelected ? NEGRO_PURO : BLANCO_CONTRASTE,
                        color: isSelected ? BLANCO_CONTRASTE : NEGRO_PURO,
                        cursor: "pointer"
                      }}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
              {draft.eventType === EVENT_TYPE_OTHER && (
                <input
                  type="text"
                  style={{ ...inputStyle, marginBottom: 20 }}
                  placeholder="Describe el tipo de evento"
                  value={draft.eventTypeCustom || ""}
                  onChange={(e) => updateDraft("eventTypeCustom", e.target.value)}
                />
              )}
              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={
                    !(draft.eventType || draft.desc) ||
                    (draft.eventType === EVENT_TYPE_OTHER && !draft.eventTypeCustom?.trim())
                  }
                  style={{
                    background: NEGRO_PURO,
                    color: BLANCO_CONTRASTE,
                    border: "none",
                    padding: "12px 32px",
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    opacity:
                      !(draft.eventType || draft.desc) ||
                      (draft.eventType === EVENT_TYPE_OTHER && !draft.eventTypeCustom?.trim())
                        ? 0.3
                        : 1,
                  }}
                >
                  SIGUIENTE →
                </button>
              </div>
            </div>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <div>
              <label style={{ fontSize: 22, fontWeight: 900, display: "block", marginBottom: 20, textAlign: "center", color: NEGRO_PURO }}>
                ¿Cuál es el aforo aproximado de asistentes?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {[
                  { label: "Pequeño (0 a 50 personas)", value: "0-50" },
                  { label: "Mediano (50 a 100 personas)", value: "50-100" },
                  { label: "Grande (100 a 300 personas)", value: "100-300" },
                  { label: "Masivo (Más de 300 personas)", value: "300+" }
                ].map((opt) => {
                  const isSelected = draft.capacity === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => updateDraft("capacity", opt.value)}
                      style={{
                        width: "100%", textAlign: "left", padding: "16px", borderRadius: 10, fontSize: 15, fontWeight: 700,
                        border: `2px solid ${NEGRO_PURO}`,
                        background: isSelected ? NEGRO_PURO : BLANCO_CONTRASTE,
                        color: isSelected ? BLANCO_CONTRASTE : NEGRO_PURO,
                        cursor: "pointer"
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!draft.capacity}
                  style={{
                    background: NEGRO_PURO,
                    color: BLANCO_CONTRASTE,
                    border: "none",
                    padding: "12px 32px",
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    opacity: !draft.capacity ? 0.3 : 1,
                  }}
                >
                  SIGUIENTE →
                </button>
              </div>
            </div>
          )}

          {/* PASO 4 */}
          {step === 4 && (
            <div>
              <label style={{ fontSize: 22, fontWeight: 900, display: "block", marginBottom: 12, textAlign: "center", color: NEGRO_PURO }}>
                Logística del evento
              </label>
              <p style={{ fontSize: 13, color: NEGRO_MUTED_70, textAlign: "center", marginBottom: 20, lineHeight: 1.45 }}>
                Elige la ciudad, escribe el nombre del lugar y confirma en el mapa (lista de sugerencias o botón «Ubicar en mapa»).
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
                
                <div>
                  <Lbl>Fecha del Evento (Día / Mes / Año)</Lbl>
                  <div className="date-row" style={{ display: "flex", gap: 10 }}>
                    <select value={dDay} onChange={(e) => setDDay(e.target.value)} style={{ flex: 1, padding: "12px", border: `2px solid ${NEGRO_PURO}`, borderRadius: 8, fontSize: 14, fontWeight: 600, color: NEGRO_PURO, background: BLANCO_CONTRASTE }}>
                      <option value="">Día</option>
                      {Array.from({ length: maxDay }, (_, i) => (
                        <option key={i+1} value={i+1}>{i+1}</option>
                      ))}
                    </select>

                    <select value={dMonth} onChange={(e) => setDMonth(e.target.value)} style={{ flex: 1, padding: "12px", border: `2px solid ${NEGRO_PURO}`, borderRadius: 8, fontSize: 14, fontWeight: 600, color: NEGRO_PURO, background: BLANCO_CONTRASTE }}>
                      <option value="">Mes</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i+1} value={i+1}>{i+1}</option>
                      ))}
                    </select>

                    <select value={dYear} onChange={(e) => setDYear(e.target.value)} style={{ flex: 1, padding: "12px", border: `2px solid ${NEGRO_PURO}`, borderRadius: 8, fontSize: 14, fontWeight: 600, color: NEGRO_PURO, background: BLANCO_CONTRASTE }}>
                      {["2026", "2027", "2028"].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <ColombiaAddressPicker
                  value={{
                    city: draft.city,
                    address: draft.address,
                    lat: draft.lat,
                    lng: draft.lng,
                  }}
                  onChange={(loc) =>
                    setDraft((p) => ({
                      ...p,
                      city: loc.city,
                      address: loc.address,
                      location: loc.location,
                      lat: loc.lat,
                      lng: loc.lng,
                    }))
                  }
                />
              </div>

              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!dDay || !dMonth || !draft.city || !draft.address?.trim() || draft.lat == null}
                  style={{
                    background: VERDE_CORPORATIVO, color: BLANCO_CONTRASTE, border: `2px solid ${NEGRO_PURO}`, padding: "14px 28px", borderRadius: 10, fontWeight: 800, fontSize: 14,
                    cursor: "pointer", opacity: (!dDay || !dMonth || !draft.city || !draft.address?.trim() || draft.lat == null) ? 0.35 : 1
                  }}
                >
                  CREAR FORMULARIO PRELIMINAR ✨
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      <div style={{ textAlign: "left", marginTop: 16, paddingLeft: 8 }}>
        <button onClick={handleBackStep} style={{ background: "none", border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer", color: NEGRO_MUTED_70 }}>
          {step === 1 ? "← CANCELAR" : "← ATRÁS"}
        </button>
      </div>
    </div>
  );
}

// ─── BUILDER ──────────────────────────────────────────────────────────────────
function Builder({ draft, setDraft, editFid, setEditFid, onAdd, onUpdate, onDelete, onMove, onPublish }) {
  const [showTools, setShowTools] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const updateOptions = (fid, options) => onUpdate(fid, { options });

  const bldLabel = {
    display: "block", fontSize: 11, fontWeight: 800, color: "#8fa3b1",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
  };
  const iconBtn = (danger) => ({
    border: `1px solid ${danger ? "#fed7d7" : "#e2e8f0"}`,
    background: "#fff", borderRadius: 6, padding: "5px 11px",
    cursor: "pointer", fontSize: 13, color: danger ? "#e53e3e" : "#5c6b7a",
    fontWeight: 600,
  });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 80 }}>

      {/* ── Encabezado del evento ── */}
      <div className="panel-card" style={{ marginBottom: 20, overflow: "hidden" }}>
        <HeaderImageUpload
          image={draft.headerImage}
          onChange={(headerImage) => setDraft({ ...draft, headerImage })}
        />
        <div style={{ padding: "20px 24px 4px" }}>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Título del evento"
            style={{
              width: "100%", border: "none", outline: "none",
              fontSize: 24, fontWeight: 700, color: "#0d1b2a",
              background: "transparent", boxSizing: "border-box",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          />
        </div>
        <div style={{ padding: "8px 24px 20px" }}>
          <textarea
            placeholder="Descripción del evento — cuéntales a tus asistentes de qué se trata, qué esperar, código de vestimenta, etc."
            value={draft.eventDescription || ""}
            onChange={(e) => setDraft({ ...draft, eventDescription: e.target.value })}
            rows={3}
            style={{
              width: "100%", border: "none", outline: "none", resize: "none",
              fontSize: 14, color: "#5c6b7a", lineHeight: 1.7,
              background: "transparent", boxSizing: "border-box",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          />
        </div>

        {/* Configuración adicional (ubicación) — colapsable */}
        <div style={{ borderTop: "1px solid #f0f4f8" }}>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            style={{
              width: "100%", textAlign: "left", padding: "12px 24px",
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "#8fa3b1",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span>{showSettings ? "▾" : "▸"}</span>
            Ubicación y configuración del evento
          </button>
          {showSettings && (
            <div style={{ padding: "0 24px 20px" }}>
              <ColombiaAddressPicker
                value={{ city: draft.city, address: draft.address, lat: draft.lat, lng: draft.lng }}
                onChange={(loc) => setDraft((p) => ({ ...p, city: loc.city, address: loc.address, location: loc.location, lat: loc.lat, lng: loc.lng }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Encabezado de campos + acción publicar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0d1b2a" }}>
            Campos del formulario
          </h2>
          <p style={{ fontSize: 13, color: "#8fa3b1", margin: "3px 0 0" }}>
            {draft.fields.length} campo{draft.fields.length !== 1 ? "s" : ""} · Edita, reordena o añade más
          </p>
        </div>
        <button onClick={onPublish} className="soft-btn soft-btn-primary">
          Publicar evento →
        </button>
      </div>

      {/* ── Lista de campos ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {draft.fields.map((f, i) => (
          <div key={f.id} className="panel-card" style={{ overflow: "hidden" }}>
            {/* Fila principal del campo */}
            <div
              style={{
                padding: "14px 20px", display: "flex", alignItems: "center",
                justifyContent: "space-between", cursor: "pointer",
                background: editFid === f.id ? "#f0f6fc" : "#fff",
              }}
              onClick={() => setEditFid(editFid === f.id ? null : f.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#0d1b2a", display: "block" }}>
                  {f.label}
                </span>
                {f.description && (
                  <span style={{ fontSize: 12, color: "#8fa3b1", display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.description}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "#b8c5d4", display: "block", marginTop: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>
                  {f.type} {f.required ? "· Obligatorio" : "· Opcional"}
                </span>
              </div>
              <div
                style={{ display: "flex", gap: 4, marginLeft: 12, flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => onMove(f.id, -1)} disabled={i === 0} style={iconBtn(false)} title="Subir">↑</button>
                <button onClick={() => onMove(f.id, 1)} disabled={i === draft.fields.length - 1} style={iconBtn(false)} title="Bajar">↓</button>
                <button onClick={() => onDelete(f.id)} style={iconBtn(true)} title="Eliminar">✕</button>
              </div>
            </div>

            {/* Panel de edición del campo */}
            {editFid === f.id && (
              <div style={{ padding: "16px 20px", borderTop: "1px solid #f0f4f8", background: "#fafbfc" }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={bldLabel}>Pregunta o título del campo</label>
                  <input
                    className="tf-input-line"
                    style={{ fontSize: 15 }}
                    value={f.label}
                    onChange={(e) => onUpdate(f.id, { label: e.target.value })}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={bldLabel}>Descripción de ayuda (opcional)</label>
                  <input
                    className="tf-input-line"
                    style={{ fontSize: 14 }}
                    placeholder="Agrega una pista o instrucción…"
                    value={f.description || ""}
                    onChange={(e) => onUpdate(f.id, { description: e.target.value })}
                  />
                </div>
                {(f.type === "select" || f.type === "multi_select") && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={bldLabel}>Opciones de respuesta</label>
                    {(f.options || []).map((opt, oi) => (
                      <div key={oi} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input
                          className="tf-input-line"
                          style={{ flex: 1, fontSize: 14 }}
                          value={opt}
                          onChange={(e) => {
                            const next = [...(f.options || [])];
                            next[oi] = e.target.value;
                            updateOptions(f.id, next);
                          }}
                        />
                        <button type="button" style={iconBtn(true)}
                          onClick={() => updateOptions(f.id, (f.options || []).filter((_, idx) => idx !== oi))}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <button type="button" className="soft-btn soft-btn-secondary"
                      style={{ fontSize: 13, padding: "8px 14px", marginTop: 4 }}
                      onClick={() => updateOptions(f.id, [...(f.options || []), `Opción ${(f.options?.length || 0) + 1}`])}>
                      + Añadir opción
                    </button>
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#5c6b7a", cursor: "pointer" }}>
                  <input type="checkbox" checked={f.required}
                    onChange={(e) => onUpdate(f.id, { required: e.target.checked })}
                    style={{ width: 16, height: 16 }} />
                  Respuesta obligatoria
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Añadir campo ── */}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowTools((s) => !s)} className="soft-btn soft-btn-secondary"
          style={{ width: "100%", fontSize: 14 }}>
          {showTools ? "Cerrar catálogo de campos" : "+ Añadir campo al formulario"}
        </button>
      </div>

      {showTools && (
        <div className="panel-card" style={{ marginTop: 8, padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#8fa3b1", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Selecciona el tipo de campo
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {FIELD_TYPES.map((ft) => (
              <button key={ft.type} type="button"
                onClick={() => { onAdd(ft.type); setShowTools(false); }}
                className="soft-btn soft-btn-secondary"
                style={{ textAlign: "left", fontSize: 13, padding: "10px 14px" }}>
                {ft.icon} {ft.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DETALLE DEL EVENTO ────────────────────────────────────────────────────────
function Detail({ ev, onEdit, onValidate, onCrm, onShare, publicUrl: pubUrl }) {
  return (
    <div>
      <EventHeader event={ev} />
      {pubUrl && (
        <p style={{ fontSize: 12, color: NEGRO_MUTED_70, marginBottom: 12, wordBreak: "break-all" }}>
          Enlace público: <strong>{pubUrl}</strong>
        </p>
      )}
      <div className="panel-card" style={{ marginBottom: 24 }}>
        <div style={{ padding: 20, background: VERDE_PASTEL_BG }}>
        {ev.eventDescription && (
          <p style={{ fontSize: 14, color: NEGRO_MUTED_70, background: BLANCO_CONTRASTE, padding: 12, borderRadius: 8, border: `1px solid ${NEGRO_PURO}`, marginBottom: 12 }}>{ev.eventDescription}</p>
        )}
        <p style={{ margin: "0 0 4px", color: NEGRO_PURO, fontSize: 15, fontWeight: 600 }}>📅 {ev.date || "Sin fecha"}</p>
        <p style={{ margin: "0 0 4px", color: NEGRO_PURO, fontSize: 15, fontWeight: 600 }}>
          📍 {ev.city ? `${ev.city} — ` : ""}{ev.location || ev.address || "Sin ubicación"}
        </p>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{capacityLabel(ev)}</p>
        {ev.lat != null && <LocationMap lat={ev.lat} lng={ev.lng} height={200} />}
        <div className="admin-actions" style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" className="soft-btn soft-btn-primary" onClick={onCrm}>CRM inscritos</button>
          <button type="button" className="soft-btn soft-btn-secondary" onClick={onShare}>Compartir enlace</button>
          <button type="button" className="soft-btn soft-btn-secondary" onClick={onEdit}>Editar formulario</button>
          <button type="button" className="soft-btn soft-btn-secondary" onClick={onValidate}>Check-in QR</button>
        </div>
        </div>
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Resumen ({ev.registrations.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ev.registrations.length === 0 ? (
          <p style={{ fontSize: 14, color: NEGRO_MUTED_50 }}>Aún no hay inscripciones.</p>
        ) : (
          ev.registrations.map((r) => {
            const p = buildParticipant(ev, r);
            return (
              <div key={r.id} style={{ border: `2px solid ${NEGRO_PURO}`, padding: 14, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", background: BLANCO_CONTRASTE, gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: NEGRO_MUTED_50, fontFamily: "monospace" }}>{r.id}</div>
                  {r.checkedInAt && (
                    <div style={{ fontSize: 11, color: NEGRO_MUTED_70, marginTop: 4 }}>
                      Check-in: {new Date(r.checkedInAt).toLocaleString("es-MX")}
                    </div>
                  )}
                </div>
                <span style={{ background: r.used ? NEGRO_PURO : VERDE_CORPORATIVO, color: BLANCO_CONTRASTE, padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {r.used ? "CHECK-IN" : "ACTIVO"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── FORMULARIO PÚBLICO ──────────────────────────────────────────────────────
function Register({ ev, form, setFormField, errors, onSubmit, onBack }) {
  return (
    <div style={{ border: `2px solid ${NEGRO_PURO}`, borderRadius: 16, padding: 24, background: BLANCO_CONTRASTE }}>
      <button type="button" onClick={onBack} style={{ background: "none", border: "none", fontWeight: 800, cursor: "pointer", marginBottom: 16, color: NEGRO_MUTED_70 }}>← VOLVER</button>
      <EventHeader event={ev} compact />
      {ev.lat != null && <LocationMap lat={ev.lat} lng={ev.lng} height={180} />}

      {ev.eventDescription && (
        <p style={{ fontSize: 13, color: NEGRO_MUTED_70, background: VERDE_PASTEL_BG, padding: 12, borderRadius: 8, marginBottom: 24 }}>{ev.eventDescription}</p>
      )}

      {ev.fields.map((f) => {
        const err = errors[f.id];
        if (f.type === "checkbox") {
          return (
            <div key={f.id} style={{ marginBottom: 20 }}>
              {f.description && <p style={{ fontSize: 13, color: NEGRO_MUTED_50, marginBottom: 8 }}>{f.description}</p>}
              <FieldInput field={f} value={form[f.id]} onChange={setFormField} />
              <FieldError error={err} />
            </div>
          );
        }
        return (
          <div key={f.id} style={{ marginBottom: 20 }}>
            <Lbl>{f.label} {f.required && "*"}</Lbl>
            {f.description && <p style={{ fontSize: 13, color: NEGRO_MUTED_50, marginTop: -4, marginBottom: 8 }}>{f.description}</p>}
            <FieldInput field={f} value={form[f.id]} onChange={setFormField} />
            <FieldError error={err} />
          </div>
        );
      })}

      <button type="button" onClick={onSubmit} style={{ width: "100%", background: NEGRO_PURO, color: BLANCO_CONTRASTE, border: "none", padding: 14, borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 12 }}>
        Obtener mi entrada oficial →
      </button>
    </div>
  );
}

// ─── CONFIRMACIÓN (BOLETA TICKETMASTER) ────────────────────────────────────────
function Confirm({ ev, reg, onDone }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(reg.id)}&margin=10`;

  return (
    <div style={{ border: `2px solid ${NEGRO_PURO}`, borderRadius: 20, overflow: "hidden", background: BLANCO_CONTRASTE, textAlign: "center" }}>
      {ev.headerImage && (
        <img src={ev.headerImage} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ background: NEGRO_PURO, color: BLANCO_CONTRASTE, padding: "20px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: VERDE_CORPORATIVO }}>PASE DIGITAL DE ACCESO</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: "4px 0 0" }}>{ev.title}</h2>
        {ev.city && (
          <p style={{ fontSize: 13, margin: "8px 0 0", opacity: 0.9 }}>{ev.city} · {ev.location || ev.address}</p>
        )}
      </div>

      <div style={{ padding: "32px 24px", background: VERDE_PASTEL_BG }}>
        {ev.lat != null && <LocationMap lat={ev.lat} lng={ev.lng} height={160} />}
        <NavigateButtons lat={ev.lat} lng={ev.lng} label={ev.address || ev.location} />
        <div style={{ display: "inline-block", background: BLANCO_CONTRASTE, padding: "16px", borderRadius: 16, border: `2px solid ${NEGRO_PURO}`, marginBottom: 16 }}>
          <img src={qrUrl} alt="Código QR de Validación" style={{ display: "block", width: 160, height: 160 }} />
        </div>

        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: NEGRO_PURO, marginBottom: 6 }}>
          CÓDIGO: {reg.id}
        </div>
        
        <p style={{ fontSize: 13, color: NEGRO_MUTED_70, maxWidth: 400, margin: "0 auto 24px", fontWeight: 600 }}>
          Guarda una captura de pantalla de este QR. En la entrada se escaneará una sola vez; un segundo uso del mismo código será rechazado.
        </p>

        <button type="button" onClick={onDone} style={{ background: NEGRO_PURO, color: BLANCO_CONTRASTE, border: "none", padding: "12px 24px", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer", width: "100%" }}>
          Volver al evento
        </button>
      </div>
    </div>
  );
}

function Validate({ event, scopeLabel, code, setCode, result, onCheck, onScan, onReset }) {
  const [mode, setMode] = useState("camera");
  const cameraActive = mode === "camera" && !result;

  return (
    <div style={{ border: `2px solid ${NEGRO_PURO}`, borderRadius: 16, padding: 24, background: BLANCO_CONTRASTE }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, color: NEGRO_PURO }}>Check-in con QR</h2>
      <p style={{ fontSize: 13, color: NEGRO_MUTED_70, marginBottom: 20, fontWeight: 600 }}>{scopeLabel}</p>

      {!result && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setMode("camera")}
              style={{
                flex: 1,
                padding: 10,
                fontWeight: 800,
                fontSize: 13,
                border: `2px solid ${NEGRO_PURO}`,
                borderRadius: 8,
                background: mode === "camera" ? NEGRO_PURO : BLANCO_CONTRASTE,
                color: mode === "camera" ? BLANCO_CONTRASTE : NEGRO_PURO,
                cursor: "pointer",
              }}
            >
              📷 Cámara
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              style={{
                flex: 1,
                padding: 10,
                fontWeight: 800,
                fontSize: 13,
                border: `2px solid ${NEGRO_PURO}`,
                borderRadius: 8,
                background: mode === "manual" ? NEGRO_PURO : BLANCO_CONTRASTE,
                color: mode === "manual" ? BLANCO_CONTRASTE : NEGRO_PURO,
                cursor: "pointer",
              }}
            >
              ⌨️ Manual
            </button>
          </div>

          {mode === "camera" && <QrScanner active={cameraActive} onScan={onScan} />}

          {mode === "manual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="TICKET-XXXXXXXX o pega código QR"
                style={{ ...inputStyle, fontSize: 16, fontWeight: 800, textTransform: "uppercase" }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button type="button" onClick={onCheck} style={{ background: NEGRO_PURO, color: BLANCO_CONTRASTE, border: "none", padding: 14, borderRadius: 8, fontWeight: 800, cursor: "pointer" }}>
                Verificar boleto
              </button>
            </div>
          )}
        </>
      )}

      {result && (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              padding: 20,
              background: result.s === "ok" ? VERDE_PASTEL_BG : result.s === "used" ? "#FEF3C7" : ROJO_SUAVE,
              border: `2px solid ${NEGRO_PURO}`,
              borderRadius: 10,
              fontWeight: 900,
              fontSize: 16,
              marginBottom: 16,
            }}
          >
            {result.s === "ok" && "✓ CHECK-IN EXITOSO — ACCESO CONCEDIDO"}
            {result.s === "used" && "⚠️ BOLETO YA UTILIZADO — ACCESO DENEGADO"}
            {result.s === "nf" && "✕ BOLETO NO ENCONTRADO"}
          </div>

          {result.participant && result.s !== "nf" && (
            <div style={{ textAlign: "left", border: `2px solid ${NEGRO_PURO}`, borderRadius: 12, padding: 16, marginBottom: 16, background: BLANCO_CONTRASTE }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>{result.participant.name}</div>
              {result.event && (
                <p style={{ fontSize: 13, color: NEGRO_MUTED_70, margin: "0 0 12px" }}>
                  Evento: <strong>{result.event.title}</strong>
                </p>
              )}
              {result.participant.rows.map((row) => (
                <div key={row.label} style={{ fontSize: 13, marginBottom: 6, borderBottom: `1px solid ${VERDE_PASTEL_BG}`, paddingBottom: 4 }}>
                  <span style={{ fontWeight: 800 }}>{row.label}:</span> {row.value}
                </div>
              ))}
              <div style={{ fontSize: 12, fontFamily: "monospace", marginTop: 12, color: NEGRO_MUTED_50 }}>{result.ticketId}</div>
              {result.s === "used" && result.reg?.checkedInAt && (
                <p style={{ fontSize: 12, marginTop: 8, color: NEGRO_MUTED_70 }}>
                  Primer ingreso: {new Date(result.reg.checkedInAt).toLocaleString("es-MX")}
                </p>
              )}
              {result.s === "ok" && result.checkedInAt && (
                <p style={{ fontSize: 12, marginTop: 8, color: VERDE_CORPORATIVO, fontWeight: 700 }}>
                  Registrado: {new Date(result.checkedInAt).toLocaleString("es-MX")}
                </p>
              )}
            </div>
          )}

          {result.s === "nf" && (
            <p style={{ fontSize: 13, color: NEGRO_MUTED_70, marginBottom: 16 }}>
              Verifica que el código sea del evento correcto{event ? ` (${event.title})` : ""} y que la inscripción exista.
            </p>
          )}

          <button type="button" onClick={onReset} style={{ background: NEGRO_PURO, color: BLANCO_CONTRASTE, padding: "12px 24px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, width: "100%" }}>
            Escanear siguiente entrada
          </button>
        </div>
      )}
    </div>
  );
}