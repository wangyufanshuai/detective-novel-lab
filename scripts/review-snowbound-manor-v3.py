"""Reuse the source geometry/navigation audit against the separate v3 candidate."""
from pathlib import Path
import importlib.util, json

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/snowbound-manor-v3'
receipt=json.loads((P/'renders/render-receipt.json').read_text(encoding='utf-8'))
required={'hall','manor-gate','corner-sw','corner-se','corner-ne','corner-nw','low-entry',
          'ceiling-up','ceiling-oblique-a','ceiling-oblique-b','library-detail','tea-detail','desk-detail'}
assert required<={r['camera'] for r in receipt['renders']},'Finish the native multi-angle review renders first'
spec=importlib.util.spec_from_file_location('manor_function_v3',ROOT/'scripts/review-snowbound-manor.py')
review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review);review.P=P;review.main()
