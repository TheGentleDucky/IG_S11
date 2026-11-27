import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Ammo from "ammojs-typed";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as TWEEN from "@tweenjs/tween.js";

//import { Ammo } from "ammo"; //Necesario? es una prueba viendo https://codesandbox.io/p/sandbox/upbeat-darwin-p5f10?file=%2Fsrc%2Findex.js%3A4%2C1-4%2C29

let camera, controls, scene, renderer;
let textureLoader;
const clock = new THREE.Clock();

const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const ballMaterial = new THREE.MeshPhongMaterial({ color: 0x202020 });
const SHOOT_DELAY = 800;
let lastShotTime = -SHOOT_DELAY;

// Mundo físico con Ammo
let physicsWorld;
const gravityConstant = 7.8;
let collisionConfiguration;
let dispatcher;
let broadphase;
let solver;
const margin = 0.05; //margen colisiones

// Objetos rígidos
const rigidBodies = [];
let skeletonBody;
let skeletonBones = {};
let skeletonRecoverPose = {};
const tweenGroup = new TWEEN.Group();
let idleTween;
let recoverTween;
let hitTween;
let skeletonColliding = false;
let isHitAnimating = false;
let skeletonStartY = 0;
let skeletonHasFallen = false;

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
//Variables temporales para actualizar transformación en el bucle
let transformAux1;
let tempBtVec3_1;

//Textures
const floortxt = new THREE.TextureLoader().load("src/venus.jpg");
const skytxt = new THREE.TextureLoader().load("src/metal wall.png");

//Noises
let audioListener;
let impactAudio;
const impactSoundBuffers = [];
const impactSoundPaths = [
  "src/DMG1.mp3",
  "src/DMG2.mp3",
  "src/DMG3.mp3",
  "src/buh.mp3",
  "src/duck-quack-112941.mp3",
];
let fallAudio;
let fallSoundBuffer;

let lastImpactSound = -1;

//Inicialización ammo
Ammo(Ammo).then(start);

function start() {
  //Elementos gráficos
  initGraphics();
  //Sonidos
  initAudio();
  //Elementos del mundo físico
  initPhysics();
  //Objetos
  createObjects();
  //Eventos
  initInput();

  animationLoop();
}

function initGraphics() {
  //Cámara, escena, renderer y control de cámara
  camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    0.2,
    60
  );
  scene = new THREE.Scene();
  scene.background = skytxt;
  camera.position.set(-1, 3, 9);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2, 0);
  controls.update();

  textureLoader = new THREE.TextureLoader();

  //Luces
  const ambientLight = new THREE.AmbientLight(0x707070);
  scene.add(ambientLight);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(-10, 18, 5);
  light.castShadow = true;
  const d = 14;
  light.shadow.camera.left = -d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = -d;

  light.shadow.camera.near = 2;
  light.shadow.camera.far = 50;

  light.shadow.mapSize.x = 1024;
  light.shadow.mapSize.y = 1024;

  scene.add(light);
  //Redimensión de la ventana
  window.addEventListener("resize", onWindowResize);
}

function initAudio() {
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  impactAudio = new THREE.Audio(audioListener);

  const loader = new THREE.AudioLoader();

  impactSoundPaths.forEach((path) => {
    loader.load(path, (buffer) => {
      impactSoundBuffers.push(buffer);
    });
  });
  fallAudio = new THREE.Audio(audioListener);
  loader.load("/src/conchetumare_Wv0iiaP.mp3", (buffer) => {
    fallSoundBuffer = buffer;
  });
}

function initPhysics() {
  // Configuración Ammo
  // Colisiones
  collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  // Gestor de colisiones convexas y cóncavas
  dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  // Colisión fase amplia
  broadphase = new Ammo.btDbvtBroadphase();
  // Resuelve resricciones de reglas físicas como fuerzas, gravedad, etc.
  solver = new Ammo.btSequentialImpulseConstraintSolver();
  // Crea en mundo físico
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  // Establece gravedad
  physicsWorld.setGravity(new Ammo.btVector3(0, -gravityConstant, 0));

  transformAux1 = new Ammo.btTransform();
  tempBtVec3_1 = new Ammo.btVector3(0, 0, 0);
}

