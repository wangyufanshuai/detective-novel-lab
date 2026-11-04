// Visibility uses the already transformed lighting UV, in Blender bottom-up orientation.
export function installVisibility(THREE,shader){
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D roomAreaVisibilityA;
uniform sampler2D roomAreaVisibilityB;
float roomAreaVisibility(const in int index,const in vec2 uv){
  vec3 a=texture2D(roomAreaVisibilityA,uv).rgb;
  vec3 b=texture2D(roomAreaVisibilityB,uv).rgb;
  if(index==0)return a.r;if(index==1)return a.g;if(index==2)return a.b;
  if(index==3)return b.r;return b.g;
}`);
  const anchor='rectAreaLight = rectAreaLights[ i ];';
  const chunk=THREE.ShaderChunk.lights_fragment_begin;
  if(!chunk.includes(anchor))throw new Error('Area visibility shader layout changed');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',
    chunk.replace(anchor,anchor+'\nrectAreaLight.color *= roomAreaVisibility( UNROLLED_LOOP_INDEX, vLightMapUv );'));
  const fn=shader.fragmentShader.indexOf('void RE_Direct_RectArea_Physical(');
  const brace=shader.fragmentShader.indexOf('{',fn);
  if(fn<0||brace<0)throw new Error('Area visibility early-out layout changed');
  shader.fragmentShader=shader.fragmentShader.slice(0,brace+1)+'\nif(dot(rectAreaLight.color,vec3(1.0))<0.000001)return;\n'+shader.fragmentShader.slice(brace+1);
}

export function checkVisibilityPixels(THREE,renderer,textures,references){
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
  const geometry=new THREE.PlaneGeometry(2,2);
  const material=new THREE.ShaderMaterial({uniforms:{inputMap:{value:null},sampleUV:{value:new THREE.Vector2()}},
    vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:'uniform sampler2D inputMap; uniform vec2 sampleUV; void main(){gl_FragColor=texture2D(inputMap,sampleUV);}'});
  scene.add(new THREE.Mesh(geometry,material));const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType});
  const measurements=[];
  for(const reference of references){
    const index=reference.texture,uv=reference.uv;
    material.uniforms.inputMap.value=textures[index];
      material.uniforms.sampleUV.value.set(...uv);renderer.setRenderTarget(target);renderer.render(scene,camera);
      const pixels=new Float32Array(4);renderer.readRenderTargetPixels(target,0,0,1,1,pixels);
      const rgb=Array.from(pixels.slice(0,3)),error=Math.max(...rgb.map((v,i)=>Math.abs(v-reference.expectedRGB[i])));
      measurements.push({texture:index,uv,rgb,expectedRGB:reference.expectedRGB,maximumError:error,passed:error<.005});
  }
  renderer.setRenderTarget(null);target.dispose();geometry.dispose();material.dispose();
  return measurements;
}
