precision highp float;

uniform vec2 iResolution;
uniform vec2 mousePos;
uniform vec3 cameraPos;
uniform vec3 cameraDir;
uniform float stepCompletion;
const float row_size = 256.0;
const float col_size = 256.0;
const float bevel = 0.8;
const vec3 box = vec3(4., 0.5, 4.);
const float CELL_WIDTH = 10.0;
const float MAX_TRACE_DISTANCE = 10000.; // max trace distance
const float INTERSECTION_PRECISION = .001; // precision of the intersection
const int NUM_OF_TRACE_STEPS = 200;
const float FUDGE_FACTOR = .65; // Default is 1, reduce to fix overshoots
uniform sampler2D tex;
uniform bool pickPass;
uniform vec2 hoverCell;
bool cellDying = false;
bool cellBorn = false;
vec2 cellIndex;
vec4 cellData;

const vec3 BACKGROUND_COLOR = vec3(0., 0., 0.);

struct Model {
  float dist;
  vec3 albedo;
  float glow;
  float id;
};

struct CastRay {
  vec3 origin;
  vec3 direction;
};

struct Ray {
  vec3 origin;
  vec3 direction;
  float len;
};

struct Hit {
  Ray ray;
  Model model;
  vec3 pos;
  bool isBackground;
  vec3 normal;
  vec3 color;
};

vec2 hash( vec2 p )
{
  p = vec2( dot(p,vec2(127.1,311.7)),
        dot(p,vec2(269.5,183.3)) );

  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

//Simplex noise from https://www.shadertoy.com/view/Msf3WH
float noise( in vec2 p )
{
  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
  const float K2 = 0.211324865; // (3-sqrt(3))/6;

  vec2 i = floor( p + (p.x+p.y)*K1 );
  
  vec2 a = p - i + (i.x+i.y)*K2;
  vec2 o = step(a.yx,a.xy);    
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0*K2;

  vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );

  vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));

  return dot( n, vec3(70.0) );
}

// --------------------------------------------------------
// LIGHTING
// Adapted from tdhooper https://www.shadertoy.com/view/llVXRd
// who Adapted from IQ https://www.shadertoy.com/view/Xds3zN
// --------------------------------------------------------
vec3 doLighting(Model model, vec3 pos, vec3 nor, vec3 ref, vec3 rd) {
  vec3 lightPos = normalize(vec3(0, 10, 5));
  
  vec3  lig = lightPos;
  float dif = clamp( dot( nor, lig ), 0.0, 1.0 );
  float fre = pow( clamp(1.0+dot(nor,rd),0.0,1.0), 2.0 );
  
  vec3 lin = vec3(0.0);

  if (cellBorn) {
    float redAndBlue = stepCompletion*.9;
    float fadeIn = smoothstep(0.0, 0.2, stepCompletion);
    float green = 1.1*fadeIn;

    if (model.id == 0.) {
      green = 3.*fadeIn;
    }

    lin += 1.40 * dif * vec3(redAndBlue, green, redAndBlue);
  } else {
    lin += 1.60 * dif * vec3(.9);
  }

  lin += 0.20 * fre * vec3(1.);
  
  vec3 albedo = model.albedo;
  vec3 col = mix(albedo * lin, albedo, model.glow);    

  return col;
}

//From http://mercury.sexy/hg_sdf/
//Repeat only a few times: from indices <start> to <stop> (similar to above, but more flexible)
float pModInterval1(inout float p, float size, float start, float stop) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p+halfsize, size) - halfsize;
  if (c > stop) { //yes, this might not be the best thing numerically.
    p += size*(c - stop);
    c = stop;
  }
  if (c < start) {
    p += size*(c - start);
    c = start;
  }
  return c;
}

//From http://mercury.sexy/hg_sdf/
//Repeat in two dimensions
vec2 pMod2(inout vec2 p, vec2 size) {
  vec2 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}