//Objeto con posición y orientación especificada con cuaternión

function createObjects() {
  // Suelo
  pos.set(0, -0.5, 0);
  quat.set(0, 0, 0, 1);
  const suelo = createBoxWithPhysics(
    30,
    1,
    30,
    0,
    pos,
    quat,
    new THREE.MeshPhongMaterial({ color: 0x8b8987 }),
    floortxt
  );
  suelo.receiveShadow = true;

  // El muro ha sido brutalmente remplazado por algo más interesante
  createSkeleton();
}

function createBoxWithPhysics(
  sx,
  sy,
  sz,
  mass,
  pos,
  quat,
  material,
  texture = undefined
) {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1),
    material
  );
  if (texture != undefined) {
    material.map = texture;
  }
  //Estructura geométrica de colisión
  //Crea caja orientada en el espacio, especificando dimensiones
  const shape = new Ammo.btBoxShape(
    new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)
  );
  //Margen para colisione
  shape.setMargin(margin);

  createRigidBody(object, shape, mass, pos, quat);

  return object;
}

//Creación de cuerpo rígido, con masa, sujeto a fuerzas, colisiones...
function createRigidBody(object, physicsShape, mass, pos, quat, vel, angVel) {
  //Posición
  if (pos) {
    object.position.copy(pos);
  } else {
    pos = object.position;
  }
  //Cuaternión, es decir orientación
  if (quat) {
    object.quaternion.copy(quat);
  } else {
    quat = object.quaternion;
  }
  //Matriz de transformación
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
  const motionState = new Ammo.btDefaultMotionState(transform);
  //Inercia inicial y parámetros de rozamiento, velocidad
  const localInertia = new Ammo.btVector3(0, 0, 0);
  physicsShape.calculateLocalInertia(mass, localInertia);
  //Crea el cuerpo
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    physicsShape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  body.setFriction(0.5);

  if (vel) {
    body.setLinearVelocity(new Ammo.btVector3(vel.x, vel.y, vel.z));
  }

  if (angVel) {
    body.setAngularVelocity(new Ammo.btVector3(angVel.x, angVel.y, angVel.z));
  }

  //Enlaza primitiva gráfica con física
  object.userData.physicsBody = body;
  object.userData.collided = false;

  scene.add(object);
  //Si tiene masa
  if (mass > 0) {
    rigidBodies.push(object);
    // Disable deactivation
    body.setActivationState(4);
  }
  //Añadido al universo físico
  physicsWorld.addRigidBody(body);

  return body;
}

function createRandomColor() {
  return Math.floor(Math.random() * (1 << 24));
}

function createMaterial(color) {
  color = color || createRandomColor();
  return new THREE.MeshPhongMaterial({ color: color });
}

