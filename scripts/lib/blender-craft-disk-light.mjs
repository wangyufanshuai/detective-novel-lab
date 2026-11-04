import { diskLightShader as baseDiskLightShader } from './blender-optics-disk-light.mjs';

// The same 24-edge LTC integral, with emitter points and their common linear
// transform factored out. No per-fragment trigonometry or change of light area.
export function diskLightShader(THREE,options){
  const source=baseDiskLightShader(THREE,options);
  const start=source.indexOf('    vec3 initial=normalize(basis*(center+U-P));');
  const end=source.indexOf('    form+=LTC_EdgeVectorFormFactor(previous,initial);',start);
  if(start<0||end<0)throw new Error('Disk source layout changed');
  const coefficient=value=>Math.abs(value)<1e-12?'0.0':value.toFixed(12);
  const edges=Array.from({length:23},(_,index)=>{
    const angle=(index+1)*2*Math.PI/24;
    return `    {vec3 nextPoint=normalize(diskCenter+${coefficient(Math.cos(angle))}*diskU+${coefficient(Math.sin(angle))}*diskW);
     form+=LTC_EdgeVectorFormFactor(previous,nextPoint);previous=nextPoint;}`;
  }).join('\n');
  return source.slice(0,start)+`    vec3 diskCenter=basis*(center-P),diskU=basis*U,diskW=basis*W;
    vec3 initial=normalize(diskCenter+diskU),previous=initial,form=vec3(0);
${edges}
`+source.slice(end);
}
