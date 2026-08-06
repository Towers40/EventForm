import { Link } from "react-router-dom";

export default function PrivacyPage() {
  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px", lineHeight: 1.65, color: "#1a1a1a" }}>
      <Link to="/" style={{ fontWeight: 700, color: "#222b4c" }}>← Volver</Link>
      <h1 style={{ fontSize: 28, marginTop: 24 }}>Política de privacidad y tratamiento de datos</h1>
      <p style={{ color: "#5c6b7a" }}>Última actualización: mayo 2026 · Colombia (Ley 1581 de 2012)</p>

      <h2>1. Responsable</h2>
      <p>
        TapIn Colombia («nosotros», «la plataforma») es responsable del tratamiento de los datos
        personales recogidos a través de los formularios de inscripción a eventos publicados por
        anfitriones registrados.
      </p>

      <h2>2. Datos que recopilamos</h2>
      <ul>
        <li>Datos de cuenta de anfitrión: nombre, correo electrónico, contraseña (cifrada).</li>
        <li>Datos de inscripción definidos por cada evento: nombre, correo, teléfono, u otros campos configurados.</li>
        <li>Datos de uso: fecha de registro, estado de check-in, consentimientos otorgados.</li>
        <li>Ubicación del evento (coordenadas y dirección) proporcionada por el anfitrión.</li>
      </ul>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Gestionar inscripciones y emitir pases digitales con código QR.</li>
        <li>Validar el ingreso al evento (check-in).</li>
        <li>Comunicar información logística del evento al asistente.</li>
        <li>
          <strong>Marketing (solo con consentimiento expreso opcional):</strong> enviar promociones,
          novedades y otros eventos por correo o medios electrónicos.
        </li>
      </ul>

      <h2>4. Base legal y consentimiento</h2>
      <p>
        El tratamiento para inscripción y check-in se basa en la ejecución del servicio solicitado
        por el usuario y el consentimiento informado al aceptar esta política (casilla obligatoria).
        El envío de comunicaciones promocionales requiere una casilla adicional, libre y específica.
      </p>

      <h2>5. Derechos del titular</h2>
      <p>
        Puedes solicitar acceso, actualización, rectificación o supresión de tus datos escribiendo al
        correo de contacto del anfitrión del evento o a{" "}
        <a href="mailto:tapinwalletcol@gmail.com">tapinwalletcol@gmail.com</a>.
      </p>

      <h2>6. Conservación y seguridad</h2>
      <p>
        Los datos se almacenan en servidores con acceso restringido. Conservamos la información
        mientras el evento lo requiera y durante los plazos legales aplicables.
      </p>

      <h2>7. Transferencia a terceros</h2>
      <p>
        Podemos usar proveedores de mapas (OpenStreetMap), generación de QR y hosting. No vendemos
        datos personales a terceros.
      </p>

      <h2>8. Menores</h2>
      <p>Los formularios están dirigidos a mayores de edad o con autorización de representante legal.</p>

      <h2>9. Cambios</h2>
      <p>Publicaremos cambios en esta página. El uso continuado implica conocimiento de la versión vigente.</p>
    </article>
  );
}
