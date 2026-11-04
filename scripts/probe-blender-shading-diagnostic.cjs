async(page)=>{
  return page.evaluate(()=>{
    const {THREE,loaded,materials}=window.roomReview.diagnostic;
    const mat=materials.find(m=>m.name==='Room Baked PBR');
    const c=document.createElement('canvas');c.width=mat.map.image.width;c.height=mat.map.image.height;
    const ctx=c.getContext('2d');ctx.drawImage(mat.map.image,0,0);
    const out=[];
    for(const [x,y] of [[-.85,.25],[-.85,.45],[-.4,.75],[.4,.24],[.75,.73]]){
      const ray=new THREE.Raycaster(new THREE.Vector3(x,1.01,-y),new THREE.Vector3(0,-1,0),0,.1);
      const h=ray.intersectObject(loaded,true)[0];if(!h)continue;
      const uv=h.uv.clone();mat.map.transformUv(uv);
      const px=ctx.getImageData(Math.floor(uv.x*c.width),Math.floor(uv.y*c.height),1,1).data;
      out.push({xy:[x,y],object:h.object.name,point:h.point.toArray(),face:h.faceIndex,uv:h.uv.toArray(),uv1:h.uv1?.toArray(),color:[...px],normal:h.face.normal.toArray()});
    }
    return {probes:out,material:{roughness:mat.roughness,normalScale:mat.normalScale.toArray(),texture:mat.map.name,channel:mat.map.channel,flipY:mat.map.flipY}};
  });
}
