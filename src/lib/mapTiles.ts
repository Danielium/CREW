import * as maplibregl from "maplibre-gl";

// CartoDB закрыл анонимный доступ к бесплатным тёмным тайлам (требует ключ).
// Растровые OSM-тайлы + CSS-инверсия давали мутную картинку без деталей и
// размытые подписи на Retina-экранах (обычный 256px растр). OpenFreeMap отдаёт
// честный векторный тёмный стиль бесплатно и без ключа — рендерится чётко на
// любом экране и не требует красить тайлы самостоятельно.
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// Turbopack ломает автоматическое определение пути до воркера MapLibre
// (import.meta.url резолвится не туда, воркер 404-ится) — держим свою копию
// воркера и его internal-зависимости в /public и указываем на неё явно.
// См. https://github.com/vercel/next.js/issues/86495
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}
