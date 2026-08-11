import { memo, useRef, type KeyboardEvent, type RefObject } from "react";
import { Building2, Gauge, MapPinned, Search } from "lucide-react";
import type {
  DistrictStrategicFront,
  DistrictStrategicFrontKind,
  DistrictStrategicFrontsViewModel
} from "@/app/campaign/district-strategic-front-model";
import type { StrategicCommandAction } from "@/app/campaign/strategic-command-model";
import { useAppLocale } from "@/app/localization/locale-context";
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
  const { number, t, text } = useAppLocale();
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
        <span><small>{t("district.fronts")}</small><strong>{selected ? text(selected.districtLabel) : t("district.townwide")}</strong></span>
        <b>{number(model.fronts.length)} / {text(selected?.state || model.status)}</b>
      </button>
      <div id="district-strategic-front-panel" className={styles.panel} data-testid="district-fronts-panel" aria-hidden={!panelOpen}>
        <header>
          <span>{t("district.operations")}</span>
          <strong>{selected ? text(selected.label) : t("district.front")}</strong>
          <small>{t("district.detail")}</small>
        </header>
        <div className={styles.options} role="group" aria-label={t("district.aria")}>
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
                <span><b>{text(front.label)}</b><small>{text(front.districtLabel)}</small></span>
                <em>{text(front.state)}</em>
              </button>
            );
          })}
        </div>
        {selected ? (
          <article className={styles.detail} data-testid="district-front-detail" data-front-kind={selected.key} data-front-tone={selected.tone} data-front-location={selected.districtLabel}>
            <div className={styles.detailHeading}><span>{text(selected.districtLabel)}</span><b>{text(selected.summary)}</b></div>
            <dl>
              <div><dt>{t("district.whyNow")}</dt><dd>{text(selected.whyNow)}</dd></div>
              <div><dt>{t("district.benefit")}</dt><dd>{text(selected.benefitLabel)}</dd></div>
              <div><dt>{t("district.costBoundary")}</dt><dd>{text(selected.costLabel)}</dd></div>
            </dl>
            {selected.action && onAction ? (
              <button type="button" className={styles.action} data-testid="district-front-action" onClick={() => void onAction(selected.action!, selected)}>
                <span>{t("district.openAction")}</span><strong>{text(selected.action.label)}</strong>
              </button>
            ) : <p className={styles.readonly}>{model.status === "readonly" ? t("district.readonly") : text(selected.nextAction)}</p>}
          </article>
        ) : null}
        <footer>{text(model.boundary)}</footer>
      </div>
    </section>
  );
});
