// Catálogo fijo de objetivos de observación, sesgado al hemisferio sur porque
// es lo que se ve desde Paranal. Es sólo data: la resolución contra el motor y
// el filtrado por altura viven en objects.js.
//
// Cada entrada lleva VARIAS designaciones candidatas y no una sola. El motor
// resuelve por nombre contra los catálogos que tenga cargados, y esos catálogos
// se sirven por red: qué cadena reconoce para cada objeto depende de los packs
// presentes, no de este archivo. resolveTarget() se queda con la primera que
// devuelve algo, y resolveCatalog() informa las que no resolvieron ninguna.
// Agregar un objetivo es agregar una fila.

export const TARGET_KINDS = [
  'moon', 'planet', 'star', 'cluster', 'nebula', 'galaxy', 'constellation',
];

// El Sol no está: no es objetivo de observación. Su altura la usa el chequeo de
// noche, que consulta 'NAME Sun' directo.
export const SKY_TARGETS = [
  // ── Sistema solar ───────────────────────────────────────────────────
  { id: 'moon',    kind: 'moon',   name: 'Luna',    designations: ['NAME Moon', 'Moon'] },
  { id: 'mercury', kind: 'planet', name: 'Mercurio', designations: ['NAME Mercury', 'Mercury'] },
  { id: 'venus',   kind: 'planet', name: 'Venus',   designations: ['NAME Venus', 'Venus'] },
  { id: 'mars',    kind: 'planet', name: 'Marte',   designations: ['NAME Mars', 'Mars'] },
  { id: 'jupiter', kind: 'planet', name: 'Júpiter', designations: ['NAME Jupiter', 'Jupiter'] },
  { id: 'saturn',  kind: 'planet', name: 'Saturno', designations: ['NAME Saturn', 'Saturn'] },
  { id: 'uranus',  kind: 'planet', name: 'Urano',   designations: ['NAME Uranus', 'Uranus'] },
  { id: 'neptune', kind: 'planet', name: 'Neptuno', designations: ['NAME Neptune', 'Neptune'] },

  // ── Estrellas brillantes ────────────────────────────────────────────
  // Resuelven con el pack mínimo de estrellas, sin depender de los de DSO. Son
  // el control de que la cadena funciona aunque falte un catálogo pesado.
  { id: 'sirius',     kind: 'star', name: 'Sirio',      designations: ['NAME Sirius', 'HIP 32349'] },
  { id: 'canopus',    kind: 'star', name: 'Canopus',    designations: ['NAME Canopus', 'HIP 30438'] },
  { id: 'alpha-cen',  kind: 'star', name: 'Alfa Centauri', designations: ['NAME Rigil Kentaurus', 'NAME Alpha Centauri', 'HIP 71683'] },
  { id: 'achernar',   kind: 'star', name: 'Achernar',   designations: ['NAME Achernar', 'HIP 7588'] },
  { id: 'antares',    kind: 'star', name: 'Antares',    designations: ['NAME Antares', 'HIP 80763'] },
  { id: 'betelgeuse', kind: 'star', name: 'Betelgeuse', designations: ['NAME Betelgeuse', 'HIP 27989'] },
  { id: 'rigel',      kind: 'star', name: 'Rigel',      designations: ['NAME Rigel', 'HIP 24436'] },
  { id: 'aldebaran',  kind: 'star', name: 'Aldebarán',  designations: ['NAME Aldebaran', 'HIP 21421'] },
  { id: 'spica',      kind: 'star', name: 'Espiga',     designations: ['NAME Spica', 'HIP 65474'] },
  { id: 'fomalhaut',  kind: 'star', name: 'Fomalhaut',  designations: ['NAME Fomalhaut', 'HIP 113368'] },

  // ── Nebulosas ───────────────────────────────────────────────────────
  { id: 'orion-nebula',    kind: 'nebula', name: 'Nebulosa de Orión',
    designations: ['M 42', 'NGC 1976', 'NAME Orion Nebula'] },
  { id: 'carina-nebula',   kind: 'nebula', name: 'Nebulosa de Carina',
    designations: ['NGC 3372', 'NAME Carina Nebula', 'NAME Eta Carinae Nebula'] },
  { id: 'tarantula',       kind: 'nebula', name: 'Nebulosa de la Tarántula',
    designations: ['NGC 2070', 'NAME Tarantula Nebula'] },
  { id: 'lagoon',          kind: 'nebula', name: 'Nebulosa de la Laguna',
    designations: ['M 8', 'NGC 6523', 'NAME Lagoon Nebula'] },
  { id: 'trifid',          kind: 'nebula', name: 'Nebulosa Trífida',
    designations: ['M 20', 'NGC 6514', 'NAME Trifid Nebula'] },
  { id: 'omega-nebula',    kind: 'nebula', name: 'Nebulosa Omega',
    designations: ['M 17', 'NGC 6618', 'NAME Omega Nebula', 'NAME Swan Nebula'] },
  { id: 'eagle',           kind: 'nebula', name: 'Nebulosa del Águila',
    designations: ['M 16', 'NGC 6611', 'NAME Eagle Nebula'] },
  { id: 'ring',            kind: 'nebula', name: 'Nebulosa del Anillo',
    designations: ['M 57', 'NGC 6720', 'NAME Ring Nebula'] },
  { id: 'helix',           kind: 'nebula', name: 'Nebulosa Hélice',
    designations: ['NGC 7293', 'NAME Helix Nebula'] },
  { id: 'dumbbell',        kind: 'nebula', name: 'Nebulosa Dumbbell',
    designations: ['M 27', 'NGC 6853', 'NAME Dumbbell Nebula'] },

  // ── Cúmulos ─────────────────────────────────────────────────────────
  { id: 'pleiades',        kind: 'cluster', name: 'Pléyades',
    designations: ['M 45', 'NAME Pleiades', 'Mel 22'] },
  { id: 'hyades',          kind: 'cluster', name: 'Híades',
    designations: ['NAME Hyades', 'Mel 25', 'Cr 50'] },
  { id: '47-tucanae',      kind: 'cluster', name: '47 Tucanae',
    designations: ['NGC 104', 'NAME 47 Tucanae'] },
  { id: 'omega-centauri',  kind: 'cluster', name: 'Omega Centauri',
    designations: ['NGC 5139', 'NAME Omega Centauri'] },
  { id: 'jewel-box',       kind: 'cluster', name: 'El Joyero',
    designations: ['NGC 4755', 'NAME Jewel Box'] },
  { id: 'southern-pleiades', kind: 'cluster', name: 'Pléyades del Sur',
    designations: ['IC 2602', 'NAME Southern Pleiades'] },
  { id: 'ptolemy',         kind: 'cluster', name: 'Cúmulo de Ptolomeo',
    designations: ['M 7', 'NGC 6475', 'NAME Ptolemy Cluster'] },
  { id: 'butterfly',       kind: 'cluster', name: 'Cúmulo de la Mariposa',
    designations: ['M 6', 'NGC 6405', 'NAME Butterfly Cluster'] },
  { id: 'wild-duck',       kind: 'cluster', name: 'Cúmulo del Pato Salvaje',
    designations: ['M 11', 'NGC 6705', 'NAME Wild Duck Cluster'] },

  // ── Galaxias ────────────────────────────────────────────────────────
  { id: 'lmc',          kind: 'galaxy', name: 'Gran Nube de Magallanes',
    designations: ['NAME Large Magellanic Cloud', 'NAME LMC', 'ESO 56-115'] },
  { id: 'smc',          kind: 'galaxy', name: 'Pequeña Nube de Magallanes',
    designations: ['NAME Small Magellanic Cloud', 'NAME SMC', 'NGC 292'] },
  { id: 'andromeda',    kind: 'galaxy', name: 'Galaxia de Andrómeda',
    designations: ['M 31', 'NGC 224', 'NAME Andromeda Galaxy'] },
  { id: 'centaurus-a',  kind: 'galaxy', name: 'Centaurus A',
    designations: ['NGC 5128', 'NAME Centaurus A'] },
  { id: 'sombrero',     kind: 'galaxy', name: 'Galaxia del Sombrero',
    designations: ['M 104', 'NGC 4594', 'NAME Sombrero Galaxy'] },
  { id: 'triangulum',   kind: 'galaxy', name: 'Galaxia del Triángulo',
    designations: ['M 33', 'NGC 598', 'NAME Triangulum Galaxy'] },

  // ── Constelaciones ──────────────────────────────────────────────────
  // El id que arma el motor combina cultura y abreviatura; el nombre traducido
  // sale de la skyculture cargada. Las dos formas van como candidatas.
  { id: 'crux',        kind: 'constellation', name: 'Cruz del Sur',
    designations: ['CON western Cru', 'NAME Crux', 'Crux'] },
  { id: 'centaurus',   kind: 'constellation', name: 'Centauro',
    designations: ['CON western Cen', 'NAME Centaurus', 'Centaurus'] },
  { id: 'scorpius',    kind: 'constellation', name: 'Escorpio',
    designations: ['CON western Sco', 'NAME Scorpius', 'Scorpius'] },
  { id: 'sagittarius', kind: 'constellation', name: 'Sagitario',
    designations: ['CON western Sgr', 'NAME Sagittarius', 'Sagittarius'] },
  { id: 'orion',       kind: 'constellation', name: 'Orión',
    designations: ['CON western Ori', 'NAME Orion', 'Orion'] },
  { id: 'carina',      kind: 'constellation', name: 'Carina',
    designations: ['CON western Car', 'NAME Carina', 'Carina'] },
  { id: 'canis-major', kind: 'constellation', name: 'Can Mayor',
    designations: ['CON western CMa', 'NAME Canis Major', 'Canis Major'] },
  { id: 'taurus',      kind: 'constellation', name: 'Tauro',
    designations: ['CON western Tau', 'NAME Taurus', 'Taurus'] },
  { id: 'leo',         kind: 'constellation', name: 'Leo',
    designations: ['CON western Leo', 'NAME Leo', 'Leo'] },
  { id: 'gemini',      kind: 'constellation', name: 'Géminis',
    designations: ['CON western Gem', 'NAME Gemini', 'Gemini'] },
  { id: 'cassiopeia',  kind: 'constellation', name: 'Casiopea',
    designations: ['CON western Cas', 'NAME Cassiopeia', 'Cassiopeia'] },
  { id: 'ursa-major',  kind: 'constellation', name: 'Osa Mayor',
    designations: ['CON western UMa', 'NAME Ursa Major', 'Ursa Major'] },
];

/** Objetivo por id, o `undefined`. */
export function getTargetById(id, catalog = SKY_TARGETS) {
  return catalog.find((t) => t.id === id);
}
