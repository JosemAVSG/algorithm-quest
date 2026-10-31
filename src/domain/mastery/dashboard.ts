/**
 * The derived view behind S7 (docs/06-ux-flows.md §8).
 *
 * Built from events on every render. Nothing here is persisted, so a player can
 * delete their derived mastery and get the same dashboard back — the auditability
 * rule in docs/05 §1.
 *
 * Explanations are player-facing Spanish, like every other string the workshop
 * speaks. The format is the point: a cap without a sentence reads as a
 * punishment; a cap with one reads as a rule.
 */

import type { Concept } from '../content/schema';
import type { EvidenceEvent } from './evidence';
import type { ReinforcementItem } from './reinforcement';
import {
  conceptLevel,
  type CapKind,
  type ConceptLevel,
  type Dimensions,
  type TransferStatus,
} from './score';

export interface ConceptMasteryView {
  conceptId: string;
  label: string;
  world: string;
  level: ConceptLevel;
  mastery: number | null;
  dimensions: Dimensions | null;
  /** Events that drive the level (max 5). */
  evidenceCount: number;
  /** Every event ever recorded for this concept. */
  totalEvidence: number;
  evidenceMissions: number;
  independentCount: number;
  cap: CapKind | null;
  transfer: TransferStatus;
  /** One plain-language sentence: what the level means and what would raise it. */
  note: string;
}

export interface MasteryDashboard {
  concepts: ConceptMasteryView[];
  pendingReinforcement: ReinforcementItem[];
  levelCounts: Record<ConceptLevel, number>;
}

export interface DashboardInput {
  concepts: readonly Concept[];
  events: readonly EvidenceEvent[];
  pendingReinforcement: readonly ReinforcementItem[];
}

function noteFor(
  result: ReturnType<typeof conceptLevel>,
  independentCount: number,
): string {
  if (result.mastery === null) {
    return 'Aún no hay evidencia. Una misión que lo trabaje lo pone en el mapa.';
  }

  if (result.level === 'transferable') {
    return 'Transferido: lo has aplicado en más de un contexto y sin ayuda.';
  }

  if (result.cap === 'reveal') {
    return 'Viste la solución: el nivel se queda en «practicando» hasta una nueva evidencia sin revelarla.';
  }

  if (result.cap === 'assistance') {
    return 'La última evidencia necesitó demasiada ayuda: el nivel se queda en «practicando».';
  }

  if (result.cap === 'single-source') {
    return 'Solo hay evidencia de una misión. Para «transferible» necesitas otro contexto.';
  }

  if ((result.mastery ?? 0) >= 0.8) {
    if (result.transfer.distinctMissions < 2) {
      return 'Te falta una segunda misión con este concepto para «transferible».';
    }
    if (!result.transfer.independent || independentCount === 0) {
      return 'Te falta resolverlo con ≤1 pista y sin revelar la solución.';
    }
  }

  if (result.level === 'introduced') {
    return 'Está introducido. Practicarlo en otra misión lo sube de nivel.';
  }

  return 'Sigue practicando: el nivel sube con evidencia nueva, no con el tiempo.';
}

export function buildMasteryDashboard(input: DashboardInput): MasteryDashboard {
  const levelCounts: Record<ConceptLevel, number> = {
    locked: 0,
    introduced: 0,
    practicing: 0,
    proficient: 0,
    transferable: 0,
  };

  const concepts = input.concepts
    .filter((concept) => concept.mvp)
    .map((concept): ConceptMasteryView => {
      const result = conceptLevel(input.events, concept.id);
      const independentCount = result.window.filter(
        (event) => event.hintsUsed <= 1 && !event.solutionRevealed,
      ).length;
      levelCounts[result.level] += 1;

      return {
        conceptId: concept.id,
        label: concept.label,
        world: concept.world,
        level: result.level,
        mastery: result.mastery,
        dimensions: result.dimensions,
        evidenceCount: result.window.length,
        totalEvidence: input.events.filter((event) => event.conceptId === concept.id).length,
        evidenceMissions: new Set(result.window.map((event) => event.missionId)).size,
        independentCount,
        cap: result.cap,
        transfer: result.transfer,
        note: noteFor(result, independentCount),
      };
    })
    .sort((a, b) => a.conceptId.localeCompare(b.conceptId));

  return {
    concepts,
    pendingReinforcement: [...input.pendingReinforcement].sort(
      (a, b) => a.mastery - b.mastery || a.conceptId.localeCompare(b.conceptId),
    ),
    levelCounts,
  };
}
