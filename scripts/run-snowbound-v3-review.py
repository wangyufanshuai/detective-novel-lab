"""Sequential native gates after composition and multi-camera rendering."""
from pathlib import Path
import json, runpy

ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v3'
runpy.run_path(str(ROOT/'scripts/review-snowbound-manor-v3.py'),run_name='__main__')
function=json.loads((P/'function-review.json').read_text(encoding='utf-8'))
assert function['passedAutomatedSubset'] and not function['failures']
runpy.run_path(str(ROOT/'scripts/review-manor-contacts-v3.py'),run_name='__main__')
contact=json.loads((P/'contact-review.json').read_text(encoding='utf-8'))
assert contact['passed'],'Inspect the recorded contact failures before export'
(P/'plans').mkdir(exist_ok=True)
runpy.run_path(str(ROOT/'scripts/render-snowbound-review-plans-v3.py'),run_name='__main__')
print('NATIVE FUNCTION AND CONTACT SUBSETS CHECKED; HUMAN ART REVIEW REMAINS OPEN',flush=True)
