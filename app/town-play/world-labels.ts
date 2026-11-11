import * as THREE from "three";
import type { TownDestination } from "@/lib/riverbend-navigation";

export type TownPlaceTag = { id: string; label: string; visited: boolean; leads: number; marked: boolean };
type ClassNames = { layer: string; place: string; person: string };
type PersonTag = { actorId: string; name: string; role: string; position: THREE.Vector3; active: boolean; distance: number };

/**
 * Screen-space name plates for the 3D town. Plain DOM over the canvas, so text
 * stays crisp and readable by assistive tech; positions are written per frame
 * without React renders. Place signs are buttons (overview only), person
 * plates are decoration (the interaction prompt already names the person).
 */
export function createWorldLabels(container: HTMLElement, destinations: TownDestination[], classes: ClassNames, onPick: (id: string) => void) {
  const layer = document.createElement("div");
  layer.className = classes.layer;
  container.appendChild(layer);
  const point = new THREE.Vector3();
  const places = destinations.map(place => {
    const el = document.createElement("button");
    el.type = "button"; el.className = classes.place; el.hidden = true;
    el.addEventListener("click", () => onPick(place.id));
    layer.appendChild(el);
    return { place, el, key: "", x: NaN, y: NaN };
  });
  const people = new Map<string, { el: HTMLDivElement; key: string; x: number; y: number }>();

  const place = (el: HTMLElement, state: { x: number; y: number }, camera: THREE.Camera, at: THREE.Vector3) => {
    point.copy(at).project(camera);
    const x = Math.round((point.x + 1) * container.clientWidth / 2), y = Math.round((1 - point.y) * container.clientHeight / 2);
    const off = point.z > 1 || x < -80 || y < -40 || x > container.clientWidth + 80 || y > container.clientHeight + 40;
    el.hidden = off;
    if (!off && (x !== state.x || y !== state.y)) { el.style.transform = `translate(${x}px, ${y}px)`; state.x = x; state.y = y; }
    return !off;
  };

  return {
    update(camera: THREE.Camera, groundHeight: (p: [number, number]) => number, view: { overview: boolean; talking: boolean; tags: TownPlaceTag[]; persons: PersonTag[] }) {
      layer.dataset.view = view.overview ? "overview" : "street";
      for (const entry of places) {
        const tag = view.tags.find(t => t.id === entry.place.id);
        if (!view.overview || !tag) { entry.el.hidden = true; continue; }
        const key = `${tag.label}|${tag.visited}|${tag.leads}|${tag.marked}`;
        if (key !== entry.key) {
          entry.key = key;
          entry.el.dataset.visited = String(tag.visited); entry.el.dataset.marked = String(tag.marked);
          entry.el.setAttribute("aria-label", `标记${tag.label}${tag.visited ? "，已探访" : ""}${tag.leads ? `，${tag.leads} 处待核对` : ""}`);
          entry.el.innerHTML = "";
          const name = document.createElement("span"); name.textContent = tag.label.replace(/^河湾/, ""); entry.el.appendChild(name);
          if (tag.visited) { const done = document.createElement("i"); done.textContent = "✓"; done.dataset.kind = "done"; entry.el.appendChild(done); }
          if (tag.leads) { const lead = document.createElement("b"); lead.textContent = String(tag.leads); entry.el.appendChild(lead); }
        }
        const [x, z] = entry.place.entrance;
        place(entry.el, entry, camera, point.set(x, groundHeight(entry.place.entrance) + 5.2, -z));
      }
      const seen = new Set<string>(), placed: Array<[number, number]> = [];
      // Nearest first; a plate that would overlap a nearer one is dropped.
      const persons = view.overview || view.talking ? [] : [...view.persons].sort((a, b) => Number(b.active) - Number(a.active) || a.distance - b.distance);
      for (const person of persons) {
        seen.add(person.actorId);
        let entry = people.get(person.actorId);
        if (!entry) { const el = document.createElement("div"); el.className = classes.person; el.setAttribute("aria-hidden", "true"); layer.appendChild(el); entry = { el, key: "", x: NaN, y: NaN }; people.set(person.actorId, entry); }
        const key = `${person.name}|${person.role}|${person.active}`;
        if (key !== entry.key) {
          entry.key = key; entry.el.dataset.active = String(person.active);
          entry.el.innerHTML = "";
          const name = document.createElement("strong"); name.textContent = person.name; entry.el.appendChild(name);
          const role = document.createElement("small"); role.textContent = person.role; entry.el.appendChild(role);
        }
        if (!place(entry.el, entry, camera, point.copy(person.position).setY(person.position.y + 2.2))) continue;
        if (placed.some(([x, y]) => Math.abs(x - entry!.x) < 84 && Math.abs(y - entry!.y) < 34)) { entry.el.hidden = true; continue; }
        placed.push([entry.x, entry.y]);
      }
      for (const [id, entry] of people) if (!seen.has(id)) entry.el.hidden = true;
    },
    dispose() { layer.remove(); }
  };
}
