import { inputStyle, NEGRO_PURO } from "../lib/theme.js";

export default function FieldInput({ field, value, onChange, error }) {
  const set = (v) => onChange(field.id, v);

  const base = { ...inputStyle };

  if (field.type === "textarea") {
    return (
      <textarea
        style={{ ...base, minHeight: 90, resize: "vertical" }}
        value={value ?? ""}
        onChange={(e) => set(e.target.value)}
        placeholder={field.placeholder || ""}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select style={base} value={value ?? ""} onChange={(e) => set(e.target.value)}>
        <option value="">— Selecciona —</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(field.options || []).map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: `2px solid ${NEGRO_PURO}`,
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? selected.filter((x) => x !== opt)
                    : [...selected, opt];
                  set(next);
                }}
                style={{ width: 18, height: 18 }}
              />
              {opt}
            </label>
          );
        })}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => set(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 2 }}
        />
        <span>{field.label}</span>
      </label>
    );
  }

  const inputType =
    field.type === "email"
      ? "email"
      : field.type === "phone"
        ? "tel"
        : field.type === "age" || field.type === "number"
          ? "number"
          : "text";

  return (
    <input
      type={inputType}
      style={base}
      value={value ?? ""}
      onChange={(e) => set(e.target.value)}
      placeholder={field.placeholder || ""}
      min={field.type === "age" ? 1 : undefined}
      max={field.type === "age" ? 120 : undefined}
    />
  );
}

export function FieldError({ error }) {
  if (!error) return null;
  return (
    <div style={{ color: "#000", fontSize: 12, marginTop: 4, fontWeight: 700 }}>
      ⚠️ {error}
    </div>
  );
}
