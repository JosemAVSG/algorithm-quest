/**
 * S2 — Mission briefing (docs/06-ux-flows.md §4).
 *
 * The contract box is generated from `mission.contract`. If the prose and the
 * schema disagree, the player sees the schema — which is why the prose is not
 * allowed to restate the rules.
 *
 * No "you will learn" line, no difficulty badge (lint L1 and the leak rule).
 */

import type { Mission } from '../../domain/content/schema';
import { BriefingVisual } from './BriefingVisual';

interface BriefingProps {
  mission: Mission;
  onContinue: () => void;
}

export function Briefing({ mission, onContinue }: BriefingProps) {
  const paragraphs = mission.briefing.body.split(/\n{2,}/).filter((part) => part.trim() !== '');

  return (
    <div className="brief">
      <p className="eyebrow">{mission.briefing.headline}</p>
      <h1>{mission.title}</h1>

      <div className={mission.briefing.visual ? 'brief__intro brief__intro--visual' : 'brief__intro'}>
        <div className="brief__body">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        {mission.briefing.visual ? <BriefingVisual id={mission.briefing.visual} /> : null}
      </div>

      <section className="requirements" aria-label="Lo que necesito">
        <h2>Lo que necesito</h2>
        <ul>
          {mission.briefing.requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </section>

      <section className="contract" aria-label="Contrato de la función">
        <h2>Contrato</h2>
        <p className="contract__signature">{mission.contract.signature}</p>
        <dl className="contract__shape">
          <div>
            <dt>Entrada</dt>
            <dd>{mission.contract.inputShape}</dd>
          </div>
          <div>
            <dt>Salida</dt>
            <dd>{mission.contract.outputShape}</dd>
          </div>
        </dl>
        <ul className="contract__rules">
          {mission.contract.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onContinue}>
          Entendido →
        </button>
      </div>
    </div>
  );
}
