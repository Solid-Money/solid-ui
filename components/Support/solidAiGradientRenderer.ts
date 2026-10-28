/**
 * Figma 28608:6231 / Moving gradient, matte material and height color mode.
 * The cube-sphere vertex deformation, Perlin field, domain motion and Oklab
 * interpolation below are a WebGL translation of the supplied WGSL shader.
 * Every avatar uses this field at its own resolution and shares one phase origin.
 */
const gradientEpoch = Date.now();

export const solidAiGradientHtml = (still: boolean, size: number) => `<!doctype html>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0a160c}canvas{display:block;width:100%;height:100%}</style>
<canvas aria-hidden="true"></canvas><script>
(function(){
const common = \`
precision highp float;
uniform float time;
vec3 hash33(vec3 p) {
  vec3 q=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(q)*43758.5453)*2.0-1.0;
}
vec3 smootherCurve(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float gradDot(vec3 cell,vec3 offset,vec3 local){return dot(hash33(cell+offset),local-offset);}
float perlin3(vec3 p){
  vec3 cell=floor(p), local=fract(p), w=smootherCurve(local);
  float n000=gradDot(cell,vec3(0,0,0),local), n100=gradDot(cell,vec3(1,0,0),local);
  float n010=gradDot(cell,vec3(0,1,0),local), n110=gradDot(cell,vec3(1,1,0),local);
  float n001=gradDot(cell,vec3(0,0,1),local), n101=gradDot(cell,vec3(1,0,1),local);
  float n011=gradDot(cell,vec3(0,1,1),local), n111=gradDot(cell,vec3(1,1,1),local);
  return mix(mix(mix(n000,n100,w.x),mix(n010,n110,w.x),w.y),mix(mix(n001,n101,w.x),mix(n011,n111,w.x),w.y),w.z)*1.1547;
}
vec3 rotateOctave(vec3 p){return vec3(.80*p.y+.60*p.z,-.80*p.x+.36*p.y-.48*p.z,-.60*p.x-.48*p.y+.64*p.z);}
float fbm(vec3 p){
  vec3 q=p; float total=0.0,amplitude=1.0,weight=0.0;
  for(int i=0;i<3;i++){total+=perlin3(q)*amplitude;weight+=amplitude;q=rotateOctave(q)*2.02+vec3(3.7,1.9,6.3);amplitude*=.48;}
  return total/max(weight,.0001);
}
vec3 warpVector(vec3 p){return vec3(perlin3(p),perlin3(p+vec3(5.2,1.3,2.8)),perlin3(p+vec3(1.7,9.2,4.4)));}
float wrapPhase(float p){return p-floor(p/6.28318530718)*6.28318530718;}
vec3 curvedDomainMotion(float t,vec3 rates,vec3 phases){return vec3(sin(wrapPhase(t*rates.x+phases.x)),sin(wrapPhase(t*rates.y+phases.y)),cos(wrapPhase(t*rates.z+phases.z)));}
vec3 primaryDomainMotion(float t){return normalize(vec3(.73,-.41,.55))*t*.105+normalize(vec3(-.28,.91,.31))*t*.023+curvedDomainMotion(t,vec3(.071,.043,.029),vec3(0,1.73,4.11))*.16;}
vec3 warpDomainMotion(float t){return normalize(vec3(-.46,.38,.80))*t*.137+normalize(vec3(.84,.51,-.18))*t*.031+curvedDomainMotion(t,vec3(.089,.053,.034),vec3(2.21,5.07,.83))*.12;}
float heightField(vec3 direction){
  float frequency=mix(1.05,3.4,1.4/5.0),t=time*2.2;
  vec3 p=direction*frequency+vec3(1.7,3.1,5.3)+primaryDomainMotion(t);
  vec3 warp=warpVector(p*.55+warpDomainMotion(t)*.42+vec3(.7,-1.1,.4))*.32;
  return fbm(p+warp);
}
vec3 rotateAroundAxis(vec3 p,vec3 axis,float a){float c=cos(a),s=sin(a);return p*c+cross(axis,p)*s+axis*dot(axis,p)*(1.0-c);}
vec3 surfacePoint(vec3 direction){
  vec3 p=direction*max(1.0+heightField(direction)*.90,.72);
  vec3 axis=normalize(vec3(-.68,.54,.49));float axial=clamp(dot(direction,axis),-1.0,1.0);
  return rotateAroundAxis(p,axis,axial*(1.5-.5*axial*axial)*.04);
}
vec3 animatedOrientation(vec3 p){
  float t=time*.0225;
  p=rotateAroundAxis(p,normalize(vec3(.36,.81,.46)),wrapPhase(t*.287));
  p=rotateAroundAxis(p,normalize(vec3(-.71,.29,.64)),wrapPhase(t*.2236068));
  p=rotateAroundAxis(p,normalize(vec3(.58,-.69,.43)),wrapPhase(t*.1732051));
  float c=cos(-.24),s=sin(-.24);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);
}
\`;
const vertex=\`#version 300 es
\`+common+\`
in vec3 position;
out vec3 baseDirection;
void main(){
  baseDirection=normalize(position);
  vec3 p=animatedOrientation(surfacePoint(baseDirection))*.82+vec3(0,0,-3);
  float diagonal=sqrt(2.0), radius=.82*.72;
  float minimumZoom=diagonal*sqrt(9.0-radius*radius)/(1.73*radius)*1.12*.65;
  float zoom=minimumZoom*pow(10.0/minimumZoom,.80);
  float z=(10.0/(-9.9))*p.z+1.0/(-9.9);
  gl_Position=vec4(p.xy*1.73*zoom,2.0*z+p.z,-p.z);
}
\`;
const fragment=\`#version 300 es
\`+common+\`
in vec3 baseDirection;
out vec4 color;
vec3 srgbToLinear(vec3 c){vec3 v=max(c,vec3(0));return mix(v/12.92,pow((v+.055)/1.055,vec3(2.4)),step(vec3(.04045),v));}
vec3 linearToSrgb(vec3 c){vec3 v=max(c,vec3(0));return mix(v*12.92,1.055*pow(v,vec3(1.0/2.4))-.055,step(vec3(.0031308),v));}
vec3 linearToOklab(vec3 c){
  float l=pow(max(dot(c,vec3(.4122214708,.5363325363,.0514459929)),0.0),1.0/3.0);
  float m=pow(max(dot(c,vec3(.2119034982,.6806995451,.1073969566)),0.0),1.0/3.0);
  float s=pow(max(dot(c,vec3(.0883024619,.2817188376,.6299787005)),0.0),1.0/3.0);
  return vec3(.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s);
}
vec3 oklabToLinear(vec3 c){
  float l=c.x+.3963377774*c.y+.2158037573*c.z;
  float m=c.x-.1055613458*c.y-.0638541728*c.z;
  float s=c.x-.0894841775*c.y-1.291485548*c.z;
  l=l*l*l;m=m*m*m;s=s*s*s;
  return vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s);
}
vec3 gradientAt(float t){
  float stops[5]=float[5](0.0,.4,.72,.9,1.0);
  vec3 colors[5]=vec3[5](vec3(8,23,11)/255.0,vec3(29,90,39)/255.0,vec3(95,202,98)/255.0,vec3(148,242,127)/255.0,vec3(201,255,184)/255.0);
  int low=0;for(int i=0;i<4;i++){if(t>=stops[i])low=i;}
  int high=low+1;float a=clamp((t-stops[low])/max(stops[high]-stops[low],.0001),0.0,1.0);a=a*a*(3.0-2.0*a);
  return linearToSrgb(oklabToLinear(mix(linearToOklab(srgbToLinear(colors[low])),linearToOklab(srgbToLinear(colors[high])),a)));
}
void main(){float field=heightField(normalize(baseDirection));color=vec4(gradientAt(clamp(field*1.5+.5,0.0,1.0)),1.0);}
\`;
const canvas=document.querySelector('canvas');
// The gradient is broad and smooth; 2x is enough while the SVG spark stays native-resolution.
canvas.width=canvas.height=Math.max(1,Math.min(${size * 2},Math.round(${size}*(window.devicePixelRatio||1))));
const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});
if(!gl)return;
function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
try{
const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const faces=[{r:[0,0,-1],u:[0,1,0]},{r:[0,0,1],u:[0,1,0]},{r:[1,0,0],u:[0,0,-1]},{r:[1,0,0],u:[0,0,1]},{r:[1,0,0],u:[0,1,0]},{r:[-1,0,0],u:[0,1,0]}];
const vertices=[],indices=[],resolution=24;
for(const face of faces){
  const r=face.r,u=face.u,f=[r[1]*u[2]-r[2]*u[1],r[2]*u[0]-r[0]*u[2],r[0]*u[1]-r[1]*u[0]],base=vertices.length/3;
  for(let row=0;row<=resolution;row++)for(let col=0;col<=resolution;col++){
    const a=col/resolution*2-1,b=row/resolution*2-1;
    const x=f[0]+r[0]*a+u[0]*b,y=f[1]+r[1]*a+u[1]*b,z=f[2]+r[2]*a+u[2]*b;
    vertices.push(x*Math.sqrt(1-y*y/2-z*z/2+y*y*z*z/3),y*Math.sqrt(1-z*z/2-x*x/2+z*z*x*x/3),z*Math.sqrt(1-x*x/2-y*y/2+x*x*y*y/3));
  }
  for(let row=0;row<resolution;row++)for(let col=0;col<resolution;col++){const a=base+row*(resolution+1)+col,b=a+1,c=a+resolution+2,d=a+resolution+1;indices.push(a,b,c,a,c,d);}
}
const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,0,0);
const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.viewport(0,0,canvas.width,canvas.height);
const timeUniform=gl.getUniformLocation(program,'time');const phase=(Date.now()-${gradientEpoch})/1000;let request=0,start=performance.now(),last=-100;
function draw(now){
  if(now-last>=1000/30){gl.uniform1f(timeUniform,${still ? '0' : 'phase+(now-start)/1000'});gl.clearColor(.031,.09,.043,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);last=now;}
  ${still ? '' : 'request=requestAnimationFrame(draw);'}
}
draw(start);
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(request);if(!document.hidden)${still ? 'draw(performance.now());' : 'request=requestAnimationFrame(draw);'}});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);gl.deleteBuffer(vb);gl.deleteBuffer(ib);gl.deleteProgram(program);});
}catch(error){console.error('Solid AI gradient:',error);}
})();
</script>`;