//Adapted from http://mercury.sexy/hg_sdf/
Model roundBox( vec3 p, vec3 dimensions, float radius )
{
  vec2 index = pMod2(p.xz, vec2(CELL_WIDTH, CELL_WIDTH));

  float r = 0.4;
  float g = 0.4;
  float b = 0.5;

  cellIndex = vec2(index.x, index.y);

  index.x /= row_size;
  index.y /= col_size;

  //In order to center the grid in our viewport
  index -= 0.5;

  cellData = texture2D(tex, index);

  cellDying = cellData.z == 1. && cellData.x == 0.;
  cellBorn = cellData.z == 1. && cellData.x == 1.;

  float scaleFactor = cellData.y;

  //cellData.z will be a zero if it has been more than one turn since the
  //cell's life/death state changed. cellData.x holds a one when the cell
  //is alive, a zero when dead. Using it as the scaleFactor ensures that
  //the cell will be at full or zero size when an animation finishes.
  if (cellData.z == 0.) {
    scaleFactor = cellData.x;
  }

  //Animate scale for birth and death
  dimensions.xyz *= scaleFactor;
  radius *= scaleFactor;

  float d = length(max(abs(p)-dimensions,0.0))-radius;

  vec3 albedo = vec3(r, g, b);

  if (cellBorn) {
    float colorScale = smoothstep(.05, .9, scaleFactor);
    albedo = vec3(r*(colorScale), g, b*(colorScale));
  } else if (cellDying) {
    float colorScale = smoothstep(.2, .65, scaleFactor);
    albedo = vec3(r*colorScale, g*colorScale, b*colorScale);
  }

  return Model(d, albedo, .01, 1.);
}

// From http://mercury.sexy/hg_sdf/
// Plane with normal n (n is normalized) at some distance from the origin
float fPlane(vec3 p, vec3 n, float distanceFromOrigin) {
  return dot(p, n) + distanceFromOrigin;
}

Model map(vec3 rayVec) {
  Model boxModel = roundBox(rayVec, box, bevel);
  Model planeModel = Model(fPlane(rayVec, vec3(0.0, 1.0, 0.0), 0.8), vec3(0.4, 0.5, 0.6), 0.12, 0.);

  if (planeModel.dist < boxModel.dist) {
    return planeModel;
  } else {
    return boxModel;
  }
}

//There is something weird going on here: this should be a general purpose function
//based on 'map' instead of 'roundBox'—but I accidentally built a lot of the app with
//it functioning this way and have ended up getting better lighting effects on the floor
//with this than by accurately calculating normals for everything.
vec3 calcNormal( in vec3 pos ){
  vec3 eps = vec3( 0.001, 0.0, 0.0 );
  vec3 nor = vec3(
      roundBox(pos+eps.xyy, box, bevel).dist - roundBox(pos-eps.xyy, box, bevel).dist,
      roundBox(pos+eps.yxy, box, bevel).dist - roundBox(pos-eps.yxy, box, bevel).dist,
      roundBox(pos+eps.yyx, box, bevel).dist - roundBox(pos-eps.yyx, box, bevel).dist );
  return normalize(nor);
}
    
// --------------------------------------------------------
// Ray Marching
// Adapted from tdhooper https://www.shadertoy.com/view/llVXRd
// Who adapted from cabbibo https://www.shadertoy.com/view/Xl2XWt
// --------------------------------------------------------
Hit raymarch(CastRay castRay){

  float currentDist = INTERSECTION_PRECISION * 2.0;
  Model model;

  // camera and ray
  vec3 cPos  = cameraPos;
  vec3 cDir  = cameraDir;
  vec3 cSide = normalize( cross( cDir, vec3( 0.0, 1.0 ,0.0 ) ) );
  vec3 cUp   = normalize( cross( cSide, cDir ) );
  float targetDepth = 1.6;
  
  Ray ray = Ray(castRay.origin, castRay.direction, 0.);

  for( int i=0; i< NUM_OF_TRACE_STEPS ; i++ ){
    if (currentDist < INTERSECTION_PRECISION || ray.len > MAX_TRACE_DISTANCE) {
        break;
    }

    vec3 rayVec = ray.origin + ray.direction * ray.len;
    model = map(rayVec);
    currentDist = model.dist;
    ray.len += currentDist * FUDGE_FACTOR;
  }
  
  bool isBackground = false;
  vec3 pos = vec3(0);
  vec3 normal = vec3(0);
  vec3 color = vec3(0);
  
  if (ray.len > MAX_TRACE_DISTANCE) {
    isBackground = true;
  } else {
    pos = ray.origin + ray.direction * ray.len;
    normal = calcNormal(pos);
  }

  return Hit(ray, model, pos, isBackground, normal, color);
}

