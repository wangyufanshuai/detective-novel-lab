// Extend Three's existing LTC polygon integral to a 24-sided circular emitter.
// Keep the installed renderer's BRDF tables, Fresnel and horizon approximation.
export function diskLightShader(THREE,{metalOnly=false}={}) {
  const source=THREE.ShaderChunk.lights_physical_pars_fragment;
  const start=source.indexOf('vec3 LTC_Evaluate('),end=source.indexOf('#if defined( USE_SHEEN )',start);
  if(start<0||end<0)throw new Error('Installed Three LTC layout is incompatible');
  const disk=`vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[4] ) {
    vec3 U=(rectCoords[1]-rectCoords[0])*.5;
    vec3 W=(rectCoords[3]-rectCoords[0])*.5;
    vec3 center=(rectCoords[0]+rectCoords[2])*.5;
    if(dot(cross(U,W),P-center)<0.0)return vec3(0.0);
    vec3 tangent=V-N*dot(V,N);
    if(dot(tangent,tangent)<1e-10)tangent=cross(N,abs(N.y)<.99?vec3(0,1,0):vec3(1,0,0));
    vec3 T1=normalize(tangent),T2=-cross(N,T1);
    mat3 basis=mInv*transpose(mat3(T1,T2,N));
    vec3 initial=normalize(basis*(center+U-P));
    vec3 previous=initial,form=vec3(0);
    for(int i=1;i<24;i++){
      float angle=float(i)*(2.0*PI/24.0);
      vec3 nextPoint=normalize(basis*(center+cos(angle)*U+sin(angle)*W-P));
      form+=LTC_EdgeVectorFormFactor(previous,nextPoint);previous=nextPoint;
    }
    form+=LTC_EdgeVectorFormFactor(previous,initial);
    return vec3(LTC_ClippedSphereFormFactor(form));
  }
  `;
  let result=source.slice(0,start)+disk+source.slice(end);
  if(metalOnly){
    const position=result.indexOf('void RE_Direct_RectArea_Physical('),brace=result.indexOf('{',position);
    if(position<0||brace<0)throw new Error('Installed Three area function is incompatible');
    // The room's diffuse term is already baked, and its non-metal direct
    // specular path is deliberately disabled until occlusion is resolved.
    result=result.slice(0,brace+1)+'\nif(material.metalness <= 0.0001) return;\n'+result.slice(brace+1);
  }
  return result;
}
