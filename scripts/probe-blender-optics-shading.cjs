async(page)=>{
  await page.reload();await page.waitForFunction(()=>window.roomReview?.ready===true);
  await page.setViewportSize({width:1600,height:1070});
  const report=await page.evaluate(()=>{
    const {THREE,loaded,materials}=window.roomReview.diagnostic;const mat=materials.find(m=>m.name==='Room Baked PBR');
    const canvas=document.createElement('canvas');canvas.width=mat.metalnessMap.image.width;canvas.height=mat.metalnessMap.image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(mat.metalnessMap.image,0,0);
    const records=[];
    for(const [x,y,z] of [[0,-2,.4],[2,-2,.4],[3,1,.4],[.65,.38,1.3],[-.75,.35,1.3]]){
      const hit=new THREE.Raycaster(new THREE.Vector3(x,z,-y),new THREE.Vector3(0,-1,0),0,1).intersectObject(loaded,true)[0];if(!hit?.uv)continue;
      const uv=hit.uv.clone();mat.metalnessMap.transformUv(uv);
      records.push({point:hit.point.toArray(),object:hit.object.name,uv:uv.toArray(),orm:[...ctx.getImageData(Math.floor(uv.x*canvas.width),Math.floor(uv.y*canvas.height),1,1).data]});
    }
    const previous=mat.onBeforeCompile;
    mat.onBeforeCompile=shader=>{previous(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular=vec3(0);reflectedLight.indirectSpecular=vec3(0);');};
    mat.customProgramCacheKey=()=>'optics-diagnostic-no-specular';mat.needsUpdate=true;
    return {records,roughness:mat.roughness,metalness:mat.metalness};
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('canvas').screenshot({path:'outputs/blender-v7-no-specular.png'});
  return report;
}
