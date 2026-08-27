// Iconos SVG por categoría (compartidos entre Descubrir y Crear evento).
// Cada función recibe el color y opcionalmente el tamaño.
export const CAT_ICONS = {
  tech: (color, size = 28) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
    </svg>
  ),
  social: (color, size = 28) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  comida: (color, size = 28) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  deporte: (color, size = 28) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2.5" fill={color} stroke="none"/>
      <path d="M5 20l4.5-5 2 2 2.5-5 3.5 3"/><path d="M8 13l1.5-6 2.5 2 3-2"/>
    </svg>
  ),
  bienestar: (color, size = 28) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3"/><path d="M12 8v14"/>
      <path d="M12 14c-3-3-7-2.5-8.5 0 2 3.5 5.5 5 8.5 2z"/>
      <path d="M12 14c3-3 7-2.5 8.5 0-2 3.5-5.5 5-8.5 2z"/>
    </svg>
  ),
  arte: (color, size = 28) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.37-.15-.71-.4-1a1.5 1.5 0 0 1 1.4-2.5h2a5 5 0 0 0 5-5c0-4.4-4-8-9-8z"/>
      <circle cx="7" cy="13" r="1" fill={color} stroke="none"/>
      <circle cx="10" cy="8" r="1" fill={color} stroke="none"/>
      <circle cx="14.5" cy="8" r="1" fill={color} stroke="none"/>
      <circle cx="17" cy="12.5" r="1" fill={color} stroke="none"/>
    </svg>
  ),
  // "Otro" era un pin de mapa: el MISMO dibujo que el icono de ubicación de la
  // tarjeta, así que en una fila de datos parecía que el evento no tenía sitio.
  // Tres puntos dentro de un círculo se leen como "lo demás" y no se confunden
  // con nada más de la app.
  otro: (color, size = 28) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="7.6" cy="12" r="1.05" fill={color} stroke="none"/>
      <circle cx="12"  cy="12" r="1.05" fill={color} stroke="none"/>
      <circle cx="16.4" cy="12" r="1.05" fill={color} stroke="none"/>
    </svg>
  ),
};
