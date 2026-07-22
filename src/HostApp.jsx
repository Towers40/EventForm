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
import DateTimePicker from "./components/DateTimePicker.jsx";
import CreateEventForm from "./components/CreateEventForm.jsx";
import InicioView from "./pages/InicioView.jsx";
import MisEventosView from "./pages/MisEventosView.jsx";
import MisTicketsView from "./pages/MisTicketsView.jsx";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import DashboardView from "./pages/DashboardView.jsx";
import MiCuentaView from "./pages/MiCuentaView.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { api, apiEnabled } from "./lib/api.js";
import { loadEvents, saveEvents } from "./lib/storage.js";
import {
  performCheckIn,
  validateRegistrationForm,
  buildParticipant,
  parseTicketCode,
} from "./lib/tickets.js";
import { isSoldOut, capacityLabel, getCapacityMax } from "./lib/capacity.js";
import { publicBaseUrl } from "./lib/platform.js";
import SlideToCancel from "./components/SlideToCancel.jsx";
import {
  EVENT_TYPE_OTHER,
  EVENT_TYPE_PRESETS,
  formatEventType,
} from "./lib/colombia.js";
import { DISCOVER_CATEGORIES } from "./lib/categories.js";
import { CAT_ICONS } from "./lib/categoryIcons.jsx";
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

// Botón de acción solo-icono del encabezado en móvil (Inicio · Dashboard · +).
const mobileIconBtn = (active) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 36, height: 36, flexShrink: 0, padding: 0, borderRadius: 10, cursor: "pointer",
  background: active ? "rgba(107,159,212,0.18)" : "transparent",
  border: `1px solid ${active ? "rgba(107,159,212,0.35)" : "transparent"}`,
  color: active ? "#c8dff0" : "rgba(232,234,240,0.7)",
});