function createSkeleton() {
  const loader = new GLTFLoader().load(
    "src/models/Eiskeleto.glb",
    function (gltf) {
      const model = gltf.scene;

      const boundingBox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();

      boundingBox.getSize(size);
      boundingBox.getCenter(center);

      model.traverse((child) => {
        if (child.isSkinnedMesh) {
          child.skeleton.bones.forEach((bone, index) => {
            skeletonBones[bone.name] = bone;
          });
        }
      });
      // Modo Gamba
      const torso = skeletonBones["Torso"];
      const shoulderL = skeletonBones["ShoulderL"];
      const shoulderR = skeletonBones["ShoulderR"];
      const handL = skeletonBones["HandL"];
      const handR = skeletonBones["HandR"];

      torso.rotation.x += 0.12;
      shoulderL.rotation.x -= 0.08;
      shoulderR.rotation.x -= 0.08;
      handL.rotation.x += 0.04;
      handR.rotation.x += 0.04;

      // Guardamos la postura de reposo
      saveSkeletonRecoverPose();

      const bonesToDebug = [
        "Head",
        "ShoulderL",
        "ShoulderR",
        "HipL",
        "UpperLegL",
        "UpperLegR",
        "LowerLegL",
        "LowerLegR",
        "FootL",
        "FootR",
        "UpperArmL",
        "UpperArmR",
        "LowerArmL",
        "LowerArmR",
        "HandL",
        "HandR",
      ];

      for (const name of bonesToDebug) {
        const bone = skeletonBones[name];

        if (!bone) continue;

        const axes = new THREE.AxesHelper(0.4);
        axes.material.depthTest = false;
        axes.renderOrder = 1;

        //bone.add(axes);
      }

      // Centramos el modelo
      model.position.sub(center);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Grupo que representa el cuerpo físico
      const skeleton = new THREE.Group();
      skeleton.add(model);
      skeleton.position.set(0, size.y / 2, 0);
      skeletonStartY = skeleton.position.y;

      // Collider físico
      const radius = 0.4;
      const capsuleHeight = size.y - 2 * radius;

      const shape = new Ammo.btCapsuleShape(radius, capsuleHeight);
      shape.setMargin(margin);

      skeletonBody = createRigidBody(
        skeleton,
        shape,
        50,
        skeleton.position,
        new THREE.Quaternion()
      );

      // Evitamos que el esqueleto vuelque
      skeletonBody.setAngularFactor(new Ammo.btVector3(0, 1, 0));

      skeletonBody.setFriction(4);
      skeletonBody.setDamping(0.5, 0.9);
      idleAnimation();
    },
    undefined,
    function (error) {
      console.error("Error cargando el esqueleto:", error);
    }
  );
}

