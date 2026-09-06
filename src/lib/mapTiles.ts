// CartoDB закрыл анонимный доступ к бесплатным тайлам (basemaps.cartocdn.com теперь требует ключ).
// Используем обычные тайлы OpenStreetMap (без ключа, без регистрации) и красим их в тёмный
// цвет через CSS-фильтр (см. .leaflet-tile-pane в globals.css).
export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
