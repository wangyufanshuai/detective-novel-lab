// Read-only v5 source/asset diagnosis; generated files are confined to outputs.
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
let html=await fs.readFile(path.join(root,'scripts/lib/blender-lighting-pass-viewer.html'),'utf8');
const anchor='  state.materials=[...loadedMaterials]';
if(!html.includes(anchor))throw new Error('Diagnostic injection anchor changed');
const debug=`
  state.diagnostic={scene,camera,renderer,materials:[...loadedMaterials],lightMap,THREE,draw,loaded:gltf.scene};
  for(const mat of loadedMaterials)mat.userData.diagnosticOriginal={normalMap:mat.normalMap,metalnessMap:mat.metalnessMap,roughnessMap:mat.roughnessMap,metalness:mat.metalness,roughness:mat.roughness,onBeforeCompile:mat.onBeforeCompile,customProgramCacheKey:mat.customProgramCacheKey};
  state.diagnostic.mode=async mode=>{
    gltf.scene.traverse(obj=>{if(obj.isMesh&&obj.userData.originalDiagnosticMaterial)obj.material=obj.userData.originalDiagnosticMaterial;});
    state.setLightingMode(mode==='dynamic'?'dynamic':'baked');
    for(const mat of loadedMaterials)if(mat.name==='Room Baked PBR'){
      Object.assign(mat,mat.userData.diagnosticOriginal);
      if(mode==='no-normal')mat.normalMap=null;
      if(mode==='no-specular'){
        const original=mat.onBeforeCompile;
        mat.onBeforeCompile=shader=>{original(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\\nreflectedLight.directSpecular=vec3(0.0); reflectedLight.indirectSpecular=vec3(0.0);');};
        mat.customProgramCacheKey=()=> 'diagnostic-no-specular';
      }
      if(mode==='raw-light'){
        const decoded=new EXRLoader().parse(await fetch('/raw-light.exr').then(r=>r.arrayBuffer()));
        const raw=lightMap.clone();raw.image={data:decoded.data,width:decoded.width,height:decoded.height};raw.needsUpdate=true;mat.lightMap=raw;
      }
      mat.needsUpdate=true;
    }
    if(mode==='albedo')gltf.scene.traverse(obj=>{if(obj.isMesh&&obj.material.name==='Room Baked PBR'){
      obj.userData.originalDiagnosticMaterial=obj.material;
      obj.material=new THREE.MeshBasicMaterial({map:obj.material.map,toneMapped:false});
    }});
    state.diagnostic.currentMode=mode;draw();
  };
`;
html=html.replace(anchor,debug+anchor);
await fs.mkdir(path.join(root,'outputs'),{recursive:true});
await fs.writeFile(path.join(root,'outputs/blender-shading-diagnostic.html'),html);
let server=await fs.readFile(path.join(root,'scripts/serve-blender-room-lighting-pass.mjs'),'utf8');
server=server.replace('scripts/lib/blender-lighting-pass-viewer.html','outputs/blender-shading-diagnostic.html');
server=server.replace("  ['/diffuse-light.exr',", "  ['/raw-light.exr',path.join(assets,'textures/diffuse-light-raw.exr')],\n  ['/diffuse-light.exr',");
await fs.writeFile(path.join(root,'outputs/serve-blender-shading-diagnostic.mjs'),server);
console.log('Diagnostic generated from unchanged v5 source and assets.');
