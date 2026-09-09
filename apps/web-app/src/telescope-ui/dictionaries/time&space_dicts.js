// The source split this across two menu sub-tabs (GlobePicker + DateTimePicker).
// The redesign merges them: for a first-time user "desde dónde y cuándo miro" is
// one question. All wiring below is from those two components.
export const SPEEDS = [
  { value: 0, label: 'Stop' },
  { value: 1, label: 'Realtime' },
  { value: 10, label: '10s/s' },
  { value: 60, label: '1min/s' },
  { value: 3600, label: '1h/s' },
];
export const PARANAL = { lat: -24.6272, lon: -70.4042 };

// El orden es el de lectura de una fecha (grande a chico).
// `unit` es sólo para las etiquetas aria.
export const FIELDS = [
  { key: 'year', label: 'Año', unit: 'año' },
  { key: 'month', label: 'Mes', unit: 'mes' },
  { key: 'day', label: 'Día', unit: 'día' },
  { key: 'hour', label: 'Hora', unit: 'hora' },
  { key: 'minute', label: 'Min', unit: 'minuto' },
];