vec3 drawGrid(Hit hit) {
  vec3 pos = hit.pos;
  vec3 bluish = vec3(0.05, 0.09, 0.18);
  vec3 black = vec3(0.0, 0.0, 0.0);

  float modx = abs(pos.x);
  modx += 0.1 * CELL_WIDTH;
  pModInterval1(modx, CELL_WIDTH, 0.0, 50000.0);

  float cellx = modx / CELL_WIDTH + 0.5;
  float howBlack = smoothstep(0., 0.05, cellx);
  howBlack += smoothstep(0.1, 0.15, cellx);

  float modz = abs(pos.z);
  modz += 0.1 * CELL_WIDTH;
  pModInterval1(modz, CELL_WIDTH, 0.0, 50000.0);

  float cellz = (modz / CELL_WIDTH + 0.5);
  float alreadyBlack = 1. - howBlack;
  howBlack += smoothstep(0., 0.05, cellz)*alreadyBlack;
  howBlack += smoothstep(0.1, 0.15, cellz)*alreadyBlack;

  //Because of aliasing effects, don't draw the grid outside a 
  //certain distance.
  float distanceFade = 1. - smoothstep(0., 800., hit.ray.len);
  howBlack *= distanceFade;

  vec3 color = bluish*(1.-howBlack) + black*(howBlack);
  return color;
}

void shadeSurface(inout Hit hit){
    
  vec3 color = BACKGROUND_COLOR;
  
  if (hit.isBackground) {
    hit.color = color;
    return;
  }

  vec3 ref = reflect(hit.ray.direction, hit.normal);

  if (hit.model.id == 0.) { //It's the floor
    hit.model.albedo = drawGrid(hit);
  }

  #ifdef DEBUG
    color = hit.normal * 0.5 + 0.5;
  #else 
    color = doLighting(
      hit.model,
      hit.pos,
      hit.normal,
      ref,
      hit.ray.direction
    );
  #endif

  //The cell which the cursor is hovering over should be tinted
  //during edit mode
  if (cellIndex.x == hoverCell.x && cellIndex.y == hoverCell.y) {
    if (cellData.x == 1.) {
      color.x += 0.5;
    } else {
      color.z += 0.5;
      color.y += 0.25;
    }
  }

  if (hit.model.id == 0.) { //It's the floor

    //Fade between using lighting calculations, and just using
    //a solid color (in order to avoid aliasing from lighting
    //contribution ending abruptly at tile boundaries.)
    float ratio = smoothstep(10., 900., hit.ray.len);
    float noise = (noise(hit.pos.xz/1.5))*2.;
    hit.color = (1.-ratio)*color*noise + ratio*(hit.model.albedo/15.);
    return;
  }

  hit.color = color;
}

vec3 render(Hit hit){
  shadeSurface(hit);
  return hit.color;
}

// --------------------------------------------------------
// Gamma
// https://www.shadertoy.com/view/Xds3zN
// --------------------------------------------------------

const float GAMMA = 2.2;

vec3 gamma(vec3 color, float g) {
  return pow(color, vec3(g));
}

vec3 linearToScreen(vec3 linearRGB) {
  return gamma(linearRGB, 1.0 / GAMMA);
}

void main()
{
  vec2 coord = gl_FragCoord.xy;

  if (pickPass) {
    coord = mousePos;
  }

  vec2 p = (-iResolution.xy + 2.0*coord)/iResolution.y;
  
  // create view ray
  vec3 rd = normalize( vec3(p.xy,2.0) ); // 2.0 is the lens length

  // camera and ray
  vec3 cPos  = cameraPos;
  vec3 cDir  = cameraDir;
  vec3 cSide = normalize( cross( cDir, vec3( 0.0, 1.0 ,0.0 ) ) );
  vec3 cUp   = normalize( cross( cSide, cDir ) );
  float targetDepth = 1.6;
  rd = normalize( cSide * p.x + cUp * p.y + cDir * targetDepth );
  
  Hit hit = raymarch(CastRay(cPos, rd));

  vec3 color = render(hit);
  color = linearToScreen(color);

  if (pickPass) {
    gl_FragColor = vec4(cellIndex, 0., 0.);
  } else {
    gl_FragColor = vec4(color, 1.0);
  }
}