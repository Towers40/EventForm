import { useState, useEffect, useLayoutEffect, useCallback, useRef, lazy, Suspense } from "react";
// El escáner arrastra html5-qrcode (~330 KB): se descarga solo al abrir la
// cámara, no en cada carga del panel.
const QrScanner = lazy(() => import("./components/QrScanner.jsx"));
import FieldInput, { FieldError } from "./components/FieldInput.jsx";
import EventHeader from "./components/EventHeader.jsx";
import LocationSearch from "./components/LocationSearch.jsx";
import HeaderImageUpload from "./components/HeaderImageUpload.jsx";
import LocationMap from "./components/LocationMap.jsx";
import EventCrm from "./components/EventCrm.jsx";
import ShareEventModal from "./components/ShareEventModal.jsx";
import ConfirmTicket from "./components/ConfirmTicket.jsx";
import DateTimePicker from "./components/DateTimePicker.jsx";
import CreateEventForm from "./components/CreateEventForm.jsx";
import { BRAND_NAME, TapInMark } from "./lib/brand.jsx";
import InicioView from "./pages/InicioView.jsx";
import MisEventosView from "./pages/MisEventosView.jsx";
import MisTicketsView from "./pages/MisTicketsView.jsx";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import DashboardView from "./pages/DashboardView.jsx";
import MiCuentaView from "./pages/MiCuentaView.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { api } from "./lib/api.js";
import { loadEvents, saveEvents } from "./lib/storage.js";
import {
  performCheckIn,
  validateRegistrationForm,
  buildParticipant,
  groupRegistrations,
  parseTicketCode,
} from "./lib/tickets.js";
import { isSoldOut, capacityLabel, getCapacityMax } from "./lib/capacity.js";
import { publicBaseUrl } from "./lib/platform.js";
import SlideToCancel from "./components/SlideToCancel.jsx";
import { IconButton, DataRow, IcoCalendar, IcoPin, EventTintLayer } from "./components/ui.jsx";
import { DISCOVER_CATEGORIES } from "./lib/categories.js";
import { CategoryIcon } from "./lib/categoryIcons.jsx";
import { eventFontProps, getEventFont, loadEventFont } from "./lib/fonts.js";
import { eventTint } from "./lib/dominantColor.js";
import {
  VERDE_PASTEL_BG,
  VERDE_CORPORATIVO,
  NEGRO_PURO,
  NEGRO_MUTED_70,
  NEGRO_MUTED_50,
  BLANCO_CONTRASTE,
} from "./lib/theme.js";

const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

// Píldora del encabezado en móvil (estilo iOS): círculo con el icono que se
// despliega mostrando su nombre cuando su sección está activa. Como `view` es
// un único valor, abrir una retrae automáticamente las demás.
function HeaderPill({ icon, label, short, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`ef-pill${active ? " ef-pill-on" : ""}`}
    >
      <span className="ef-pill-icon">{icon}</span>
      <span className="ef-pill-label">{short || label}</span>
    </button>
  );
}

