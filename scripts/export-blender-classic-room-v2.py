"""Reuse the reviewed batching/export contract for the separate v2 room asset."""
from pathlib import Path
import importlib.util
import shutil
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('base_export',ROOT/'scripts/export-blender-classic-railway.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
base.PACKAGE=ROOT/'docs/3d-town/classic-railway-v2';base.OUTPUT=ROOT/'public/assets/classic-railway/v2'
base.main()
manifest=base.read(base.OUTPUT/'manifest.json')
manifest['schema']='classic-railway-runtime.v2'
manifest['asset']['url']='/assets/classic-railway/v2/classic-railway.glb'
manifest['navigation']['url']='/assets/classic-railway/v2/navigation.json'
manifest['baseExporterSha256']=manifest['exporterSha256'];manifest['exporterSha256']=base.sha(Path(__file__))
manifest['thirdPartyAssets']=base.read(base.PACKAGE/'licensed/provenance.json')['assets']
manifest['materialProvenanceSha256']=base.sha(base.PACKAGE/'licensed/provenance.json')
for file in ('CREDITS.md','font-OFL.txt'):shutil.copy2(base.PACKAGE/'licensed'/file,base.OUTPUT/file)
manifest['licenseDocuments']=['/assets/classic-railway/v2/CREDITS.md','/assets/classic-railway/v2/font-OFL.txt']
for path in (base.OUTPUT/'manifest.json',base.PACKAGE/'runtime-export.json'):base.write(path,manifest)
