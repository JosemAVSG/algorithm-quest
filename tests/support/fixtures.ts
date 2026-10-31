/**
 * Test fixtures.
 *
 * One compact valid mission plus explicit mutations, instead of fourteen
 * near-identical 200-line JSON files. Each mutation is named after the rule it
 * breaks, so a failing test reads as "V4 duplicate test id" rather than a diff
 * between two fixture files nobody wants to maintain.
 *
 * The registries here are synthetic and minimal on purpose: these tests exercise
 * the rules, not the real content. Real content is covered by pipeline.test.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Draft = Record<string, any>;

export function validMission(): Draft {
  return {
    schemaVersion: 1,
    id: 'M01',
    contentVersion: '1.0.0',
    locale: 'es',
    world: 'w1',
    order: 1,
    title: 'El primer diagnóstico',
    subtitle: 'Condiciones',
    difficulty: 1,
    estimatedMinutes: 5,

    concepts: { primary: 'C01', secondary: ['C02'] },
    prerequisites: { missions: [], concepts: [] },
    workshop: { systemId: 'sys.sensor', from: 'broken', to: 'working' },

    briefing: {
      headline: 'Sensor array',
      body: 'El sensor marca 95 y el límite es 90. Devuelve si hay que disparar la alarma.',
      requirements: ['Recibe la lectura', 'Devuelve un boolean'],
      forbiddenVocabulary: [],
    },

    contract: {
      entryPoint: 'isOverLimit',
      signature: 'isOverLimit(temperature, limit) -> boolean',
      inputShape: 'temperature: number, limit: number',
      outputShape: 'boolean',
      rules: ['true cuando supera estrictamente', 'false en cualquier otro caso'],
    },

    constraints: {
      bannedConstructs: [],
      allowClosedForm: true,
      mustNotMutate: false,
    },

    starterCode: 'function isOverLimit(temperature, limit) {\n  // your code here\n}\n',

    tests: {
      visible: [
        { id: 'v1', input: [95, 90], expected: true, note: 'por encima' },
        { id: 'v2', input: [85, 90], expected: false, note: 'por debajo' },
      ],
      hidden: [
        { id: 'h1', input: [91, 90], expected: true, note: 'apenas por encima' },
        { id: 'h2', input: [89, 90], expected: false, note: 'apenas por debajo' },
        { id: 'h3', input: [200, 90], expected: true, note: 'extremo' },
      ],
      edge: [
        {
          id: 'ed1',
          input: [90, 90],
          expected: false,
          edge: true,
          edgeKind: 'boundary-equal',
          note: 'justo en el límite',
        },
        {
          id: 'ed2',
          input: [0, 0],
          expected: false,
          edge: true,
          edgeKind: 'zero',
          note: 'cero contra cero',
        },
      ],
    },

    diagnostics: [
      { code: 'E05', when: { failingTestIds: ['ed1'] }, message: 'Revisa el operador.' },
      { code: 'E02', message: 'El código lanzó una excepción.' },
    ],

    hints: [
      { level: 1, text: '¿Qué dos valores tiene que mirar la función para decidir?' },
      { level: 2, text: 'Ejecuta mentalmente con 90 y 90. ¿Qué devuelve tu código?' },
      { level: 3, text: 'La palabra que importa es «estrictamente»: el límite no es peligroso.' },
      {
        level: 4,
        text: 'Otra puerta del taller: se bloquea solo si la presión supera el tope, no si lo iguala.\n\nfunction debeBloquearse(p, tope) {\n  return p > tope;\n}',
        unlock: { attempts: 4, hintsUsed: 3 },
      },
    ],

    debrief: {
      whyItWorks:
        'Una condición traduce una pregunta del mundo real a un valor que el sistema puede usar.',
      edgeCaseNote:
        'En el límite exacto la alarma no se dispara: es una decisión de diseño, no un accidente.',
      complexity: {
        question: '¿Cuántas comparaciones hace tu función?',
        options: ['Una sola, siempre', 'Una por sensor'],
        correctIndex: 0,
        explanation:
          'La función mira un único valor y lo compara una vez. El coste no depende de nada.',
      },
      realWorld:
        'Validación de umbrales: temperatura de CPU, saldo mínimo, latencia máxima aceptable.',
      reasoningPrompt:
        'Explica por qué con 90 exactos la alarma no se dispara, y qué cambiarías si el límite también fuera peligroso.',
      objectiveNouns: ['alarma', 'límite'],
      reasoningLexicon: ['comparo', 'supera'],
    },

    mastery: { transferMissionId: 'M01', reinforcementVariants: [] },

    reward: {
      systemId: 'sys.sensor',
      effect: 'broken → working',
      narrative: 'El sensor vuelve a emitir lecturas.',
    },
  };
}

export function conceptsRegistry() {
  return {
    schemaVersion: 1,
    concepts: [
      { id: 'C01', label: 'Condición', world: 'w1', mvp: true },
      { id: 'C02', label: 'Casos límite', world: 'w1', mvp: true },
    ],
  };
}

export function workshopRegistry() {
  return {
    schemaVersion: 1,
    systems: [
      {
        id: 'sys.sensor',
        name: 'Sensor array',
        initialState: 'broken',
        states: ['broken', 'working', 'reliable'],
        transitions: [
          { from: 'broken', to: 'working' },
          { from: 'working', to: 'reliable' },
        ],
      },
    ],
  };
}

export function worldsRegistry(missionIds: string[] = ['M01'], status = 'in-progress') {
  return {
    schemaVersion: 1,
    worlds: [
      { id: 'w1', name: 'World 1', status, missionIds },
    ],
  };
}

export function reinforcementRegistry() {
  return { schemaVersion: 1, variants: [] };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Deep-clone the valid mission, break it, return it. */
export function broken(base: Draft, breakIt: (draft: Draft) => void): Draft {
  const draft = clone(base);
  breakIt(draft);
  return draft;
}