// ─── ICONOS SVG (heredan color con currentColor) ──────────────────────────────
const svgBase = (s = 18) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" });
function IconHome({ size }) { return <svg {...svgBase(size)}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>; }
function IconCalendar({ size }) { return <svg {...svgBase(size)}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>; }
function IconChart({ size }) { return <svg {...svgBase(size)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>; }
function IconGear({ size }) { return <svg {...svgBase(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1A2 2 0 1 1 8.5 5.4l.1.1A1.6 1.6 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z" /></svg>; }
function IconSearch({ size }) { return <svg {...svgBase(size)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>; }
function IconPlus({ size }) { return <svg {...svgBase(size)}><path d="M12 5v14M5 12h14" /></svg>; }
function IconPencil({ size = 11 }) { return <svg {...svgBase(size)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>; }
function IconCamera({ size }) { return <svg {...svgBase(size)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>; }
function IconKeyboard({ size }) { return <svg {...svgBase(size)}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h0M10 9h0M14 9h0M18 9h0M6 13h0M10 13h0M14 13h0M18 13h0M8 17h8" /></svg>; }
function IconScan({ size = 16 }) { return <svg {...svgBase(size)}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M3 12h18" /></svg>; }
function IconTicket({ size }) { return <svg {...svgBase(size)}><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" /><path d="M13 7v10" strokeDasharray="2 2" /></svg>; }
function IconUser({ size }) { return <svg {...svgBase(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>; }
function IconCompass({ size }) { return <svg {...svgBase(size)}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>; }

// Iconos del catálogo de campos (adaptados a cada tipo)
function IconFieldText({ size = 16 }) { return <svg {...svgBase(size)}><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M7 11v2" /></svg>; }
function IconFieldEmail({ size = 16 }) { return <svg {...svgBase(size)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>; }
function IconFieldPhone({ size = 16 }) { return <svg {...svgBase(size)}><path d="M5 4h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>; }
function IconFieldAge({ size = 16 }) { return <svg {...svgBase(size)}><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></svg>; }
function IconFieldNumber({ size = 16 }) { return <svg {...svgBase(size)}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></svg>; }
function IconFieldTextarea({ size = 16 }) { return <svg {...svgBase(size)}><path d="M4 6h16M4 10h16M4 14h12M4 18h8" /></svg>; }
function IconFieldSelect({ size = 16 }) { return <svg {...svgBase(size)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" /></svg>; }
function IconFieldMulti({ size = 16 }) { return <svg {...svgBase(size)}><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 1.4 1.4L6.5 5" /><path d="m3 12 1.4 1.4L6.5 11" /><path d="m3 18 1.4 1.4L6.5 17" /></svg>; }
function IconFieldCheck({ size = 16 }) { return <svg {...svgBase(size)}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8 12 3 3 5-6" /></svg>; }

const FIELD_TYPES = [
  { type: "text", label: "Texto corto", icon: <IconFieldText /> },
  { type: "email", label: "Email", icon: <IconFieldEmail /> },
  { type: "phone", label: "Teléfono", icon: <IconFieldPhone /> },
  { type: "age", label: "Edad", icon: <IconFieldAge /> },
  { type: "number", label: "Número", icon: <IconFieldNumber /> },
  { type: "textarea", label: "Texto largo", icon: <IconFieldTextarea /> },
  { type: "select", label: "Selección única", icon: <IconFieldSelect /> },
  { type: "multi_select", label: "Selección múltiple", icon: <IconFieldMulti /> },
  { type: "checkbox", label: "Verificación", icon: <IconFieldCheck /> },
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

const tfLabel = {
  fontSize: 11,
  fontWeight: 800,
  color: "#5c6b7a",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

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
  return ev.publicUrl || `${publicBaseUrl()}/e/${ev.slug || ev.id}`;
}

function formatEventSchedule(ev) {
  if (ev?.startDate && ev?.startTime) {
    const start = `${ev.startDate} ${ev.startTime}`;
    const end = ev.endDate && ev.endTime ? ` → ${ev.endDate} ${ev.endTime}` : "";
    return `${start}${end}`;
  }
  return ev?.date || "Sin fecha";
}

const CAPACITY_OPTIONS = [
  { label: "Menos de 50 personas", value: "under-50" },
  { label: "Pequeño (hasta 50 personas)", value: "0-50" },
  { label: "Mediano (50 a 100 personas)", value: "50-100" },
  { label: "Grande (100 a 300 personas)", value: "100-300" },
  { label: "Masivo (más de 300 personas)", value: "300+" },
];

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function HostApp({ initialDraft = null, onDraftConsumed }) {
  const { user, token, logout, isSuperAdmin, apiEnabled: apiOn, patchUser } = useAuth();

  const _pendingSaved = localStorage.getItem("ef_pending_draft");
  const _pendingParsed = _pendingSaved ? (() => { try { return JSON.parse(_pendingSaved); } catch { return null; } })() : null;
  // Ignore stale _openCreate markers — treat as no draft
  const _realInitial = initialDraft?._openCreate ? null : initialDraft;
  const _realPending = _pendingParsed?._openCreate ? null : _pendingParsed;

  const [draft, setDraft] = useState(() => {
    if (_realInitial) return _realInitial;
    if (_realPending) return _realPending;
    return null;
  });

  const _hasDraft = Boolean(_realInitial || _realPending);
  const [view, setView] = useState(_hasDraft ? "builder" : "inicio");
  const [events, setEvents] = useState(() => (apiOn ? [] : loadEvents()));
  const [shareEv, setShareEv] = useState(null);
  const [evId, setEvId] = useState(null);
  const [regId, setRegId] = useState(null);
  const [editFid, setEditFid] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [vCode, setVCode] = useState("");
  const [vResult, setVResult] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createReturn, setCreateReturn] = useState("inicio");
  const [accountReturn, setAccountReturn] = useState("inicio");
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try { return localStorage.getItem("ef_avatar") || null; } catch { return null; }
  });

  // Foto de perfil: prioriza la guardada en el servidor (cross-device);
  // si no, usa la copia local en caché por cuenta.
  useEffect(() => {
    if (!user) return;
    try {
      const key = `ef_avatar_${user.id || user.email}`;
      if (user.avatar) {
        setAvatarUrl(user.avatar);
        try { localStorage.setItem(key, user.avatar); } catch {}
      } else {
        setAvatarUrl(localStorage.getItem(key) || null);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    localStorage.removeItem("ef_pending_draft");
    onDraftConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventsRef = useRef(events);
  const evIdRef = useRef(evId);
  const viewRef = useRef(view);
  const draftRef = useRef(draft);
  eventsRef.current = events;
  evIdRef.current = evId;
  viewRef.current = view;
  draftRef.current = draft;

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = animationStyles;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  useEffect(() => {
    if (!apiOn) saveEvents(events);
  }, [events, apiOn]);

  const refreshEvents = useCallback(async () => {
    if (!apiOn || !token) return;
    try {
      const { events: list } = await api.events(token);
      setEvents(list.map((e) => ({ ...e, _persisted: true })));
    } catch (e) {
      console.error(e);
    }
  }, [apiOn, token]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents, isSuperAdmin]);

  const ev = events.find((e) => e.id === evId);

  const saveDraftToEvents = (d) => {
    if (!d?.title?.trim()) return;
    const existing = events.find((e) => e.id === d.id);
    // No degradar a borrador un evento ya publicado al navegar hacia atrás:
    // queda en la sección en la que estaba.
    if (existing && !existing.isDraft) return;
    const draftEv = { ...d, isDraft: true };
    localStorage.setItem("ef_builder_draft", JSON.stringify(draftEv));
    setEvents((prev) => {
      const exists = prev.find((e) => e.id === d.id);
      return exists
        ? prev.map((e) => (e.id === d.id ? draftEv : e))
        : [...prev, draftEv];
    });
  };

  // ── Historial del navegador: cada cambio de `view` es un "paso" navegable.
  // Así, el botón atrás del navegador (o el gesto/botón atrás en móvil) regresa
  // al paso anterior dentro de la app en vez de salir de /app o no hacer nada.
  const pushHistory = (v, id = null) => {
    try {
      const cur = window.history.state;
      if (cur && cur.efView === v && (cur.efEvId ?? null) === (id ?? null)) return;
      window.history.pushState({ efView: v, efEvId: id ?? null }, "");
    } catch { /* noop (SSR / navegador sin history API) */ }
  };

  const applyHistoryState = (state) => {
    if (viewRef.current === "builder" && draftRef.current) saveDraftToEvents(draftRef.current);
    setView(state?.efView || "inicio");
    setEvId(state?.efEvId ?? null);
    setEditFid(null);
    setVResult(null);
    setVCode("");
    setForm({});
    setErrors({});
  };

  useEffect(() => {
    // Deja sembrada la entrada inicial para que el primer "atrás" tenga a dónde ir.
    try { window.history.replaceState({ efView: viewRef.current, efEvId: evIdRef.current ?? null }, ""); } catch { /* noop */ }
    const onPopState = (e) => applyHistoryState(e.state);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (v, id = null) => {
    if (view === "builder" && draft) saveDraftToEvents(draft);
    setView(v);
    setEvId(id);
    setEditFid(null);
    setVResult(null);
    setVCode("");
    setForm({});
    setErrors({});
    pushHistory(v, id);
  };

  const openValidate = (id = null) => {
    setEvId(id);
    setView("validate");
    setVResult(null);
    setVCode("");
    pushHistory("validate", id);
    // Trae las inscripciones más recientes para que el escáner las encuentre.
    refreshEvents();
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
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      city: "",
      location: "",
      address: "",
      locationInstructions: "",
      lat: null,
      lng: null,
      capacity: "",
      capacityCustom: "",
      headerImage: "",
      fields: [],
      registrations: [],
      eventDescription: "",
      requireApproval: false,
      priceType: "free",
      price: "",
      visibility: "public",
    });
    setEvId(null);
    setCreateReturn(view === "create_wizard" || view === "builder" ? "inicio" : view);
    setView("create_wizard");
    pushHistory("create_wizard", null);
  };

  const editEvent = (event) => {
    setDraft({ ...event, fields: [...(event.fields || [])], registrations: [...(event.registrations || [])] });
    setEvId(event.id);
    if (event.isDraft) localStorage.removeItem("ef_builder_draft");
    setCreateReturn(view === "create_wizard" || view === "builder" ? "mis_eventos" : view);
    setView("create_wizard"); // passes through CreateEventForm for consistent UX
    pushHistory("create_wizard", event.id);
  };

  const generatePreliminaryForm = (finalDraft) => {
    // If editing an existing event (already has fields), go straight to builder
    if (finalDraft.fields?.length > 0) {
      setDraft(finalDraft);
      setView("builder");
      pushHistory("builder", evId);
      return;
    }
    // New event: generate base registration fields
    const baseFields = [
      { id: "F" + uid(), type: "text", label: "Nombre completo del asistente", description: "Escribe tus nombres tal como aparecen en tu documento", placeholder: "", required: true, options: [] },
      { id: "F" + uid(), type: "email", label: "Correo electrónico", description: "Usa un correo al que tengas acceso; lo verás en tu boleto", placeholder: "", required: true, options: [] }
    ];
    setDraft({ ...finalDraft, fields: baseFields });
    setView("builder");
    pushHistory("builder", evId);
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
      localStorage.removeItem("ef_builder_draft");
      setEvents((p) => p.map((e) => e.id === saved.id ? { ...saved, isDraft: false } : e));
      setView("mis_eventos");
      pushHistory("mis_eventos", saved.id);
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
    pushHistory("confirm", evId);
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

  // Persiste el check-in en el servidor para que no se pierda al cerrar la app.
  const persistCheckIn = useCallback(async (result) => {
    if (!apiOn || !token) return;
    if (result.status !== "ok" || !result.event) return;
    try {
      const res = await api.checkIn(token, result.event.id, result.ticketId);
      if (res?.status === "used") {
        // Ya estaba usado en el servidor (doble escaneo) → acceso denegado.
        setVResult((prev) =>
          prev && prev.ticketId === result.ticketId
            ? { ...prev, s: "used", checkedInAt: undefined }
            : prev
        );
      }
    } catch { /* sin conexión: queda el estado local */ }
  }, [apiOn, token]);

  // Validación contra el servidor (fuente de verdad en vivo): encuentra el
  // ticket aunque la persona se haya inscrito después de abrir la app.
  const finishWithServer = useCallback(async (ticketId, ev) => {
    try {
      const res = await api.checkIn(token, ev.id, ticketId);
      const reg = res.reg
        ? { id: res.reg.id, data: res.reg.data, used: true, checkedInAt: res.reg.checkedInAt }
        : null;
      const participant = reg ? buildParticipant(ev, reg) : null;
      if (res.status === "ok") {
        setEvents((prev) => prev.map((e) => {
          if (e.id !== ev.id) return e;
          const has = e.registrations.some((r) => r.id === ticketId);
          return {
            ...e,
            registrations: has
              ? e.registrations.map((r) => r.id === ticketId ? { ...r, used: true, checkedInAt: res.reg.checkedInAt } : r)
              : [...e.registrations, { id: ticketId, data: res.reg.data, used: true, checkedInAt: res.reg.checkedInAt }],
          };
        }));
        setVResult({ s: "ok", ticketId, event: ev, reg, participant, checkedInAt: res.reg?.checkedInAt });
      } else if (res.status === "used") {
        setVResult({ s: "used", ticketId, event: ev, reg, participant });
      } else {
        // nf / cancelled
        setVResult({ s: "nf", ticketId });
      }
      return true;
    } catch {
      return false; // sin conexión → usar validación local
    }
  }, [token]);

  const validateTicket = useCallback(async (rawCode) => {
    const ticketId = parseTicketCode(rawCode);
    if (!ticketId) { setVResult({ s: "nf", ticketId: "" }); return; }
    const evId = evIdRef.current;
    const ev = evId ? eventsRef.current.find((e) => e.id === evId) : null;
    if (apiOn && token && evId && ev) {
      const ok = await finishWithServer(ticketId, ev);
      if (ok) return;
    }
    // Fallback local (sin API o escaneo de "todos los eventos")
    const result = performCheckIn(eventsRef.current, ticketId, evId || null);
    applyCheckInResult(result);
    persistCheckIn(result);
  }, [apiOn, token, finishWithServer, persistCheckIn]);

  const runCheckIn = useCallback((rawCode) => {
    validateTicket(rawCode || vCode);
  }, [vCode, validateTicket]);

  const handleQrScan = useCallback((decoded) => {
    setVCode(decoded);
    validateTicket(decoded);
  }, [validateTicket]);

  const confirmEv = events.find((e) => e.id === evId);
  const confirmReg = confirmEv?.registrations.find((r) => r.id === regId);

  const showScannerNav = ["inicio", "mis_eventos", "detail", "validate"].includes(view);

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "?";

  // Items de la barra inferior tipo liquid glass (móvil).
  const BOTTOM_NAV = [
    { key: "mis_eventos", label: "Mis eventos", icon: <IconCalendar /> },
    { key: "mis_tickets", label: "Tickets",     icon: <IconTicket /> },
    { key: "discover",    label: "Descubrir",   icon: <IconCompass /> },
  ];

  // Navegación principal del encabezado (escritorio) — inspirada en Luma.
  const HEADER_NAV = [
    { key: "inicio",      label: "Inicio" },
    { key: "mis_eventos", label: "Mis eventos" },
    { key: "mis_tickets", label: "Tickets" },
    { key: "discover",    label: "Descubrir" },
    { key: "stats",       label: "Dashboard" },
  ];

  const searchResults = searchQuery.trim()
    ? events.filter((e) => {
        const q = searchQuery.trim().toLowerCase();
        return (e.title || "").toLowerCase().includes(q) || (e.city || "").toLowerCase().includes(q) || (e.location || "").toLowerCase().includes(q);
      })
    : events;

  return (
    <div
      className="app-shell"
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        minHeight: "100vh",
        background: "transparent",
        color: "#e8eaf0",
        textAlign: "left",
      }}
    >
      {/* ── ENCABEZADO ── avatar+logo (izq) · navegación centrada (escritorio) · Nuevo evento (der) */}
      <nav className="ef-topbar" style={{ background: "rgba(18,20,34,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 20px", height: 60, alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
        {/* Izquierda: avatar (Mi cuenta) + logo */}
        <div style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <button
            type="button"
            className="ef-hover-fill"
            onClick={() => {
              if (view === "mi_cuenta") { go(accountReturn || "inicio"); }
              else { setAccountReturn(view); go("mi_cuenta"); }
            }}
            style={{
              width: 42, height: 42, borderRadius: "50%",
              boxSizing: "border-box",
              backgroundColor: "#0d3b66",
              backgroundImage: avatarUrl ? `url("${avatarUrl}")` : "linear-gradient(135deg, #0d3b66, #1a5f8a)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              border: "2px solid rgba(107,159,212,0.35)",
              cursor: "pointer", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 800, color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              flexShrink: 0,
              padding: 0,
            }}
            title="Mi cuenta"
          >
            {!avatarUrl && initials}
          </button>
          <button type="button" className="ef-hover-fill ef-logo-text" onClick={() => go("inicio")} style={{ background: "none", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 17, color: "#e8eaf0", whiteSpace: "nowrap" }}>
            <span style={{ color: VERDE_CORPORATIVO, fontSize: 20 }}>●</span>
            EventForm
          </button>
        </div>

        {/* Centro: navegación principal (solo escritorio — en móvil la cubre la barra inferior + acciones por página) */}
        <div className="ef-header-nav" style={{ alignItems: "center", gap: 2 }}>
          {HEADER_NAV.map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className="ef-hover-fill"
                onClick={() => go(item.key)}
                style={{
                  background: active ? "rgba(107,159,212,0.18)" : "transparent",
                  border: active ? "1px solid rgba(107,159,212,0.35)" : "1px solid transparent",
                  borderRadius: 10, padding: "8px 14px", whiteSpace: "nowrap",
                  fontSize: 13.5, fontWeight: active ? 700 : 600,
                  color: active ? "#c8dff0" : "rgba(232,234,240,0.65)",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Derecha: acciones. En escritorio, "Nuevo evento" con texto; en móvil,
            solo iconos (casa · dashboard · +) para que todo quepa en el encabezado. */}
        <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <div className="ef-mobile-actions" style={{ alignItems: "center", gap: 2 }}>
            <button type="button" className="ef-hover-fill" onClick={() => go("inicio")} title="Inicio" aria-label="Inicio" style={mobileIconBtn(view === "inicio")}>
              <IconHome size={19} />
            </button>
            <button type="button" className="ef-hover-fill" onClick={() => go("stats")} title="Dashboard" aria-label="Dashboard" style={mobileIconBtn(view === "stats")}>
              <IconChart size={19} />
            </button>
            <button type="button" className="ef-hover-fill" onClick={startNew} title="Nuevo evento" aria-label="Nuevo evento" style={{ ...mobileIconBtn(false), background: "rgba(107,159,212,0.18)", border: "1px solid rgba(107,159,212,0.35)", color: "#c8dff0" }}>
              <IconPlus size={19} />
            </button>
          </div>
          <div className="ef-header-nav">
            <button type="button" className="ef-hover-fill" onClick={startNew} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(107,159,212,0.18)", border: "1px solid rgba(107,159,212,0.35)", borderRadius: 10, padding: "9px 16px", color: "#c8dff0", fontWeight: 700, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>
              <IconPlus size={15} /> Nuevo evento
            </button>
          </div>
        </div>
      </nav>

      {shareEv && (
        <ShareEventModal event={shareEv} onClose={() => setShareEv(null)} />
      )}

      <main className="app-main">
        {view === "inicio" && (
          <InicioView events={events} onNew={startNew} onGoTo={(v) => go(v)} />
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
        {view === "mis_tickets" && <MisTicketsView />}
        {view === "discover" && <DiscoverPage embedded />}
        {view === "mi_cuenta" && <MiCuentaView />}
        {view === "create_wizard" && (
          <CreateEventForm
            draft={draft}
            setDraft={setDraft}
            onDone={generatePreliminaryForm}
            onCancel={() => go(createReturn || "inicio")}
            isEditing={Boolean(evId)}
            user={user}
            avatarUrl={avatarUrl}
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
            publicUrl={`${publicBaseUrl()}/e/${ev.slug || ev.id}`}
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
            onClose={() => (evId ? go("crm", evId) : go("mis_eventos"))}
          />
        )}
      </main>

      {view !== "create_wizard" && (
        <footer style={{ background: "transparent", borderTop: "1px solid rgba(255,255,255,0.07)", padding: 20, textAlign: "center", fontSize: 12, color: "rgba(232,234,240,0.3)", marginTop: 48, paddingBottom: 110 }}>
          EventForm Colombia © 2026
        </footer>
      )}

      {/* ── BARRA INFERIOR LIQUID GLASS ── */}
      {view !== "create_wizard" && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, display: "flex", justifyContent: "center", padding: "0 12px 14px", pointerEvents: "none" }}>
          <div style={{
            pointerEvents: "auto",
            display: "flex", alignItems: "stretch", gap: 4,
            width: "100%", maxWidth: 440,
            background: "rgba(28,32,54,0.55)",
            backdropFilter: "blur(22px) saturate(160%)", WebkitBackdropFilter: "blur(22px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 24, padding: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}>
            {BOTTOM_NAV.map(({ key, label, icon, to }) => {
              const active = view === key;
              return (
                <button key={key} type="button" className="ef-hover-fill" onClick={() => go(key)}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                    background: active ? "rgba(107,159,212,0.22)" : "transparent",
                    border: active ? "1px solid rgba(107,159,212,0.35)" : "1px solid transparent",
                    borderRadius: 16, padding: "9px 4px", cursor: "pointer",
                    color: active ? "#c8dff0" : "rgba(232,234,240,0.6)",
                  }}>
                  <span style={{ display: "flex" }}>{icon}</span>
                  <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 600, letterSpacing: "0.01em" }}>{label}</span>
                </button>
              );
            })}
            {/* Separador + buscar */}
            <div style={{ width: 1, background: "rgba(255,255,255,0.12)", margin: "8px 2px" }} />
            <button type="button" className="ef-hover-fill" onClick={() => { setSearchOpen(true); setSearchQuery(""); }} title="Buscar eventos"
              style={{
                flex: "0 0 auto", width: 54, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                background: "transparent", border: "1px solid transparent", borderRadius: 16, padding: "9px 4px", cursor: "pointer",
                color: "rgba(232,234,240,0.6)",
              }}>
              <span style={{ display: "flex" }}><IconSearch /></span>
              <span style={{ fontSize: 10.5, fontWeight: 600 }}>Buscar</span>
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DE BÚSQUEDA DE EVENTOS ── */}
      {searchOpen && (
        <div onClick={() => setSearchOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 16px 16px" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "78vh", display: "flex", flexDirection: "column", background: "rgba(20,23,40,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ display: "flex", color: "#6b9fd4" }}><IconSearch /></span>
              <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar mis eventos…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e8eaf0", fontSize: 16, fontFamily: "inherit" }} />
              <button type="button" className="ef-hover-fill" onClick={() => setSearchOpen(false)} style={{ background: "none", border: "none", borderRadius: "50%", color: "#8fa3b1", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: 8 }}>
              {searchResults.length === 0 ? (
                <p style={{ textAlign: "center", color: "rgba(232,234,240,0.5)", fontSize: 14, padding: "28px 12px" }}>Sin resultados.</p>
              ) : (
                searchResults.map((e) => (
                  <button key={e.id} type="button" className="ef-hover-fill"
                    onClick={() => { setSearchOpen(false); if (e.isDraft) editEvent(e); else go("crm", e.id); }}
                    style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 12, background: "transparent", border: "none", cursor: "pointer", color: "#e8eaf0" }}>
                    <span style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, overflow: "hidden", background: "rgba(107,159,212,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {e.headerImage ? <img src={e.headerImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconCalendar />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title || "Sin título"}</span>
                      <span style={{ display: "block", fontSize: 12, color: "rgba(232,234,240,0.5)" }}>{e.isDraft ? "Borrador" : (e.city || e.location || "Evento")}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
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
  const totalSteps = 6;
  const progressPercentage = (step / totalSteps) * 100;
  const [animClass, setAnimClass] = useState("animate-fade-in");

  const updateDraft = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const handleNextStep = () => {
    setAnimClass("animate-fade-out");
    setTimeout(() => {
      let updatedDate = draft.date;
      
      if (step === 4 && draft.startDate) {
        updatedDate = draft.startDate;
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

  const canProceed =
    (step === 1 && draft.title.trim()) ||
    (step === 2 &&
      (draft.eventType || draft.desc) &&
      !(draft.eventType === EVENT_TYPE_OTHER && !draft.eventTypeCustom?.trim())) ||
    (step === 3 &&
      draft.capacity &&
      (draft.capacity !== "under-50" ||
        (Number(draft.capacityCustom) > 0 && Number(draft.capacityCustom) < 50))) ||
    (step === 4 && draft.startDate && draft.startTime && draft.endDate && draft.endTime) ||
    (step === 5 && draft.city && draft.address?.trim()) ||
    step === 6;

  return (
    <div className="host-tf-wizard">
      <div className="tf-progress host-tf-progress">
        <div className="tf-progress-fill" style={{ width: `${progressPercentage}%` }} />
      </div>

      <div className={`host-tf-body ${animClass}`}>
        {step === 1 && (
          <>
            <div className="tf-step-num">1</div>
            <h2 className="tf-question">¿Qué nombre llevará tu evento?</h2>
            <p className="tf-hint">Elige un nombre memorable para tus asistentes.</p>
            <input
              className="tf-input-line"
              type="text"
              placeholder="Ej. Congreso de Innovación 2026"
              value={draft.title}
              onChange={(e) => updateDraft("title", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canProceed && handleNextStep()}
              autoFocus
            />
          </>
        )}

        {step === 2 && (
          <>
            <div className="tf-step-num">2</div>
            <h2 className="tf-question">¿Qué tipo de evento vas a realizar?</h2>
            <p className="tf-hint">Selecciona la categoría que mejor lo describe.</p>
            {[...EVENT_TYPE_PRESETS, "Otro (especificar)"].map((type) => {
              const isOtro = type === "Otro (especificar)";
              const isSelected = isOtro
                ? draft.eventType === EVENT_TYPE_OTHER
                : (draft.eventType || draft.desc) === type;
              return (
                <button
                  key={type}
                  type="button"
                  className={`tf-choice${isSelected ? " selected" : ""}`}
                  onClick={() => {
                    if (isOtro) updateDraft("eventType", EVENT_TYPE_OTHER);
                    else setDraft((p) => ({ ...p, eventType: type, eventTypeCustom: "" }));
                  }}
                >
                  {type}
                </button>
              );
            })}
            {draft.eventType === EVENT_TYPE_OTHER && (
              <input
                className="tf-input-line"
                style={{ marginTop: 16 }}
                placeholder="Describe el tipo de evento"
                value={draft.eventTypeCustom || ""}
                onChange={(e) => updateDraft("eventTypeCustom", e.target.value)}
                autoFocus
              />
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="tf-step-num">3</div>
            <h2 className="tf-question">¿Cuál es el aforo aproximado?</h2>
            <p className="tf-hint">Esto nos ayuda a preparar el formulario adecuado para tu evento.</p>
            {CAPACITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`tf-choice${draft.capacity === opt.value ? " selected" : ""}`}
                onClick={() =>
                  setDraft((p) => ({
                    ...p,
                    capacity: opt.value,
                    capacityCustom: opt.value === "under-50" ? p.capacityCustom : "",
                  }))
                }
              >
                {opt.label}
              </button>
            ))}
            <input
              className="tf-input-line"
              type="number"
              min="1"
              max="49"
              inputMode="numeric"
              placeholder="Cantidad exacta de asistentes"
              value={draft.capacityCustom || ""}
              disabled={draft.capacity !== "under-50"}
              onChange={(e) => updateDraft("capacityCustom", e.target.value)}
              style={{ marginTop: 12, opacity: draft.capacity === "under-50" ? 1 : 0.35 }}
            />
            {draft.capacity === "under-50" && (
              <p className="tf-hint" style={{ marginTop: 10, fontSize: 13 }}>
                Escribe un número entre 1 y 49.
              </p>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div className="tf-step-num">4</div>
            <h2 className="tf-question">¿Cuándo será tu evento?</h2>
            <p className="tf-hint">Selecciona fecha y hora de inicio y de finalización.</p>
            <div style={{ display: "grid", gap: 28 }}>
              <div>
                <DateTimePicker
                  label="Inicio del evento"
                  date={draft.startDate}
                  time={draft.startTime}
                  minDate={new Date().toISOString().split("T")[0]}
                  onChange={({ date, time }) =>
                    setDraft(p => ({ ...p, startDate: date, startTime: time, date: date, endDate: p.endDate || date }))
                  }
                />
              </div>
              <div>
                <DateTimePicker
                  label="Fin del evento"
                  date={draft.endDate}
                  time={draft.endTime}
                  minDate={draft.startDate || new Date().toISOString().split("T")[0]}
                  onChange={({ date, time }) =>
                    setDraft(p => ({ ...p, endDate: date, endTime: time }))
                  }
                />
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div className="tf-step-num">5</div>
            <h2 className="tf-question">¿Dónde será el evento?</h2>
            <p className="tf-hint">Selecciona ciudad, lugar o dirección. Puedes añadir instrucciones si la llegada necesita más contexto.</p>
            <div className="host-tf-location">
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
            <div style={{ marginTop: 28 }}>
              <p style={tfLabel}>Instrucciones adicionales opcionales</p>
              <textarea
                className="tf-input-line"
                rows={3}
                placeholder="Ej. Entrada por la portería norte, preguntar por recepción…"
                value={draft.locationInstructions || ""}
                onChange={(e) => updateDraft("locationInstructions", e.target.value)}
                style={{ resize: "vertical", minHeight: 92, lineHeight: 1.4 }}
              />
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <div className="tf-step-num">6</div>
            <h2 className="tf-question">Agrega una imagen para tu evento</h2>
            <p className="tf-hint">Será la portada del enlace público y del pase QR. Puedes continuar sin imagen si aún no la tienes.</p>
            <HeaderImageUpload
              image={draft.headerImage}
              onChange={(headerImage) => updateDraft("headerImage", headerImage)}
            />
          </>
        )}
      </div>

      <div className="host-tf-footer">
        <button type="button" className="tf-btn-back" onClick={handleBackStep} aria-label={step === 1 ? "Cancelar" : "Atrás"}>
          ↑
        </button>
        <button type="button" className="tf-btn-ok" onClick={handleNextStep} disabled={!canProceed}>
          {step === totalSteps ? "Continuar" : "OK ✓"}
        </button>
        <span style={{ fontSize: 12, color: "#9B9B9B", userSelect: "none" }}>
          Presiona Enter ↵
        </span>
      </div>
    </div>
  );
}

// ─── BUILDER ──────────────────────────────────────────────────────────────────
function Builder({ draft, setDraft, editFid, setEditFid, onAdd, onUpdate, onDelete, onMove, onPublish }) {
  const [showTools, setShowTools] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const updateOptions = (fid, options) => onUpdate(fid, { options });

  const handleDrop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const fields = [...draft.fields];
    const from = fields.findIndex((f) => f.id === dragId);
    const to = fields.findIndex((f) => f.id === targetId);
    const [moved] = fields.splice(from, 1);
    fields.splice(to, 0, moved);
    setDraft((p) => ({ ...p, fields }));
    setDragId(null); setDragOverId(null);
  };

  const bldLabel = {
    display: "block", fontSize: 11, fontWeight: 800, color: "#8fa3b1",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
  };

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", paddingBottom: 80 }}>

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
              fontSize: 24, fontWeight: 700, color: "#e8eaf0",
              background: "transparent", boxSizing: "border-box",
              fontFamily: "system-ui, -apple-system, sans-serif",
              textAlign: "center",
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
              fontSize: 14, color: "rgba(232,234,240,0.5)", lineHeight: 1.7,
              background: "transparent", boxSizing: "border-box",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          />
        </div>

        {/* Configuración adicional (ubicación) — colapsable */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
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
            <div style={{ padding: "0 24px 20px", display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <DateTimePicker
                    label="Inicio"
                    date={draft.startDate}
                    time={draft.startTime}
                    minDate={new Date().toISOString().split("T")[0]}
                    onChange={({ date, time }) => {
                      const today = new Date().toISOString().split("T")[0];
                      if (date && date < today) return;
                      setDraft(p => ({ ...p, startDate: date, startTime: time, date: date, endDate: p.endDate || date }));
                    }}
                  />
                </div>
                <div>
                  <DateTimePicker
                    label="Fin"
                    date={draft.endDate}
                    time={draft.endTime}
                    minDate={draft.startDate || new Date().toISOString().split("T")[0]}
                    onChange={({ date, time }) => {
                      if (date && draft.startDate && date < draft.startDate) return;
                      if (date === draft.startDate && time && draft.startTime && time <= draft.startTime) return;
                      setDraft(p => ({ ...p, endDate: date, endTime: time }));
                    }}
                  />
                </div>
              </div>
              <ColombiaAddressPicker
                value={{ city: draft.city, address: draft.address, lat: draft.lat, lng: draft.lng }}
                onChange={(loc) => setDraft((p) => ({ ...p, city: loc.city, address: loc.address, location: loc.location, lat: loc.lat, lng: loc.lng }))}
              />
              <div>
                <label style={bldLabel}>Instrucciones de llegada (opcional)</label>
                <textarea
                  className="tf-input-line"
                  rows={3}
                  placeholder="Ej. Entrada por la portería norte, preguntar por recepción…"
                  value={draft.locationInstructions || ""}
                  onChange={(e) => setDraft((p) => ({ ...p, locationInstructions: e.target.value }))}
                  style={{ fontSize: 14, resize: "vertical", minHeight: 84 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Encabezado de campos ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#e8eaf0" }}>
          Campos del formulario
        </h2>
        <p style={{ fontSize: 13, color: "#8fa3b1", margin: "3px 0 0" }}>
          {draft.fields.length} campo{draft.fields.length !== 1 ? "s" : ""} · Edita, reordena o añade más
        </p>
      </div>

      {/* ── Lista de campos ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {draft.fields.map((f) => (
          <div
            key={f.id}
            draggable
            onDragStart={() => setDragId(f.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(f.id); }}
            onDrop={() => handleDrop(f.id)}
            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
            className="panel-card"
            style={{
              overflow: "hidden", position: "relative",
              opacity: dragId === f.id ? 0.4 : 1,
              outline: dragOverId === f.id && dragId !== f.id ? "2px solid rgba(107,159,212,0.5)" : "none",
              cursor: "grab",
              transition: "outline 0.1s",
            }}
          >
            {/* × en esquina superior derecha */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
              title="Eliminar campo"
              style={{
                position: "absolute", top: 8, right: 8,
                width: 24, height: 24, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.07)", color: "rgba(232,234,240,0.6)",
                cursor: "pointer", fontSize: 14, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1, zIndex: 1,
              }}
            >
              ×
            </button>

            {/* Fila principal del campo */}
            <div
              style={{
                padding: "14px 44px 14px 20px",
                cursor: "pointer",
                background: editFid === f.id ? "rgba(107,159,212,0.1)" : "transparent",
              }}
              onClick={() => setEditFid(editFid === f.id ? null : f.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ color: "#b8c5d4", fontSize: 14, cursor: "grab" }}>⣿</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0" }}>
                  {f.label}
                </span>
              </div>
              {f.description && (
                <span style={{ fontSize: 12, color: "#8fa3b1", display: "block", marginLeft: 22, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.description}
                </span>
              )}
              <span style={{ fontSize: 11, color: "#b8c5d4", display: "block", marginLeft: 22, marginTop: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>
                {f.type} {f.required ? "· Obligatorio" : "· Opcional"}
              </span>
            </div>

            {/* Panel de edición del campo */}
            {editFid === f.id && (
              <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
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
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "rgba(232,234,240,0.5)", cursor: "pointer" }}>
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
                style={{ textAlign: "left", fontSize: 13, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", color: "#6b9fd4" }}>{ft.icon}</span> {ft.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Publicación ── */}
      <div className="panel-card" style={{ marginTop: 20, padding: "20px 24px" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "rgba(232,234,240,0.5)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Publicación
        </h3>

        {/* Visibility */}
        <div style={{ marginBottom: 20 }}>
          <label style={bldLabel}>Visibilidad</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { value: "public",   label: "🌐 Público",       title: "Aparece en Discover" },
              { value: "unlisted", label: "🔗 Solo enlace",   title: "No aparece en Discover" },
              { value: "private",  label: "🔒 Privado",       title: "Solo tú puedes verlo" },
            ].map(opt => {
              const active = (draft.visibility || "public") === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.title}
                  onClick={() => setDraft(p => ({ ...p, visibility: opt.value }))}
                  style={{ fontSize: 11, flex: 1, padding: "10px 6px", cursor: "pointer", fontWeight: 700, borderRadius: 10, background: active ? "rgba(107,159,212,0.22)" : "rgba(255,255,255,0.06)", border: `1px solid ${active ? "rgba(107,159,212,0.4)" : "rgba(255,255,255,0.1)"}`, color: active ? "#e8eaf0" : "rgba(232,234,240,0.5)" }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 20 }}>
          <label style={bldLabel}>Categoría</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 8 }}>
            {DISCOVER_CATEGORIES.map(c => {
              const active = draft.category === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setDraft(p => ({ ...p, category: active ? null : c.slug }))}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "12px 6px", borderRadius: 12, cursor: "pointer",
                    background: active ? `${c.color}22` : "rgba(255,255,255,0.06)",
                    border: `1px solid ${active ? c.color : "rgba(255,255,255,0.1)"}`,
                    color: active ? "#e8eaf0" : "rgba(232,234,240,0.7)",
                  }}
                >
                  <span style={{ display: "flex" }}>{CAT_ICONS[c.slug]?.(active ? c.color : "rgba(232,234,240,0.7)", 24)}</span>
                  <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 600 }}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Price */}
        <div>
          <label style={bldLabel}>Precio de entrada</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[
              { key: false, label: "Gratis" },
              { key: true,  label: "De pago" },
            ].map(opt => {
              const active = !!draft.isPaid === opt.key;
              return (
                <button key={String(opt.key)} type="button"
                  onClick={() => opt.key ? setDraft(p => ({ ...p, isPaid: true })) : setDraft(p => ({ ...p, isPaid: false, price: null }))}
                  style={{ fontSize: 13, flex: 1, padding: "11px 8px", cursor: "pointer", fontWeight: 700, borderRadius: 10, background: active ? "rgba(107,159,212,0.22)" : "rgba(255,255,255,0.06)", border: `1px solid ${active ? "rgba(107,159,212,0.4)" : "rgba(255,255,255,0.1)"}`, color: active ? "#e8eaf0" : "rgba(232,234,240,0.5)" }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {draft.isPaid && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(232,234,240,0.5)", whiteSpace: "nowrap" }}>COP</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="Precio de entrada"
                value={draft.price || ""}
                onChange={e => setDraft(p => ({ ...p, price: e.target.value ? Number(e.target.value) : null }))}
                style={{
                  flex: 1, border: "1px solid rgba(255,255,255,0.11)", borderRadius: 10,
                  padding: "11px 14px", fontSize: 14, color: "#e8eaf0",
                  background: "rgba(255,255,255,0.06)", outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Publicar (deslizable, tamaño móvil incluso en escritorio) ── */}
      <div style={{ marginTop: 24, maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
        <SlideToCancel
          onComplete={onPublish}
          label="Publicar"
          accent="#34c759"
          bg="rgba(52,199,89,0.14)"
          border="rgba(52,199,89,0.4)"
        />
      </div>
    </div>
  );
}

function iconBtn() {
  return {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(232,234,240,0.6)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  };
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
        <p style={{ margin: "0 0 4px", color: NEGRO_PURO, fontSize: 15, fontWeight: 600 }}>📅 {formatEventSchedule(ev)}</p>
        <p style={{ margin: "0 0 4px", color: NEGRO_PURO, fontSize: 15, fontWeight: 600 }}>
          📍 {ev.city ? `${ev.city} — ` : ""}{ev.location || ev.address || "Sin ubicación"}
        </p>
        {ev.locationInstructions && (
          <p style={{ margin: "0 0 8px", color: NEGRO_MUTED_70, fontSize: 13, fontWeight: 600 }}>
            Indicaciones: {ev.locationInstructions}
          </p>
        )}
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{capacityLabel(ev)}</p>
        {ev.lat != null && <LocationMap lat={ev.lat} lng={ev.lng} height={200} />}
        <div className="admin-actions" style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" className="soft-btn soft-btn-primary" onClick={onCrm}>CRM inscritos</button>
          <button type="button" className="soft-btn soft-btn-secondary" onClick={onShare}>Compartir enlace</button>
          <button type="button" className="soft-btn soft-btn-secondary" onClick={onEdit}>Editar formulario</button>
          <button type="button" className="soft-btn soft-btn-secondary" onClick={onValidate} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Verificar <IconScan size={16} /></button>
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

function Validate({ event, scopeLabel, code, setCode, result, onCheck, onScan, onReset, onClose }) {
  const [mode, setMode] = useState("camera");
  const cameraActive = mode === "camera" && !result;

  const AZUL_TXT = "#c8dff0";
  const tabStyle = (active) => ({
    flex: 1, padding: 11, fontWeight: 800, fontSize: 13,
    border: `1px solid rgba(107,159,212,${active ? 0.5 : 0.3})`, borderRadius: 8,
    background: active ? "rgba(107,159,212,0.22)" : "rgba(255,255,255,0.05)",
    color: AZUL_TXT, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  });

  // Conteo de escaneados / inscritos y aforo
  const regs = event?.registrations || [];
  const total = regs.length;
  const scanned = regs.filter((r) => r.used || r.checkedInAt).length;
  const capMax = event ? getCapacityMax(event.capacity, event) : null;
  // La barra se llena (verde) según los escaneados se acercan a la capacidad.
  const fillBase = capMax != null && capMax > 0 ? capMax : total;
  const scanPct = fillBase > 0 ? Math.min(100, Math.round((scanned / fillBase) * 100)) : 0;

  return (
    <div style={{ position: "relative", border: "1px solid rgba(107,159,212,0.3)", borderRadius: 16, padding: 24, background: "rgba(107,159,212,0.10)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar escáner"
          style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(107,159,212,0.3)", background: "rgba(255,255,255,0.06)", color: AZUL_TXT, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, color: AZUL_TXT, textAlign: "center" }}>Check-in con QR</h2>
      <p style={{ fontSize: 13, color: "rgba(200,223,240,0.6)", marginBottom: 20, fontWeight: 600, textAlign: "center" }}>{scopeLabel}</p>

      {!result && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button type="button" onClick={() => setMode("camera")} style={tabStyle(mode === "camera")}>
              <IconCamera size={16} /> Cámara
            </button>
            <button type="button" onClick={() => setMode("manual")} style={tabStyle(mode === "manual")}>
              <IconKeyboard size={16} /> Manual
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
              <button type="button" onClick={onCheck} style={{ background: "linear-gradient(135deg, #0d3b66, #1a5f8a)", color: "#fff", border: "none", padding: 14, borderRadius: 8, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Verificar boleto <IconScan size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {result && (() => {
        const ok = result.s === "ok";
        const accent = ok ? "#4ade80" : "#f87171";
        const cardBg = ok ? "rgba(52,199,89,0.15)" : "rgba(220,38,38,0.15)";
        const cardBorder = ok ? "rgba(52,199,89,0.5)" : "rgba(220,38,38,0.5)";
        return (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              padding: 20,
              background: cardBg,
              border: `2px solid ${cardBorder}`,
              color: accent,
              borderRadius: 10,
              fontWeight: 900,
              fontSize: 16,
              marginBottom: 16,
            }}
          >
            {ok && "✓ CHECK-IN EXITOSO — ACCESO CONCEDIDO"}
            {result.s === "used" && "⚠️ BOLETO YA UTILIZADO — ACCESO DENEGADO"}
            {result.s === "nf" && "✕ BOLETO NO ENCONTRADO"}
          </div>

          {result.participant && result.s !== "nf" && (
            <div style={{ textAlign: "left", border: `1.5px solid ${cardBorder}`, borderRadius: 12, padding: 16, marginBottom: 16, background: cardBg, color: "#e8eaf0" }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8, color: "#fff" }}>{result.participant.name}</div>
              {result.event && (
                <p style={{ fontSize: 13, color: "rgba(232,234,240,0.85)", margin: "0 0 12px" }}>
                  Evento: <strong style={{ color: "#fff" }}>{result.event.title}</strong>
                </p>
              )}
              {result.participant.rows.map((row) => (
                <div key={row.label} style={{ fontSize: 13, marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 4, color: "rgba(232,234,240,0.9)" }}>
                  <span style={{ fontWeight: 800, color: "#fff" }}>{row.label}:</span> {row.value}
                </div>
              ))}
              <div style={{ fontSize: 12, fontFamily: "monospace", marginTop: 12, color: "rgba(232,234,240,0.6)" }}>{result.ticketId}</div>
              {result.s === "used" && result.reg?.checkedInAt && (
                <p style={{ fontSize: 12, marginTop: 8, color: "rgba(232,234,240,0.7)" }}>
                  Primer ingreso: {new Date(result.reg.checkedInAt).toLocaleString("es-MX")}
                </p>
              )}
              {ok && result.checkedInAt && (
                <p style={{ fontSize: 12, marginTop: 8, color: "#4ade80", fontWeight: 700 }}>
                  Registrado: {new Date(result.checkedInAt).toLocaleString("es-MX")}
                </p>
              )}
            </div>
          )}

          {result.s === "nf" && (
            <p style={{ fontSize: 13, color: "rgba(232,234,240,0.6)", marginBottom: 16 }}>
              Verifica que el código sea del evento correcto{event ? ` (${event.title})` : ""} y que la inscripción exista.
            </p>
          )}

          <button type="button" onClick={onReset} style={{ background: "rgba(52,199,89,0.16)", color: "#5ee07f", padding: "16px 24px", border: "1px solid rgba(52,199,89,0.45)", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 15, width: "auto", maxWidth: 240, margin: "0 auto", display: "block" }}>
            Escanear
          </button>
        </div>
        );
      })()}

      {/* ── Conteo de escaneados y aforo ── */}
      {event && (
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(107,159,212,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(200,223,240,0.7)" }}>Escaneados</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#c8dff0" }}>{scanned} / {total}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(200,223,240,0.7)" }}>Aforo</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#c8dff0" }}>{capMax != null ? `${total} / ${capMax}` : `${total} inscritos`}</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${scanPct}%`, background: "linear-gradient(90deg, #16a34a, #4ade80)", borderRadius: 6, transition: "width 0.4s" }} />
          </div>
        </div>
      )}
    </div>
  );
}