// ─── ICONOS SVG (heredan color con currentColor) ──────────────────────────────
const svgBase = (s = 18) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" });
function IconHome({ size }) { return <svg {...svgBase(size)}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>; }
function IconCalendar({ size }) { return <svg {...svgBase(size)}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>; }
function IconChart({ size }) { return <svg {...svgBase(size)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>; }
function IconPlus({ size }) { return <svg {...svgBase(size)}><path d="M12 5v14M5 12h14" /></svg>; }
function IconCamera({ size }) { return <svg {...svgBase(size)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>; }
function IconKeyboard({ size }) { return <svg {...svgBase(size)}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h0M10 9h0M14 9h0M18 9h0M6 13h0M10 13h0M14 13h0M18 13h0M8 17h8" /></svg>; }
function IconScan({ size = 16 }) { return <svg {...svgBase(size)}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M3 12h18" /></svg>; }
function IconTicket({ size }) { return <svg {...svgBase(size)}><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" /><path d="M13 7v10" strokeDasharray="2 2" /></svg>; }
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
  { type: "text", label: "Texto corto", desc: "Una línea: nombre, empresa…", icon: <IconFieldText size={20} /> },
  { type: "email", label: "Email", desc: "Valida que sea un correo", icon: <IconFieldEmail size={20} /> },
  { type: "phone", label: "Teléfono", desc: "Número de contacto", icon: <IconFieldPhone size={20} /> },
  { type: "age", label: "Edad", desc: "Años cumplidos", icon: <IconFieldAge size={20} /> },
  { type: "number", label: "Número", desc: "Cualquier cantidad", icon: <IconFieldNumber size={20} /> },
  { type: "textarea", label: "Texto largo", desc: "Comentarios o respuestas abiertas", icon: <IconFieldTextarea size={20} /> },
  { type: "select", label: "Selección única", desc: "Elegir una opción de una lista", icon: <IconFieldSelect size={20} /> },
  { type: "multi_select", label: "Selección múltiple", desc: "Elegir varias opciones", icon: <IconFieldMulti size={20} /> },
  { type: "checkbox", label: "Verificación", desc: "Una casilla para aceptar algo", icon: <IconFieldCheck size={20} /> },
];

// Visibilidad del evento (menú desplegable en "Publicación").
const VIS_OPTIONS = [
  { value: "public", label: "Público", desc: "Aparece en Descubrir",
    icon: <svg {...svgBase(20)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg> },
  { value: "unlisted", label: "Solo enlace", desc: "Solo entra quien tenga el enlace",
    icon: <svg {...svgBase(20)}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3A4.5 4.5 0 0 0 11 19.4l1-1" /></svg> },
  { value: "private", label: "Privado", desc: "Solo tú puedes verlo",
    icon: <svg {...svgBase(20)}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg> },
];

// Fila de un menú desplegable: baldosa con icono + título + una línea.
// Los menús se abren EN la página (empujan lo de debajo), sin ventana ni fondo.
function MenuFila({ icon, label, desc, active, onClick }) {
  return (
    <button type="button" role="option" aria-selected={Boolean(active)} onClick={onClick} className="ef-hover-fill"
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, textAlign: "left", padding: "10px 12px", border: "none", borderRadius: 14, background: active ? "rgba(255,255,255,0.1)" : "transparent", color: "#fff", cursor: "pointer" }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--tf-surface-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 500, letterSpacing: "-0.01em" }}>{label}</span>
        {desc && <span style={{ display: "block", fontSize: 13, color: "var(--tf-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</span>}
      </span>
      {active && <svg {...svgBase(18)} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
    </button>
  );
}
function Chevron({ open }) {
  return <svg {...svgBase(18)} style={{ flexShrink: 0, color: "var(--tf-muted)", transition: "transform .18s", transform: open ? "rotate(180deg)" : "none" }}><path d="m6 9 6 6 6-6" /></svg>;
}

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
    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--tf-muted)", marginBottom: 8, marginTop: top ? 16 : 0 }}>
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

function formatEventSchedule(ev) {
  if (ev?.startDate && ev?.startTime) {
    const start = `${ev.startDate} ${ev.startTime}`;
    const end = ev.endDate && ev.endTime ? ` → ${ev.endDate} ${ev.endTime}` : "";
    return `${start}${end}`;
  }
  return ev?.date || "Sin fecha";
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function HostApp({ initialDraft = null, onDraftConsumed }) {
  const { user, token, isSuperAdmin, apiEnabled: apiOn } = useAuth();

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
  // Al volver con "atrás" desde la página de un evento, HostApp se monta de
  // nuevo: se retoma la pestaña que guardó el historial (solo las de lista,
  // que no necesitan un evento seleccionado) en vez de caer siempre en Inicio.
  const [view, setView] = useState(() => {
    if (_hasDraft) return "builder";
    const previa = typeof window !== "undefined" ? window.history.state?.efView : null;
    return ["inicio", "mis_eventos", "mis_tickets", "discover", "stats", "mi_cuenta"].includes(previa) ? previa : "inicio";
  });
  const [events, setEvents] = useState(() => (apiOn ? [] : loadEvents()));
  const [eventsLoading, setEventsLoading] = useState(apiOn);
  const [eventsError, setEventsError] = useState(null);
  const [crmFilter, setCrmFilter] = useState("todos"); // con qué filtro abrir Inscritos
  const [shareEv, setShareEv] = useState(null);
  const [evId, setEvId] = useState(null);
  const [regId, setRegId] = useState(null);
  const [editFid, setEditFid] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [vCode, setVCode] = useState("");
  const [vResult, setVResult] = useState(null);
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
    if (!apiOn || !token) { setEventsLoading(false); return; }
    setEventsLoading(true);
    setEventsError(null);
    try {
      const { events: list } = await api.events(token);
      // Los borradores locales (aún sin publicar) no existen en el servidor, así
      // que se conservan: antes cada refresco los borraba de la lista.
      setEvents((prev) => {
        const drafts = prev.filter((e) => e.isDraft && !list.some((s) => s.id === e.id));
        return [...list.map((e) => ({ ...e, _persisted: true })), ...drafts];
      });
    } catch (e) {
      // Sin esto un fallo del API dejaba "Mis eventos" vacío y en silencio,
      // indistinguible de "no tienes eventos".
      console.error(e);
      setEventsError(e?.message || "No se pudieron cargar tus eventos.");
    } finally {
      setEventsLoading(false);
    }
  }, [apiOn, token]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents, isSuperAdmin]);

  const setRegistrationApproval = async (eventId, ticketIds, approved) => {
    if (!apiOn || !token) return;
    const ids = new Set(Array.isArray(ticketIds) ? ticketIds : [ticketIds]);
    // Optimista: el anfitrión ve el cambio al instante y el servidor confirma.
    setEvents((p) => p.map((e) => e.id !== eventId ? e : {
      ...e,
      registrations: (e.registrations || []).map((r) => ids.has(r.id) ? { ...r, approved } : r),
    }));
    try {
      await api.setRegistrationApproval(token, eventId, [...ids], approved);
    } catch (err) {
      alert("No se pudo actualizar la aprobación: " + (err?.message || "error"));
      refreshEvents();
    }
  };

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
      { id: "F" + uid(), type: "text", label: "Nombre completo del asistente", description: "", placeholder: "", required: true, options: [] },
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
    if (result.status === "used" || result.status === "pending") {
      setVResult({
        s: result.status,
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
      } else if (res.status === "pending") {
        // Entrada real pero sin aprobar: no da acceso todavía.
        setVResult({ s: "pending", ticketId, event: ev, reg, participant });
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

  // Pantallas secundarias: la flecha de volver ocupa el sitio del avatar.
  const SUB_VIEWS = ["create_wizard", "builder", "crm", "validate", "mi_cuenta", "detail", "register", "confirm"];
  const showBack = SUB_VIEWS.includes(view);
  const goBack = () => {
    if (view === "create_wizard") return go(createReturn || "inicio");
    if (view === "mi_cuenta") return go(accountReturn || "inicio");
    if (view === "crm" || view === "validate") return go("mis_eventos");
    // El resto vuelve por el historial (lo gestiona el listener de popstate).
    if (window.history.state?.efView) window.history.back(); else go("inicio");
  };

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "?";

  // Items de la barra inferior tipo liquid glass (móvil).
  const BOTTOM_NAV = [
    { key: "inicio",      label: "Inicio",      icon: <IconHome /> },
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


  return (
    <div
      className="app-shell"
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        minHeight: "100vh",
        background: "transparent",
        color: "#ffffff",
        textAlign: "left",
      }}
    >
      {/* ── ENCABEZADO ──
          Izquierda: avatar (Mi cuenta) o, en pantallas secundarias, la flecha
          de volver — es donde el pulgar y el ojo la buscan, en vez de dentro
          del contenido. Centro (móvil): el logo. Escritorio: avatar+logo a la
          izquierda y la navegación al centro. */}
      <nav className={`ef-topbar${["inicio", "stats", "create_wizard", "builder"].includes(view) ? " ef-topbar-open" : ""}`} style={{ background: "rgba(18,20,22,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 20px", height: 60, alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
        <div style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {showBack ? (
            <button type="button" className="ef-hover-fill" onClick={goBack} title="Volver" aria-label="Volver"
              style={{
                width: 42, height: 42, borderRadius: "50%", border: "none", padding: 0, flexShrink: 0,
                background: "rgba(255,255,255,0.12)", color: "#ffffff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            </button>
          ) : (
          <button
            type="button"
            className="ef-hover-fill"
            onClick={() => { setAccountReturn(view); go("mi_cuenta"); }}
            style={{
              width: 42, height: 42, borderRadius: "50%",
              boxSizing: "border-box",
              backgroundColor: "#1b1d21",
              backgroundImage: avatarUrl ? `url("${avatarUrl}")` : "none",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              border: "none",
              cursor: "pointer", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 600, color: "#fff",
              flexShrink: 0,
              padding: 0,
            }}
            title="Mi cuenta"
          >
            {!avatarUrl && initials}
          </button>
          )}
          {/* Logo junto al avatar: solo escritorio (en móvil va centrado). */}
          <button type="button" className="ef-hover-fill ef-logo-text ef-logo-side" onClick={() => go("inicio")} style={{ background: "none", border: "none", borderRadius: 14, padding: "6px 10px", cursor: "pointer", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 18, letterSpacing: "-0.02em", color: "#ffffff", whiteSpace: "nowrap" }}>
            <TapInMark size={22} color={VERDE_CORPORATIVO} />
            <span className="ef-logo-word">{BRAND_NAME}</span>
          </button>
        </div>

        {/* Logo centrado: solo móvil. Lleva al Inicio. */}
        <button type="button" className="ef-hover-fill ef-logo-center" onClick={() => go("inicio")} aria-label="Inicio"
          style={{ background: "none", border: "none", borderRadius: 14, padding: "6px 10px", cursor: "pointer", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 18, letterSpacing: "-0.02em", color: "#ffffff", whiteSpace: "nowrap" }}>
          <TapInMark size={22} color={VERDE_CORPORATIVO} />
          <span>{BRAND_NAME}</span>
        </button>

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
                  background: active ? "rgba(229,238,255,0.12)" : "transparent",
                  border: "1px solid transparent",
                  borderRadius: 12, padding: "8px 14px", whiteSpace: "nowrap",
                  fontSize: 14, fontWeight: active ? 600 : 500,
                  color: active ? "#ffffff" : "rgba(229,238,255,0.64)",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Derecha: acciones, siempre solo iconos (casa · dashboard · +). */}
        <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <div className="ef-mobile-actions" style={{ alignItems: "center", gap: 5 }}>
            <HeaderPill icon={<IconChart size={19} />} label="Dashboard" active={view === "stats"} onClick={() => go("stats")} />
            <HeaderPill icon={<IconPlus size={19} />} label="Nuevo evento" short="Nuevo" active={view === "create_wizard" || view === "builder"} onClick={startNew} />
          </div>
          <div className="ef-header-nav">
            {/* Solo icono, como el resto de acciones de la app. */}
            <IconButton title="Nuevo evento" tone="accent" onClick={startNew}><IconPlus size={19} /></IconButton>
          </div>
        </div>
      </nav>

      {shareEv && (
        <ShareEventModal event={shareEv} onClose={() => setShareEv(null)} />
      )}

      {/* `app-main--<vista>` deja a desktop.css dar a cada pantalla su ancho y
          sus columnas en ordenador; en móvil no cambia nada. */}
      <main className={`app-main app-main--${view}${["mis_eventos", "discover"].includes(view) ? " app-main-wide" : ""}`}>
        {view === "inicio" && (
          <InicioView events={events} onNew={startNew} onGoTo={(v) => go(v)} />
        )}
        {view === "mis_eventos" && (
          <MisEventosView
            events={events}
            loading={eventsLoading}
            error={eventsError}
            onRetry={refreshEvents}
            onNew={startNew}
            onOpen={(id, filtro = "todos") => { setCrmFilter(filtro); go("crm", id); }}
            onEdit={editEvent}
            onValidate={(id) => openValidate(id)}
            onDelete={deleteEvent}
            onShare={(ev) => setShareEv(ev)}
            onToggleSoldOut={toggleSoldOut}
          />
        )}
        {view === "stats" && (
          <DashboardView
            events={events}
            onNew={startNew}
            onOpen={(id, filtro = "todos") => { setCrmFilter(filtro); go("crm", id); }}
            onValidate={(id) => openValidate(id)}
            onShare={(ev) => setShareEv(ev)}
          />
        )}
        {view === "mis_tickets" && <MisTicketsView />}
        {view === "discover" && <DiscoverPage embedded />}
        {view === "mi_cuenta" && <MiCuentaView />}
        {view === "create_wizard" && (
          <CreateEventForm
            draft={draft}
            setDraft={setDraft}
            onDone={generatePreliminaryForm}
            onCancel={() => go(createReturn || "inicio")}
            inApp
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
            onToggleSoldOut={(v) => toggleSoldOut(ev.id, v)}
            onShare={() => setShareEv(ev)}
            initialFilter={crmFilter}
            onSetApproval={(ticketIds, approved) => setRegistrationApproval(ev.id, ticketIds, approved)}
          />
        )}
        {view === "detail" && ev && (
          <Detail
            ev={ev}
            onEdit={() => editEvent(ev)}
            onValidate={() => openValidate(ev.id)}
            onCrm={(filtro = "todos") => { setCrmFilter(filtro); go("crm", ev.id); }}
            onShare={() => setShareEv(ev)}
            onSetApproval={(ticketIds, approved) => setRegistrationApproval(ev.id, ticketIds, approved)}
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
        <footer className="ef-footer" style={{ background: "transparent", borderTop: "1px solid rgba(255,255,255,0.07)", padding: 20, textAlign: "center", fontSize: 12, color: "rgba(229,238,255,0.3)", marginTop: 48, paddingBottom: 110 }}>
          {BRAND_NAME} Colombia © 2026
          {/* Versión del build. Si aquí pone "preview", estás en una URL
              congelada en un commit viejo y no verás los últimos cambios. */}
          <span style={{ display: "block", marginTop: 6, fontSize: 10.5, letterSpacing: "0.04em", color: __BUILD_ENV__ === "production" ? "rgba(229,238,255,0.22)" : "#fbbf24" }}>
            {__BUILD_ENV__ === "production" ? `v ${__BUILD_ID__}` : `${__BUILD_ENV__} · ${__BUILD_ID__} — no es producción`}
          </span>
        </footer>
      )}

      {/* ── BARRA INFERIOR LIQUID GLASS ── */}
      {view !== "create_wizard" && (
        <div className="ef-dock-wrap" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, display: "flex", justifyContent: "center", padding: "0 12px 14px", pointerEvents: "none" }}>
          <div className="ef-dock" style={{
            pointerEvents: "auto",
            display: "flex", alignItems: "stretch", gap: 4,
            width: "100%",
            background: "rgba(18,20,22,0.88)",
            backdropFilter: "blur(20px) saturate(140%)", WebkitBackdropFilter: "blur(20px) saturate(140%)",
            border: "1px solid rgba(229,238,255,0.1)",
            borderRadius: 24, padding: 6,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          }}>
            {BOTTOM_NAV.map(({ key, label, icon }) => {
              const active = view === key;
              return (
                <button key={key} type="button" className="ef-hover-fill" onClick={() => go(key)}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                    background: active ? "rgba(229,238,255,0.12)" : "transparent",
                    border: "1px solid transparent",
                    borderRadius: 18, padding: "9px 4px", cursor: "pointer",
                    color: active ? "#ffffff" : "rgba(229,238,255,0.56)",
                  }}>
                  <span style={{ display: "flex" }}>{icon}</span>
                  <span className="ef-dock-label" style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function SoldOutView({ ev, onBack }) {
  return (
    <div className="panel-card" style={{ padding: 24, textAlign: "center" }}>
      <EventHeader event={ev} compact />
      <span className="sold-out-badge" style={{ fontSize: 14, padding: "8px 16px", display: "inline-block", marginBottom: 16 }}>
        Sold out — cupos agotados
      </span>
      <p style={{ fontSize: 15, color: "var(--tf-muted)", marginBottom: 20 }}>
        Este evento alcanzó su aforo máximo ({capacityLabel(ev)}). No se aceptan más inscripciones.
      </p>
      <button type="button" className="soft-btn soft-btn-ghost" onClick={onBack} style={{ width: "100%" }}>
        Volver
      </button>
    </div>
  );
}

function Builder({ draft, setDraft, editFid, setEditFid, onAdd, onUpdate, onDelete, onMove, onPublish }) {
  // Al editar un evento ya publicado se entra aquí directamente: su tipografía
  // hay que descargarla, o el título se escribiría en Inter.
  useEffect(() => { loadEventFont(draft?.fontId); }, [draft?.fontId]);
  const [showTools, setShowTools] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [visOpen, setVisOpen] = useState(false);
  const [showLoc, setShowLoc] = useState(false);
  const [dragId, setDragId] = useState(null);
  const itemRefs = useRef(new Map());
  const updateOptions = (fid, options) => onUpdate(fid, { options });

  // Reordenar arrastrando. Se usa Pointer Events en vez de la API de arrastre
  // HTML5 (draggable/onDragStart) porque esa NO dispara en pantallas táctiles,
  // y en móvil no había forma de reordenar. El arrastre se limita al asa (⣿):
  // si la tarjeta entera fuera arrastrable, seleccionar texto en el panel de
  // edición iniciaría un arrastre por accidente.
  // Orden en curso durante el arrastre. Hace falta un ref porque los
  // `pointermove` llegan más rápido de lo que React repinta: si cada uno
  // partiera del `draft` de su render, dos eventos seguidos calcularían desde
  // el mismo orden viejo y el segundo desharía el movimiento del primero (el
  // campo se quedaba a mitad de camino y no llegaba al final de la lista).
  const orderRef = useRef(null);
  // Posición de cada tarjeta ANTES del último reordenado, para animar el
  // desplazamiento (técnica FLIP): sin esto las tarjetas saltan de golpe a su
  // sitio en vez de apartarse para dejar pasar a la que se arrastra.
  const prevTops = useRef(new Map());
  const pointerY = useRef(0);

  const snapshotTops = () => {
    const tops = new Map();
    for (const [id, el] of itemRefs.current) tops.set(id, el.getBoundingClientRect().top);
    prevTops.current = tops;
  };

  const startDrag = (e, fid) => {
    e.preventDefault();
    e.stopPropagation();
    orderRef.current = draft.fields;
    pointerY.current = e.clientY;
    setDragId(fid);
  };

  const moveDrag = (e) => {
    if (!dragId) return;
    const y = e.clientY;
    pointerY.current = y;
    // La tarjeta agarrada sigue al dedo/ratón dentro de su hueco. Se toca el
    // estilo directamente (no por estado) para que vaya a la tasa del puntero
    // y no a la de los repintados de React.
    followPointer();

    // Con muchos campos el destino queda fuera de pantalla: se desplaza sola
    // al acercarse a los bordes.
    const EDGE = 70;
    if (y < EDGE) window.scrollBy(0, -14);
    else if (y > window.innerHeight - EDGE) window.scrollBy(0, 14);

    const fields = orderRef.current || draft.fields;
    const from = fields.findIndex((f) => f.id === dragId);
    if (from < 0) return;

    // Destino = primer campo cuyo centro ha cruzado el puntero.
    let to = from;
    for (let i = 0; i < fields.length; i++) {
      if (i === from) continue;
      const el = itemRefs.current.get(fields[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (i < from && y < mid) { to = i; break; }
      if (i > from && y > mid) { to = i; }
    }
    if (to === from) return;

    snapshotTops(); // "First" del FLIP: dónde estaba cada tarjeta antes de mover
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    orderRef.current = next;
    setDraft((p) => ({ ...p, fields: next }));
  };

  // Coloca la tarjeta agarrada bajo el puntero, respecto al hueco que ocupa.
  const followPointer = () => {
    const el = dragId && itemRefs.current.get(dragId);
    if (!el) return;
    const prev = el.style.transform;
    el.style.transform = "";           // mide el hueco real, sin el desfase actual
    const r = el.getBoundingClientRect();
    const dy = pointerY.current - (r.top + r.height / 2);
    if (Math.abs(dy) < 0.5 && !prev) return;
    el.style.transform = `translateY(${dy}px)`;
  };

  const endDrag = () => {
    const el = dragId && itemRefs.current.get(dragId);
    if (el) {
      // Al soltar, la tarjeta vuelve a su hueco con la misma animación que
      // usan las demás, en vez de aparecer de golpe en su sitio.
      el.style.transition = "transform 0.18s ease-out";
      el.style.transform = "";
      setTimeout(() => { if (el) el.style.transition = ""; }, 200);
    }
    orderRef.current = null;
    prevTops.current = new Map();
    setDragId(null);
  };

  // "Last / Invert / Play" del FLIP: tras repintar con el orden nuevo, cada
  // tarjeta se coloca de vuelta en su posición anterior sin transición y se
  // suelta en el mismo fotograma, de modo que se ve deslizarse hasta su sitio.
  useLayoutEffect(() => {
    if (!prevTops.current.size) return;
    const tops = prevTops.current;
    prevTops.current = new Map();
    for (const [id, el] of itemRefs.current) {
      if (id === dragId) continue; // la agarrada la lleva followPointer
      const before = tops.get(id);
      if (before == null) continue;
      const delta = before - el.getBoundingClientRect().top;
      if (!delta) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
    }
    requestAnimationFrame(() => {
      for (const [id, el] of itemRefs.current) {
        if (id === dragId) continue;
        if (!el.style.transform) continue;
        el.style.transition = "transform 0.18s cubic-bezier(0.2,0,0,1)";
        el.style.transform = "";
      }
    });
    followPointer(); // el hueco de la agarrada cambió: recolocarla bajo el puntero
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.fields]);

  // Los listeners del arrastre viven en `window`, no en el asa. Con
  // setPointerCapture sobre el asa el arrastre se quedaba a medias: al
  // reordenar, React mueve los nodos del DOM, el navegador suelta la captura y
  // los pointermove dejaban de llegar (el campo avanzaba dos posiciones y ahí
  // se paraba). En window llegan siempre, pase lo que pase con el DOM.
  const moveDragRef = useRef(moveDrag);
  moveDragRef.current = moveDrag;

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e) => moveDragRef.current(e);
    const onUp = () => endDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    // Evita que al arrastrar se vaya seleccionando el texto de las tarjetas.
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = prevSelect;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  const bldLabel = {
    display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--tf-muted)", marginBottom: 8,
  };
  // Resumen de fecha y lugar para la fila plegada.
  const resumenConfig = [
    draft.startDate ? new Date(draft.startDate + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" }) + (draft.startTime ? ` · ${draft.startTime}` : "") : "",
    draft.location || draft.address || draft.city || "",
  ].filter(Boolean).join(" · ") || "Fecha, lugar e instrucciones de llegada";
  const visActual = VIS_OPTIONS.find((o) => o.value === (draft.visibility || "public")) || VIS_OPTIONS[0];

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", paddingBottom: 80, position: "relative", zIndex: 1 }}>
      {/* El segundo paso de la creación también se tiñe con el color del
          evento: es la misma pantalla de trabajo y tiene que verse lo mismo. */}
      <EventTintLayer tinte={eventTint(draft.themeColor)} />

      {/* ── Encabezado del evento ── */}
      <div className="panel-card" style={{ marginBottom: 20, overflow: "hidden" }}>
        <HeaderImageUpload
          image={draft.headerImage}
          onChange={(headerImage, themeColor) => setDraft(p => ({
            ...p, headerImage,
            // Un color elegido a mano no se pisa al cambiar de portada.
            themeColor: p.themeColorManual ? p.themeColor : (themeColor ?? null),
          }))}
        />
        {/* Título y descripción con la letra del evento: aquí se escribe lo
            que después se lee en su página, así que se escribe tal cual se
            va a ver. */}
        <div {...eventFontProps(draft.fontId, { extraStyle: { padding: "20px 24px 4px" } })}>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Título del evento"
            style={{
              width: "100%", border: "none", outline: "none",
              fontSize: 24 * getEventFont(draft.fontId).headingScale,
              fontWeight: getEventFont(draft.fontId).headingWeight,
              letterSpacing: getEventFont(draft.fontId).headingSpacing,
              color: "#ffffff",
              background: "transparent", boxSizing: "border-box",
              textAlign: "center",
            }}
          />
        </div>
        <div {...eventFontProps(draft.fontId, { extraStyle: { padding: "8px 24px 20px" } })}>
          <textarea
            placeholder="Descripción del evento — cuéntales a tus asistentes de qué se trata, qué esperar, código de vestimenta, etc."
            value={draft.eventDescription || ""}
            onChange={(e) => setDraft({ ...draft, eventDescription: e.target.value })}
            rows={3}
            style={{
              width: "100%", border: "none", outline: "none", resize: "none",
              fontSize: 14, color: "rgba(229,238,255,0.5)", lineHeight: 1.7,
              background: "transparent", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Fecha y lugar — plegable, con los mismos campos que el resto de la app */}
        <div style={{ borderTop: "1px solid var(--tf-divider)" }}>
          <button type="button" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings} className="ef-hover-fill"
            style={{ width: "100%", textAlign: "left", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--tf-surface-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <svg {...svgBase(20)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em" }}>Ubicación y configuración</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--tf-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resumenConfig}</span>
            </span>
            <Chevron open={showSettings} />
          </button>
          {showSettings && (
            <div style={{ padding: "6px 20px 22px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20 }}>
              {/* Una columna siempre: Inicio (día + hora) en una fila y Fin en otra. */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
                <div style={{ minWidth: 0 }}>
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
                <div style={{ minWidth: 0 }}>
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

              <div>
                <label style={bldLabel}>Lugar</label>
                <button type="button" onClick={() => setShowLoc(true)} className="ef-hover-fill"
                  style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "10px 16px", border: "none", borderRadius: 16, background: "var(--tf-field)", color: "#fff", cursor: "pointer" }}>
                  <svg {...svgBase(20)} style={{ flexShrink: 0, color: "var(--tf-muted)" }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {(draft.location || draft.address) ? (
                      <>
                        <span style={{ display: "block", fontSize: 16, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.location || draft.address}</span>
                        <span style={{ display: "block", fontSize: 13, color: "var(--tf-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[draft.address && draft.address !== draft.location ? draft.address : "", draft.city].filter(Boolean).join(" · ") || "Toca para cambiar"}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 16, color: "var(--tf-faint)" }}>Elegir ubicación</span>
                    )}
                  </span>
                  <svg {...svgBase(18)} style={{ flexShrink: 0, color: "var(--tf-muted)" }}><path d="m9 6 6 6-6 6" /></svg>
                </button>
                {draft.lat != null && draft.lng != null && (
                  <div style={{ marginTop: 10, borderRadius: 16, overflow: "hidden" }}>
                    <LocationMap lat={draft.lat} lng={draft.lng} height={170} />
                  </div>
                )}
              </div>

              <div>
                <label style={bldLabel}>Instrucciones de llegada (opcional)</label>
                <textarea
                  className="tf-input-line"
                  rows={3}
                  placeholder="Ej. Entrada por la portería norte, preguntar por recepción…"
                  value={draft.locationInstructions || ""}
                  onChange={(e) => setDraft((p) => ({ ...p, locationInstructions: e.target.value }))}
                  style={{ fontSize: 16, fontWeight: 400, resize: "vertical", minHeight: 84, fontFamily: "inherit" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showLoc && (
        <LocationSearch
          initialCity={draft.city}
          onSelect={(item) => {
            setDraft((p) => ({ ...p, address: item.address, location: item.location, city: item.city || p.city, lat: item.lat, lng: item.lng }));
            setShowLoc(false);
          }}
          onClose={() => setShowLoc(false)}
        />
      )}

      {/* ── Encabezado de campos ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0, color: "#ffffff" }}>
          Campos del formulario
        </h2>
        <p style={{ fontSize: 13, color: "#8fa3b1", margin: "3px 0 0" }}>
          {draft.fields.length} campo{draft.fields.length !== 1 ? "s" : ""} · Toca para editar · Arrastra ⣿ para cambiar el orden
        </p>
      </div>

      {/* ── Lista de campos ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {draft.fields.map((f) => (
          <div
            key={f.id}
            ref={(el) => {
              if (el) itemRefs.current.set(f.id, el);
              else itemRefs.current.delete(f.id);
            }}
            className="panel-card"
            style={{
              overflow: "hidden", position: "relative",
              // OJO: `transition` y `transform` los gobierna el FLIP de forma
              // imperativa (ver useLayoutEffect). No ponerlos aquí: React los
              // sobrescribiría en cada repintado y cortaría la animación.
              ...(dragId === f.id
                ? { outline: "2px solid rgba(52,211,153,0.55)", boxShadow: "0 14px 34px rgba(0,0,0,0.5)", zIndex: 3, position: "relative" }
                : null),
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
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.12)", color: "rgba(229,238,255,0.6)",
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
                background: editFid === f.id ? "rgba(52,211,153,0.1)" : "transparent",
              }}
              onClick={() => setEditFid(editFid === f.id ? null : f.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                {/* Asa de arrastre. También responde a ↑/↓ con el teclado, para
                    quien no pueda arrastrar. */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Reordenar el campo ${f.label}`}
                  title="Arrastra para reordenar (o usa ↑ ↓)"
                  onPointerDown={(e) => startDrag(e, f.id)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp")   { e.preventDefault(); e.stopPropagation(); onMove(f.id, -1); }
                    if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); onMove(f.id, 1); }
                  }}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 30, height: 30, marginLeft: -6, flexShrink: 0, borderRadius: 8,
                    color: dragId === f.id ? "#34d399" : "#b8c5d4", fontSize: 14,
                    background: dragId === f.id ? "rgba(52,211,153,0.16)" : "transparent",
                    cursor: dragId === f.id ? "grabbing" : "grab",
                    touchAction: "none", // sin esto el móvil hace scroll en vez de arrastrar
                    userSelect: "none",
                  }}
                >
                  ⣿
                </span>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#ffffff" }}>
                  {f.label}
                </span>
              </div>
              {f.description && (
                <span style={{ fontSize: 12, color: "#8fa3b1", display: "block", marginLeft: 28, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.description}
                </span>
              )}
              <span style={{ fontSize: 11, color: "#b8c5d4", display: "block", marginLeft: 28, marginTop: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>
                {f.type} {f.required ? "· Obligatorio" : "· Opcional"}
              </span>
            </div>

            {/* Panel de edición del campo */}
            {editFid === f.id && (
              <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.07)" }}>
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
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "rgba(229,238,255,0.5)", cursor: "pointer" }}>
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

      {/* ── Añadir campo: "+" que despliega el catálogo aquí mismo ── */}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <button type="button" onClick={() => setShowTools((v) => !v)} className="ef-hover-fill"
          aria-label={showTools ? "Cerrar lista de campos" : "Añadir campo"} aria-expanded={showTools} title="Añadir campo"
          style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: showTools ? "#fff" : "var(--tf-surface-2)", color: showTools ? "#000" : "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <svg {...svgBase(22)} strokeWidth={2.2} style={{ transition: "transform .2s", transform: showTools ? "rotate(45deg)" : "none" }}><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {!showTools && <span style={{ fontSize: 13, color: "var(--tf-muted)", marginTop: 8 }}>Añadir campo</span>}
      </div>

      {showTools && (
        <div className="panel-card ef-menu-in" role="listbox" aria-label="Tipos de campo" style={{ marginTop: 10, padding: 6 }}>
          {FIELD_TYPES.map((ft) => (
            <MenuFila key={ft.type} icon={ft.icon} label={ft.label} desc={ft.desc}
              onClick={() => { onAdd(ft.type); setShowTools(false); }} />
          ))}
        </div>
      )}

      {/* ── Publicación ── */}
      <div className="panel-card" style={{ marginTop: 20, padding: "20px 24px" }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, color: "rgba(229,238,255,0.5)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Publicación
        </h3>

        {/* Visibility */}
        <div style={{ marginBottom: 20 }}>
          <label style={bldLabel}>Visibilidad</label>
          <button type="button" onClick={() => setVisOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={visOpen} className="ef-hover-fill"
            style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "8px 16px 8px 8px", border: "none", borderRadius: 16, background: "var(--tf-field)", color: "#fff", cursor: "pointer" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--tf-surface-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>{visActual.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 500 }}>{visActual.label}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--tf-muted)", marginTop: 1 }}>{visActual.desc}</span>
            </span>
            <Chevron open={visOpen} />
          </button>
          {visOpen && (
            <div role="listbox" aria-label="Visibilidad" className="ef-menu-in" style={{ marginTop: 6, padding: 6, borderRadius: 16, background: "var(--tf-field)" }}>
              {VIS_OPTIONS.map((o) => (
                <MenuFila key={o.value} icon={o.icon} label={o.label} desc={o.desc} active={o.value === visActual.value}
                  onClick={() => { setDraft((p) => ({ ...p, visibility: o.value })); setVisOpen(false); }} />
              ))}
            </div>
          )}
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
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "14px 6px 12px", borderRadius: 16, cursor: "pointer",
                    background: active ? "rgba(255,255,255,0.16)" : "var(--tf-surface)",
                    border: `1.5px solid ${active ? "#ffffff" : "transparent"}`,
                    color: active ? "#ffffff" : "rgba(229,238,255,0.72)",
                  }}
                >
                  <CategoryIcon slug={c.slug} size={40} />
                  <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 500 }}>{c.label}</span>
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
                  style={{ fontSize: 13, flex: 1, padding: "11px 8px", cursor: "pointer", fontWeight: 700, borderRadius: 14, background: active ? "rgba(52,211,153,0.22)" : "rgba(255,255,255,0.06)", border: `1px solid ${active ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.1)"}`, color: active ? "#ffffff" : "rgba(229,238,255,0.5)" }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {draft.isPaid && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(229,238,255,0.5)", whiteSpace: "nowrap" }}>COP</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="Precio de entrada"
                value={draft.price || ""}
                onChange={e => setDraft(p => ({ ...p, price: e.target.value ? Number(e.target.value) : null }))}
                style={{
                  flex: 1, border: "1px solid rgba(255,255,255,0.11)", borderRadius: 14,
                  padding: "11px 14px", fontSize: 14, color: "#ffffff",
                  background: "rgba(255,255,255,0.11)", outline: "none", fontFamily: "inherit",
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
          accent="#34d399"
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
    background: "rgba(255,255,255,0.12)",
    color: "rgba(229,238,255,0.6)",
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
function Detail({ ev, onEdit, onValidate, onCrm, onShare, onSetApproval, publicUrl: pubUrl }) {
  // Una fila por PERSONA, no por entrada: quien reserva 3 (o se inscribe 3
  // veces con el mismo correo) salía repetido tres veces con el mismo nombre.
  const grupos = groupRegistrations(ev, ev.registrations || []);
  const porAprobar = grupos.filter((g) => g.pendientes > 0);
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
        <DataRow icon={<IcoCalendar />} color={NEGRO_PURO} size={15} style={{ marginBottom: 4 }}>{formatEventSchedule(ev)}</DataRow>
        <DataRow icon={<IcoPin />} color={NEGRO_MUTED_70} size={15} style={{ marginBottom: 4 }}>
          {ev.city ? `${ev.city} — ` : ""}{ev.location || ev.address || "Sin ubicación"}
        </DataRow>
        {ev.locationInstructions && (
          <p style={{ margin: "0 0 8px", color: NEGRO_MUTED_70, fontSize: 13, fontWeight: 600 }}>
            Indicaciones: {ev.locationInstructions}
          </p>
        )}
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{capacityLabel(ev)}</p>
        {ev.lat != null && <LocationMap lat={ev.lat} lng={ev.lng} height={200} />}
        <div className="admin-actions" style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" className="soft-btn soft-btn-primary" onClick={() => onCrm()}>CRM inscritos</button>
          {porAprobar.length > 0 && (
            <button type="button" className="soft-btn ef-hover-fill" onClick={() => onCrm("pendientes")}
              style={{ background: "rgba(251,191,36,0.16)", color: "#fbbf24", border: "none", fontWeight: 600 }}>
              Aprobar {porAprobar.length} {porAprobar.length === 1 ? "solicitud" : "solicitudes"}
            </button>
          )}
          <button type="button" className="soft-btn soft-btn-ghost" onClick={onShare}>Compartir enlace</button>
          <button type="button" className="soft-btn soft-btn-ghost" onClick={onEdit}>Editar formulario</button>
          <button type="button" className="soft-btn soft-btn-ghost" onClick={onValidate} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Verificar <IconScan size={16} /></button>
        </div>
        </div>
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>
        Resumen ({grupos.length} {grupos.length === 1 ? "persona" : "personas"} · {(ev.registrations || []).length} {(ev.registrations || []).length === 1 ? "entrada" : "entradas"})
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {grupos.length === 0 ? (
          <p style={{ fontSize: 14, color: NEGRO_MUTED_50 }}>Aún no hay inscripciones.</p>
        ) : (
          grupos.map((g) => (
            <div key={g.key} style={{ border: `2px solid ${NEGRO_PURO}`, padding: 14, borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", background: BLANCO_CONTRASTE, gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  {g.name}
                  {g.total > 1 && (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: BLANCO_CONTRASTE, background: NEGRO_PURO, padding: "2px 8px", borderRadius: 100 }}>
                      {g.total} entradas
                    </span>
                  )}
                </div>
                {g.email && <div style={{ fontSize: 12, color: NEGRO_MUTED_50 }}>{g.email}</div>}
                <div style={{ fontSize: 11, color: NEGRO_MUTED_50, fontFamily: "monospace", marginTop: 2 }}>
                  {g.items.slice(0, 3).map((i) => i.id).join(" · ")}{g.total > 3 ? ` +${g.total - 3}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {g.pendientes > 0 ? (
                  <button type="button"
                    onClick={() => onSetApproval?.(g.items.filter((i) => i.approved === false).map((i) => i.id), true)}
                    style={{ background: VERDE_CORPORATIVO, color: BLANCO_CONTRASTE, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 800, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Aprobar {g.pendientes > 1 ? `las ${g.pendientes}` : ""}
                  </button>
                ) : (
                  <span style={{ background: g.usadas ? NEGRO_PURO : VERDE_CORPORATIVO, color: BLANCO_CONTRASTE, padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {g.usadas === g.total ? "CHECK-IN" : g.usadas ? `${g.usadas}/${g.total}` : "ACTIVO"}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── FORMULARIO PÚBLICO ──────────────────────────────────────────────────────
function Register({ ev, form, setFormField, errors, onSubmit, onBack }) {
  return (
    <div style={{ border: `2px solid ${NEGRO_PURO}`, borderRadius: 18, padding: 24, background: BLANCO_CONTRASTE }}>
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

      <button type="button" onClick={onSubmit} style={{ width: "100%", background: NEGRO_PURO, color: BLANCO_CONTRASTE, border: "none", padding: 14, borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 12 }}>
        Obtener mi entrada oficial →
      </button>
    </div>
  );
}

function Validate({ event, scopeLabel, code, setCode, result, onCheck, onScan, onReset, onClose }) {
  const [mode, setMode] = useState("camera");
  const cameraActive = mode === "camera" && !result;

  const AZUL_TXT = "#ffffff";
  // Control segmentado: activo relleno claro, inactivo superficie gris.
  const tabStyle = (active) => ({
    flex: 1, height: 44, padding: "0 12px", fontWeight: 600, fontSize: 15,
    border: "none", borderRadius: 12,
    background: active ? "#ffffff" : "var(--tf-surface-2)",
    color: active ? "#000000" : "#ffffff", cursor: "pointer",
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
    <div className="panel-card" style={{ position: "relative", padding: "24px 20px", overflow: "visible" }}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar escáner"
          style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: "50%", border: "none", background: "var(--tf-surface-2)", color: AZUL_TXT, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em", marginBottom: 6, color: AZUL_TXT }}>Check-in con QR</h2>
      <p style={{ fontSize: 14, color: "var(--tf-muted)", marginBottom: 20 }}>{scopeLabel}</p>

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

          {mode === "camera" && (
            <Suspense fallback={<div style={{ minHeight: 280, display: "grid", placeItems: "center", color: "var(--tf-muted)", fontSize: 14 }}>Abriendo cámara…</div>}>
              <QrScanner active={cameraActive} onScan={onScan} />
            </Suspense>
          )}

          {mode === "manual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="TICKET-XXXXXXXX o pega código QR"
                className="tf-input-line"
                style={{ fontSize: 17, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button type="button" onClick={onCheck} style={{ background: "var(--tf-accent)", color: "var(--tf-on-accent)", border: "none", minHeight: 52, padding: "0 14px", fontSize: 16, borderRadius: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Verificar boleto <IconScan size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {result && (() => {
        const ok = result.s === "ok";
        // Pendiente de aprobación no es un error del asistente: se pinta ámbar,
        // no rojo, para que el portero entienda que falta aprobarlo.
        const pending = result.s === "pending";
        const accent = ok ? "#6ee7b7" : pending ? "#fbbf24" : "#f87171";
        const cardBg = ok ? "rgba(52,211,153,0.15)" : pending ? "rgba(251,191,36,0.15)" : "rgba(220,38,38,0.15)";
        const cardBorder = ok ? "rgba(52,211,153,0.5)" : pending ? "rgba(251,191,36,0.5)" : "rgba(220,38,38,0.5)";
        return (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              padding: 20,
              background: cardBg,
              border: `2px solid ${cardBorder}`,
              color: accent,
              borderRadius: 14,
              fontWeight: 900,
              fontSize: 16,
              marginBottom: 16,
            }}
          >
            {ok && "✓ CHECK-IN EXITOSO — ACCESO CONCEDIDO"}
            {result.s === "used" && "⚠️ BOLETO YA UTILIZADO — ACCESO DENEGADO"}
            {pending && "⏳ SUJETO A APROBACIÓN — ACCESO DENEGADO"}
            {result.s === "nf" && "✕ BOLETO NO ENCONTRADO"}
          </div>
          {pending && (
            <p style={{ fontSize: 13, color: "rgba(229,238,255,0.7)", margin: "-6px 0 16px", lineHeight: 1.5 }}>
              Esta inscripción está pendiente de aprobación. Apruébala en
              <strong style={{ color: "#fbbf24" }}> Inscritos</strong> y el QR queda activo al instante.
            </p>
          )}

          {result.participant && result.s !== "nf" && (
            <div style={{ textAlign: "left", border: `1.5px solid ${cardBorder}`, borderRadius: 14, padding: 16, marginBottom: 16, background: cardBg, color: "#ffffff" }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8, color: "#fff" }}>{result.participant.name}</div>
              {result.event && (
                <p style={{ fontSize: 13, color: "rgba(229,238,255,0.85)", margin: "0 0 12px" }}>
                  Evento: <strong style={{ color: "#fff" }}>{result.event.title}</strong>
                </p>
              )}
              {result.participant.rows.map((row) => (
                <div key={row.label} style={{ fontSize: 13, marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 4, color: "rgba(229,238,255,0.9)" }}>
                  <span style={{ fontWeight: 800, color: "#fff" }}>{row.label}:</span> {row.value}
                </div>
              ))}
              <div style={{ fontSize: 12, fontFamily: "monospace", marginTop: 12, color: "rgba(229,238,255,0.6)" }}>{result.ticketId}</div>
              {result.s === "used" && result.reg?.checkedInAt && (
                <p style={{ fontSize: 12, marginTop: 8, color: "rgba(229,238,255,0.7)" }}>
                  Primer ingreso: {new Date(result.reg.checkedInAt).toLocaleString("es-MX")}
                </p>
              )}
              {ok && result.checkedInAt && (
                <p style={{ fontSize: 12, marginTop: 8, color: "#6ee7b7", fontWeight: 700 }}>
                  Registrado: {new Date(result.checkedInAt).toLocaleString("es-MX")}
                </p>
              )}
            </div>
          )}

          {result.s === "nf" && (
            <p style={{ fontSize: 13, color: "rgba(229,238,255,0.6)", marginBottom: 16 }}>
              Verifica que el código sea del evento correcto{event ? ` (${event.title})` : ""} y que la inscripción exista.
            </p>
          )}

          <button type="button" onClick={onReset} style={{ background: "rgba(52,211,153,0.16)", color: "#6ee7b7", padding: "16px 24px", border: "1px solid rgba(52,211,153,0.45)", borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize: 15, width: "auto", maxWidth: 240, margin: "0 auto", display: "block" }}>
            Escanear
          </button>
        </div>
        );
      })()}

      {/* ── Conteo de escaneados y aforo ── */}
      {event && (
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(52,211,153,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(229,238,255,0.7)" }}>Escaneados</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#a7f3d0" }}>{scanned} / {total}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(229,238,255,0.7)" }}>Aforo</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#a7f3d0" }}>{capMax != null ? `${total} / ${capMax}` : `${total} inscritos`}</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.13)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${scanPct}%`, background: "linear-gradient(90deg, #34d399, #6ee7b7)", borderRadius: 6, transition: "width 0.4s" }} />
          </div>
        </div>
      )}
    </div>
  );
}
