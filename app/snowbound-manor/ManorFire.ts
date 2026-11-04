import * as THREE from "three";

export type FireField = {
  url: string; sha256: string; size: [number, number, number];
  position: [number, number, number]; dimensions: [number, number, number];
  emissionMultiplier: number; temperature: [number, number];
};

/** Raymarch the same original density samples used by the Blender volume. */
export function createManorFire(field: FireField, bytes: ArrayBuffer, high: boolean) {
  const [w,h,d] = field.size;
  if (bytes.byteLength !== w*h*d) throw new Error("炉火资源尺寸不一致。");
  const texture = new THREE.Data3DTexture(new Uint8Array(bytes), w,h,d);
  texture.format=THREE.RedFormat; texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter; texture.unpackAlignment=1; texture.needsUpdate=true;
  const material=new THREE.ShaderMaterial({
    glslVersion:THREE.GLSL3, side:THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ density:{value:texture}, eye:{value:new THREE.Vector3()}, dimensions:{value:new THREE.Vector3(...field.dimensions)},
      size:{value:new THREE.Vector3(w,h,d)}, time:{value:0}, power:{value:field.emissionMultiplier}, temperature:{value:new THREE.Vector2(...field.temperature)} },
    vertexShader:`out vec3 localPoint;
      void main(){localPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`precision highp sampler3D;
      uniform sampler3D density; uniform vec3 eye,dimensions,size; uniform float time,power; uniform vec2 temperature;
      in vec3 localPoint; out vec4 finalColor;
      vec3 kelvin(float k){
        float t=k/100.0;
        vec3 srgb=clamp(vec3(1.0,(99.4708*log(t)-161.1196)/255.0,t<=19.0?0.0:(138.5177*log(t-10.0)-305.0448)/255.0),0.0,1.0);
        return mix(srgb/12.92,pow((srgb+.055)/1.055,vec3(2.4)),step(vec3(.04045),srgb));
      }
      void main(){
        vec3 rd=normalize(localPoint-eye),inv=1.0/rd;
        vec3 ta=(-.5-eye)*inv,tb=(.5-eye)*inv;
        vec3 lo=min(ta,tb),hi=max(ta,tb);
        float a=max(max(lo.x,lo.y),max(lo.z,0.0)),b=min(min(hi.x,hi.y),hi.z);
        if(b<=a)discard;
        const int STEPS=${high?56:36};float delta=(b-a)/float(STEPS);
        float physicalStep=length(rd*vec3(dimensions.x,dimensions.z,dimensions.y))*delta;
        vec3 glow=vec3(0.0);
        for(int i=0;i<STEPS;i++){
          vec3 p=eye+rd*(a+(float(i)+.5)*delta);
          vec3 uv=vec3(p.x+.5,.5-p.z,p.y+.5);
          // A small wind displacement animates the authored field, without moving its base.
          uv.x+=sin(time*1.9+uv.z*11.0)*.010*uv.z;
          float heat=texture(density,(clamp(uv,0.0,1.0)*(size-1.0)+.5)/size).r;
          glow+=kelvin(temperature.x+temperature.y*pow(heat,.55))*heat*power*physicalStep;
        }
        finalColor=vec4(glow,1.0);
      }`,
  });
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  mesh.name="authored_hearth_volume";
  mesh.position.set(field.position[0],field.position[2],-field.position[1]);
  mesh.scale.set(field.dimensions[0],field.dimensions[2],field.dimensions[1]);mesh.renderOrder=5;
  mesh.updateMatrixWorld(true);
  const inverse=mesh.matrixWorld.clone().invert();let elapsed=0;
  return {mesh, texture, update(camera:THREE.Camera,dt:number,animated:boolean){
    if(animated)elapsed+=dt;
    material.uniforms.time.value=elapsed;
    material.uniforms.eye.value.copy(camera.position).applyMatrix4(inverse);
  }};
}