function saveSkeletonRecoverPose() {
  skeletonRecoverPose = {};

  for (const name in skeletonBones) {
    skeletonRecoverPose[name] = skeletonBones[name].rotation.clone();
  }
}
function idleAnimation() {
  const idleOffsets = {
    Torso: { x: -0.025 },
    Neck: { x: 0.008 },
    Head: { y: 0.25 },

    HipL: { z: 0.008 },
    HipR: { z: -0.008 },
    UpperLegL: { x: 0.008 },
    UpperLegR: { x: -0.008 },
    LowerLegL: { x: -0.006 },
    LowerLegR: { x: 0.006 },
    FootL: { x: 0.05 },
    FootR: { x: -0.05 },

    ShoulderL: { z: 0.002 },
    ShoulderR: { z: -0.002 },
    UpperArmL: { z: 0.01 },
    UpperArmR: { z: -0.01 },
    LowerArmL: { x: 0.008 },
    LowerArmR: { x: -0.008 },
    HandL: { x: 0.01 },
    HandR: { x: -0.01 },
  };

  const idle = { phase: 0 };

  idleTween = new TWEEN.Tween(idle)
    .to({ phase: Math.PI * 2 }, 4000)
    .onUpdate((coords) => {
      const movement = Math.sin(coords.phase);

      for (const name in idleOffsets) {
        const bone = skeletonBones[name];
        const initial = skeletonRecoverPose[name];
        const offset = idleOffsets[name];

        bone.rotation.set(
          initial.x + (offset.x || 0) * movement,
          initial.y + (offset.y || 0) * movement,
          initial.z + (offset.z || 0) * movement
        );
      }
    })
    .repeat(Infinity);

  tweenGroup.add(idleTween);
  idleTween.start();
}
function hitAnimation() {
  if (idleTween) idleTween.stop();
  if (hitTween) hitTween.stop();
  if (recoverTween) recoverTween.stop();

  isHitAnimating = true;

  const hitOffsets = {
    Torso: { x: -0.3 },
    Neck: { x: 0.08 },
    Head: { y: -0.85 },
    ShoulderL: { x: -0.15 },
    ShoulderR: { x: -0.15 },
    UpperArmL: { y: 0.15 },
    UpperArmR: { y: -0.15 },
    LowerArmL: { x: -0.18 },
    LowerArmR: { x: -0.18 },
    HipL: { z: 0.04 },
    HipR: { z: -0.04 },
    UpperLegL: { z: -0.2 },
    UpperLegR: { z: 0.2 },
    LowerLegL: { z: 0.06 },
    LowerLegR: { z: -0.06 },
    FootL: { x: -0.08 },
    FootR: { x: 0.08 },
    HandL: { x: 0.15 },
    HandR: { x: 0.15 },
  };

  const hit = { strength: 1 };

  function applyHit(strength) {
    for (const name in hitOffsets) {
      const bone = skeletonBones[name];
      const initial = skeletonRecoverPose[name];
      const offset = hitOffsets[name];

      bone.rotation.set(
        initial.x + (offset.x || 0) * strength,
        initial.y + (offset.y || 0) * strength,
        initial.z + (offset.z || 0) * strength
      );
    }
  }

  applyHit(1);

  hitTween = new TWEEN.Tween(hit)
    .to({ strength: 0 }, 500)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(() => {
      applyHit(hit.strength);
    })
    .onComplete(() => {
      isHitAnimating = false;
      recoverAnimation(true);
    });

  tweenGroup.add(hitTween);
  hitTween.start();
}
function recoverAnimation(startIdle = true) {
  if (idleTween) idleTween.stop();
  if (hitTween) hitTween.stop();
  if (recoverTween) recoverTween.stop();

  const startPose = {};
  const targetPose = {};

  for (const name in skeletonRecoverPose) {
    const bone = skeletonBones[name];

    startPose[name] = {
      x: bone.rotation.x,
      y: bone.rotation.y,
      z: bone.rotation.z,
    };

    targetPose[name] = skeletonRecoverPose[name];
  }

  const progress = { value: 0 };

  recoverTween = new TWEEN.Tween(progress)
    .to({ value: 1 }, 400)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(() => {
      for (const name in targetPose) {
        const bone = skeletonBones[name];
        const start = startPose[name];
        const target = targetPose[name];

        bone.rotation.set(
          start.x + (target.x - start.x) * progress.value,
          start.y + (target.y - start.y) * progress.value,
          start.z + (target.z - start.z) * progress.value
        );
      }
    })
    .onComplete(() => {
      if (startIdle) idleAnimation();
    });

  tweenGroup.add(recoverTween);
  recoverTween.start();
}
function checkSkeletonCollision() {
  if (!skeletonBody) return;

  let collided = false;
  const skeletonPointer = Ammo.getPointer(skeletonBody);

  for (let i = 0; i < dispatcher.getNumManifolds(); i++) {
    const manifold = dispatcher.getManifoldByIndexInternal(i);
    const body0 = manifold.getBody0();
    const body1 = manifold.getBody1();

    const pointer0 = Ammo.getPointer(body0);
    const pointer1 = Ammo.getPointer(body1);

    if (pointer0 !== skeletonPointer && pointer1 !== skeletonPointer) {
      continue;
    }

    const otherBody = pointer0 === skeletonPointer ? body1 : body0;
    const otherPointer = Ammo.getPointer(otherBody);

    const ball = rigidBodies.find(
      (object) =>
        object.userData.isBall &&
        object.userData.physicsBody &&
        Ammo.getPointer(object.userData.physicsBody) === otherPointer
    );

    if (!ball) continue;

    for (let j = 0; j < manifold.getNumContacts(); j++) {
      const contact = manifold.getContactPoint(j);

      if (contact.getDistance() <= 0) {
        collided = true;
        break;
      }
    }

    if (collided) break;
  }

  if (collided && !skeletonColliding) {
    hitAnimation();
    playImpactSound();
  }

  skeletonColliding = collided;
}

