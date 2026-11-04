import { diskLightShader } from '/disk-light.mjs';

export function validateDiskLight(THREE,renderer,reflection,falloff) {
  const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(12,12);
  const material=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:1,roughness:0});
  let shape='DISK';
  material.onBeforeCompile=shader=>{if(shape==='DISK')shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',diskLightShader(THREE));};
  material.customProgramCacheKey=()=>shape;
  const plane=new THREE.Mesh(geometry,material);plane.rotation.x=-Math.PI/2;scene.add(plane);
  const light=new THREE.RectAreaLight(0xffffff,1,2,2);light.position.set(0,2,-2);light.lookAt(0,0,0);scene.add(light);
  const camera=new THREE.OrthographicCamera(-.02,.02,.02,-.02,.01,20);
  const target=new THREE.WebGLRenderTarget(16,16,{type:THREE.FloatType});target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  const previousTone=renderer.toneMapping;renderer.toneMapping=THREE.NoToneMapping;
  const read=point=>{
    camera.position.set(point,2,2);camera.lookAt(point,0,0);
    renderer.setRenderTarget(target);renderer.render(scene,camera);
    const pixels=new Float32Array(8*8*4);renderer.readRenderTargetPixels(target,4,4,8,8,pixels);
    let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];
    const mean=sum/(8*8*3);if(!Number.isFinite(mean)||mean<=0)throw new Error('Invalid floating-point calibration pixels');
    return mean;
  };
  const mirrors=[],diffuse=[];
  try{
    for(const entry of reflection.records){
      shape=entry.shape;material.needsUpdate=true;
      light.width=light.height=entry.sizeMeters;light.intensity=entry.powerWatts/entry.areaMeters2*reflection.normalizedAreaRadianceFactor;
      const measured=read(0),relativeError=Math.abs(measured/entry.mirrorRadiance-1);
      mirrors.push({shape,powerWatts:entry.powerWatts,sizeMeters:entry.sizeMeters,expectedRadiance:entry.mirrorRadiance,actualRadiance:measured,relativeError,passed:relativeError<.06});
    }
    shape='DISK';material.metalness=0;material.roughness=1;material.specularIntensity=0;material.needsUpdate=true;
    light.width=light.height=falloff.source.diameterMeters;
    light.intensity=falloff.source.powerWatts/(Math.PI*(light.width/2)**2)*reflection.normalizedAreaRadianceFactor;
    for(const entry of falloff.records){
      const measured=read(entry.receiverBlender[0]),relativeError=Math.abs(measured/entry.meanRadiance-1);
      diffuse.push({receiverBlender:entry.receiverBlender,expectedRadiance:entry.meanRadiance,actualRadiance:measured,relativeError,passed:relativeError<.06});
    }
  }finally{
    renderer.setRenderTarget(null);renderer.toneMapping=previousTone;
    geometry.dispose();material.dispose();target.dispose();
  }
  return {scope:'independent white mirror amplitude and diffuse receivers at x=0,3,5 m; actual float GPU pixels versus Cycles',
          diskPolygonSides:24,relativeTolerance:.06,mirrors,diffuse,passed:mirrors.every(s=>s.passed)&&diffuse.every(s=>s.passed)};
}
