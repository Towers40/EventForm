import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TypeformRegister from "../components/TypeformRegister.jsx";
import ConfirmTicket from "../components/ConfirmTicket.jsx";
import { api, apiEnabled } from "../lib/api.js";
import { loadEvents, saveEvents } from "../lib/storage.js";

export default function PublicEventPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [reg, setReg] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (apiEnabled) {
          const { event: ev } = await api.publicEvent(slug);
          setEvent(ev);
          return;
        }
        const local = loadEvents().find((e) => e.slug === slug);
        if (local) setEvent(local);
        else setErr("Evento no encontrado");
      } catch {
        setErr("Evento no encontrado o no disponible");
      }
    })();
  }, [slug]);

  const handleSubmit = async (payload) => {
    if (apiEnabled) {
      const { registration } = await api.publicRegister(slug, payload);
      setReg(registration);
      return;
    }
    const events = loadEvents();
    const ev = events.find((e) => e.slug === slug);
    const ticket = {
      id: "TICKET-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      eventId: ev.id,
      data: payload.form,
      ts: Date.now(),
      used: false,
      consentMarketing: payload.consentMarketing,
    };
    const updated = events.map((e) =>
      e.id === ev.id ? { ...e, registrations: [...e.registrations, ticket] } : e
    );
    saveEvents(updated);
    setReg(ticket);
  };

  if (err) {
    return (
      <div className="tf-screen">
        <div className="tf-body">
          <h1 className="tf-question">{err}</h1>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="tf-screen">
        <div className="tf-body">
          <p className="tf-hint">Cargando…</p>
        </div>
      </div>
    );
  }

  if (reg) {
    return <ConfirmTicket ev={event} reg={reg} standalone />;
  }

  return <TypeformRegister event={event} onSubmit={handleSubmit} />;
}
