import { memo, useRef, type KeyboardEvent, type RefObject } from "react";
import { Building2, Gauge, MapPinned, Search } from "lucide-react";
import type {
  DistrictStrategicFront,
  DistrictStrategicFrontKind,
  DistrictStrategicFrontsViewModel
} from "@/app/campaign/district-strategic-front-model";
import type { StrategicCommandAction } from "@/app/campaign/strategic-command-model";
import styles from "./DistrictStrategicFronts.module.css";

const FRONT_ICON = {
  investigation: Search,
  institution: Building2,
  pressure: Gauge
} as const;

export const DistrictStrategicFronts = memo(function DistrictStrategicFronts({
  model,
  selectedFrontKey,
  panelOpen,
  triggerRef,
  onPanelToggle,
  onSelect,
  onAction
}: {
  model: DistrictStrategicFrontsViewModel;
  selectedFrontKey?: DistrictStrategicFrontKind;
  panelOpen: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onPanelToggle: () => void;
  onSelect: (front: DistrictStrategicFront) => void;
  onAction?: (action: StrategicCommandAction, front: DistrictStrategicFront) => void | Promise<void>;
}) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  if (model.status === "empty") return null;
  const selected = model.fronts.find((front) => front.key === selectedFrontKey)
    || model.fronts.find((front) => front.key === model.currentFrontKey)
    || model.fronts[0];

  function navigateFront(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? model.fronts.length - 1 : (index + delta + model.fronts.length) % model.fronts.length;
    const front = model.fronts[next];
    if (!front) return;
    onSelect(front);
    optionRefs.current[next]?.focus();
  }

  return (
    <section className={`${styles.surface} ${panelOpen ? styles.open : ""}`} data-testid="district-strategic-fronts" data-front-status={model.status}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        data-testid="district-fronts-toggle"
        aria-expanded={panelOpen}
        aria-controls="district-strategic-front-panel"
        onClick={onPanelToggle}
      >
        <MapPinned size={16} aria-hidden="true" />
        <span><small>Strategic Fronts</small><strong>{selected?.districtLabel || "Townwide"}</strong></span>
        <b>{model.fronts.length} / {selected?.state || model.status}</b>
      </button>
      <div id="district-strategic-front-panel" className={styles.panel} data-testid="district-fronts-panel" aria-hidden={!panelOpen}>
        <header>
          <span>District Operations</span>
          <strong>{selected?.label || "Strategic Front"}</strong>
          <small>Choose a public district focus. Execution stays with the existing command handler.</small>
        </header>
        <div className={styles.options} role="group" aria-label="District strategic fronts">
          {model.fronts.map((front, index) => {
            const Icon = FRONT_ICON[front.key];
            return (
              <button
                key={front.key}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                data-testid="district-front-option"
                data-front-kind={front.key}
                data-front-state={front.state}
                data-front-lens={front.lens}
                data-front-location={front.districtLabel}
                aria-pressed={front.key === selected?.key}
                onClick={() => onSelect(front)}
                onKeyDown={(event) => navigateFront(event, index)}
              >
                <Icon size={15} aria-hidden="true" />
                <span><b>{front.label}</b><small>{front.districtLabel}</small></span>
                <em>{front.state}</em>
              </button>
            );
          })}
        </div>
        {selected ? (
          <article className={styles.detail} data-testid="district-front-detail" data-front-kind={selected.key} data-front-tone={selected.tone} data-front-location={selected.districtLabel}>
            <div className={styles.detailHeading}><span>{selected.districtLabel}</span><b>{selected.summary}</b></div>
            <dl>
              <div><dt>Why now</dt><dd>{selected.whyNow}</dd></div>
              <div><dt>Visible benefit</dt><dd>{selected.benefitLabel}</dd></div>
              <div><dt>Cost / boundary</dt><dd>{selected.costLabel}</dd></div>
            </dl>
            {selected.action && onAction ? (
              <button type="button" className={styles.action} data-testid="district-front-action" onClick={() => void onAction(selected.action!, selected)}>
                <span>Open existing action</span><strong>{selected.action.label}</strong>
              </button>
            ) : <p className={styles.readonly}>{model.status === "readonly" ? "Server-only action · Static map focus remains local and read-only." : selected.nextAction}</p>}
          </article>
        ) : null}
        <footer>{model.boundary}</footer>
      </div>
    </section>
  );
});
