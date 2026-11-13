// Portadas: lado mayor hasta 2400 px. Antes se reducían a 1200 px de ancho, y
// así no había margen para acercar la foto con los dedos sin que se pixelara
// (en un iPhone el recuadro ya ocupa ~1070 px físicos).
const COVER_MAX_SIDE = 2400;
const COVER_BYTES_HINT = 1_200_000; // longitud del data URL (~900 KB reales)

/**
 * Estilo del <img> de una portada con el encuadre que eligió el organizador.
 *
 * `pos` ({x, y} en %) es el punto de la foto que queda a la vista y `zoom`
 * (≥ 1) cuánto se acercó. El escalado usa ESE MISMO punto como origen, y con
 * esa combinación la foto cubre el recuadro para cualquier x, y entre 0 y 100:
 * nunca asoman bordes vacíos. Sirve igual para el recuadro cuadrado del editor
 * que para las tarjetas apaisadas de los listados.
 */
export function coverImgStyle(pos, zoom) {
  const x = Number.isFinite(Number(pos?.x)) ? Number(pos.x) : 50;
  const y = Number.isFinite(Number(pos?.y)) ? Number(pos.y) : 50;
  const z = Math.max(1, Number(zoom) || 1);
  return {
    width: "100%", height: "100%", display: "block",
    objectFit: "cover",
    objectPosition: `${x}% ${y}%`,
    ...(z > 1.001 ? { transform: `scale(${z})`, transformOrigin: `${x}% ${y}%` } : null),
  };
}

/** Comprime y recorta una foto de perfil a un cuadrado pequeño (JPEG base64). */
export function compressAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Selecciona un archivo de imagen."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("La imagen es muy grande (máx. 8 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Recorte centrado tipo "cover" a un cuadrado.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > 90_000 && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Error al cargar el archivo."));
    reader.readAsDataURL(file);
  });
}

/** Comprime imagen de encabezado a JPEG base64 para localStorage. */
export function compressHeaderImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Selecciona un archivo de imagen."));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      reject(new Error("La imagen es muy grande (máx. 20 MB)."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const lado = Math.max(width, height);
        if (lado > COVER_MAX_SIDE) {
          const k = COVER_MAX_SIDE / lado;
          width = Math.round(width * k);
          height = Math.round(height * k);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.86;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > COVER_BYTES_HINT && quality > 0.62) {
          quality -= 0.06;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Error al cargar el archivo."));
    reader.readAsDataURL(file);
  });
}