function checkSkeletonFall() {
  if (!skeletonBody || skeletonHasFallen) return;

  const motionState = skeletonBody.getMotionState();

  if (!motionState) return;

  motionState.getWorldTransform(transformAux1);

  const position = transformAux1.getOrigin();

  const outsideStage =
    Math.abs(position.x()) > 15 || Math.abs(position.z()) > 15;

  const hasDropped = position.y() < skeletonStartY - 0.5;

  if (outsideStage && hasDropped) {
    skeletonHasFallen = true;

    console.log("¡El esqueleto se ha caído del escenario!");

    playFallSound();
  }
}

//Evento de ratón
function initInput() {
  window.addEventListener("pointermove", function (event) {
    mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener("keydown", function (event) {
    if (event.code !== "Space") {
      return;
    }

    event.preventDefault();

    if (audioListener.context.state === "suspended") {
      audioListener.context.resume();
    }

    shootBall();
  });
}
function shootBall() {
  const currentTime = performance.now();

  if (currentTime - lastShotTime < SHOOT_DELAY) {
    return;
  }

  lastShotTime = currentTime;
  raycaster.setFromCamera(mouseCoords, camera);

  // Crea bola como cuerpo rígido y la lanza según coordenadas de ratón
  const ballMass = 35;
  const ballRadius = 0.4;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 14, 10),
    ballMaterial
  );
  ball.userData.isBall = true;
  ball.castShadow = true;
  ball.receiveShadow = true;
  //Ammo
  //Estructura geométrica de colisión esférica
  const ballShape = new Ammo.btSphereShape(ballRadius);
  ballShape.setMargin(margin);
  pos.copy(raycaster.ray.direction);
  pos.add(raycaster.ray.origin);
  quat.set(0, 0, 0, 1);
  const ballBody = createRigidBody(ball, ballShape, ballMass, pos, quat);

  pos.copy(raycaster.ray.direction);
  pos.multiplyScalar(24);
  ballBody.setLinearVelocity(new Ammo.btVector3(pos.x, pos.y, pos.z));
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animationLoop() {
  requestAnimationFrame(animationLoop);

  const deltaTime = clock.getDelta();
  tweenGroup.update();
  updatePhysics(deltaTime);

  renderer.render(scene, camera);
}

function playImpactSound() {
  if (impactSoundBuffers.length === 0) return;

  let soundIndex = Math.floor(Math.random() * impactSoundBuffers.length);

  // Evitamos repetir el sonido anterior
  while (impactSoundBuffers.length > 1 && soundIndex === lastImpactSound) {
    soundIndex = Math.floor(Math.random() * impactSoundBuffers.length);
  }
  lastImpactSound = soundIndex;
  if (impactAudio.isPlaying) {
    impactAudio.stop();
  }
  impactAudio.setBuffer(impactSoundBuffers[soundIndex]);
  impactAudio.setLoop(false);
  impactAudio.setVolume(0.8);
  impactAudio.play();
}

function playFallSound() {
  if (!fallSoundBuffer) return;

  fallAudio.setBuffer(fallSoundBuffer);
  fallAudio.setLoop(false);
  fallAudio.setVolume(0.15);
  fallAudio.play();
}

function updatePhysics(deltaTime) {
  // Avanza la simulación en función del tiempo
  physicsWorld.stepSimulation(deltaTime, 10);
  checkSkeletonCollision();
  // Actualiza cuerpos rígidos
  for (let i = 0, il = rigidBodies.length; i < il; i++) {
    const objThree = rigidBodies[i];
    const objPhys = objThree.userData.physicsBody;
    //Obtiene posición y rotación
    const ms = objPhys.getMotionState();
    //Actualiza la correspondiente primitiva gráfica asociada
    if (ms) {
      ms.getWorldTransform(transformAux1);
      const p = transformAux1.getOrigin();
      const q = transformAux1.getRotation();
      objThree.position.set(p.x(), p.y(), p.z());
      objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());

      objThree.userData.collided = false;
    }
  }
  checkSkeletonFall();
}
