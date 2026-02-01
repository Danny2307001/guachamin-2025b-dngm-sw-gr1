const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const hintEl = document.getElementById("hint");
const dialogEl = document.getElementById("dialog");
const speakerEl = document.getElementById("speaker");
const textEl = document.getElementById("text");
const endEl = document.getElementById("end");

const choiceA = document.getElementById("choiceA");
const choiceB = document.getElementById("choiceB");
const restartBtn = document.getElementById("restart");

const state = {
  canInteract: false,
  inDialog: false,
  completed: false,
  deviceActivated: false,
};

function createScene() {
  const scene = new BABYLON.Scene(engine);

  // ===== Ambiente =====
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.02;

  scene.gravity = new BABYLON.Vector3(0, -0.35, 0);
  scene.collisionsEnabled = true;

  // ===== Cámara / Jugador =====
  const camera = new BABYLON.UniversalCamera(
    "camera",
    new BABYLON.Vector3(0, 1.7, -4),
    scene
  );

  // Asegurar inputs (aunque attachControl a veces falla si no hay foco)
  camera.inputs.clear();
  camera.inputs.addKeyboard();
  camera.inputs.addMouse();

  camera.speed = 0.35;
  camera.angularSensibility = 3000;

  // WASD explícito
  camera.keysUp = [87];    // W
  camera.keysDown = [83];  // S
  camera.keysLeft = [65];  // A
  camera.keysRight = [68]; // D

  // Colisiones
  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.ellipsoid = new BABYLON.Vector3(0.5, 0.9, 0.5);

  // Adjuntar control
  camera.attachControl(canvas, true);

  // IMPORTANTE: dar foco al canvas para que funcione teclado
  const focusCanvas = () => {
    canvas.focus();
  };

  // Click/pointer para foco + mouse look
  canvas.addEventListener("pointerdown", () => {
    focusCanvas();
    // pointer lock ayuda al mouse look (no afecta WASD)
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });

  // ===== Luces =====
  const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.15;

  const mainLight = new BABYLON.PointLight("mainLight", new BABYLON.Vector3(0, 2.5, 0), scene);
  mainLight.intensity = 1.0;
  mainLight.range = 18;

  // ===== Suelo =====
  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 14, height: 14 }, scene);
  ground.checkCollisions = true;

  const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.12);
  groundMat.specularColor = BABYLON.Color3.Black();
  ground.material = groundMat;

  // ===== Habitación =====
  const roomMat = new BABYLON.StandardMaterial("roomMat", scene);
  roomMat.diffuseColor = new BABYLON.Color3(0.06, 0.06, 0.08);
  roomMat.specularColor = BABYLON.Color3.Black();

  function wall(name, w, h, d, x, y, z) {
    const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position = new BABYLON.Vector3(x, y, z);
    m.material = roomMat;
    m.checkCollisions = true;
    return m;
  }

  wall("backWall", 12, 4, 0.3, 0, 2, 6);
  wall("frontWall", 12, 4, 0.3, 0, 2, -6);
  wall("leftWall", 0.3, 4, 12, -6, 2, 0);
  wall("rightWall", 0.3, 4, 12, 6, 2, 0);

  const ceiling = BABYLON.MeshBuilder.CreateBox("ceiling", { width: 12, height: 0.2, depth: 12 }, scene);
  ceiling.position = new BABYLON.Vector3(0, 4.05, 0);
  ceiling.material = roomMat;
  ceiling.checkCollisions = true;

  // ===== Pedestal (SIEMPRE visible) =====
  const pedestal = BABYLON.MeshBuilder.CreateCylinder("pedestal", { height: 0.8, diameter: 1.4 }, scene);
  pedestal.position = new BABYLON.Vector3(0, 0.4, 1.5);
  pedestal.checkCollisions = true;

  const pedMat = new BABYLON.StandardMaterial("pedMat", scene);
  pedMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);
  pedMat.specularColor = BABYLON.Color3.Black();
  pedestal.material = pedMat;

  // ===== Dispositivo (INVISIBLE AL INICIO) =====
  const deviceBase = BABYLON.MeshBuilder.CreateCylinder("deviceBase", { height: 0.25, diameter: 0.9 }, scene);
  deviceBase.position = new BABYLON.Vector3(0, 0.95, 1.5);

  const deviceTop = BABYLON.MeshBuilder.CreateCylinder("deviceTop", {
    height: 0.5, diameterTop: 0.25, diameterBottom: 0.55
  }, scene);
  deviceTop.position = new BABYLON.Vector3(0, 1.25, 1.5);

  const core = BABYLON.MeshBuilder.CreateSphere("core", { diameter: 0.3 }, scene);
  core.position = new BABYLON.Vector3(0, 1.45, 1.5);

  const deviceMat = new BABYLON.StandardMaterial("deviceMat", scene);
  deviceMat.emissiveColor = new BABYLON.Color3(0.4, 0.1, 0.6);
  deviceMat.diffuseColor = new BABYLON.Color3(0.05, 0.02, 0.08);
  deviceMat.specularColor = BABYLON.Color3.Black();

  const coreMat = new BABYLON.StandardMaterial("coreMat", scene);
  coreMat.emissiveColor = new BABYLON.Color3(0.8, 0.3, 1.0);
  coreMat.diffuseColor = BABYLON.Color3.Black();

  deviceBase.material = deviceMat;
  deviceTop.material = deviceMat;
  core.material = coreMat;

  const aura = BABYLON.MeshBuilder.CreateSphere("aura", { diameter: 2.0 }, scene);
  aura.position = new BABYLON.Vector3(0, 1.2, 1.5);

  const auraMat = new BABYLON.StandardMaterial("auraMat", scene);
  auraMat.emissiveColor = new BABYLON.Color3(0.6, 0.2, 0.9);
  auraMat.alpha = 0.12;
  aura.material = auraMat;

  const spiritLight = new BABYLON.PointLight("spiritLight", new BABYLON.Vector3(0, 2.2, 1.5), scene);
  spiritLight.diffuse = new BABYLON.Color3(0.7, 0.25, 0.95);
  spiritLight.intensity = 1.5;
  spiritLight.range = 10;

  // 👇 Ocultar todo el “dispositivo” al inicio
  const setDeviceVisible = (visible) => {
    deviceBase.setEnabled(visible);
    deviceTop.setEnabled(visible);
    core.setEnabled(visible);
    aura.setEnabled(visible);
    spiritLight.setEnabled(visible);
  };
  setDeviceVisible(false);

  // Trigger de interacción (cerca del pedestal)
  const trigger = BABYLON.MeshBuilder.CreateSphere("trigger", { diameter: 2.8 }, scene);
  trigger.position = new BABYLON.Vector3(0, 1.2, 1.5);
  trigger.isVisible = false;

  // Animación (solo si está activado)
  scene.onBeforeRenderObservable.add(() => {
    if (!state.deviceActivated) return;
    const t = performance.now() * 0.002;
    aura.scaling.set(
      1 + Math.sin(t) * 0.05,
      1 + Math.cos(t * 0.9) * 0.06,
      1 + Math.sin(t * 0.8) * 0.05
    );
    core.position.y = 1.45 + Math.sin(t * 1.3) * 0.04;
  });

  // HUD: mostrar “Presiona E”
  scene.onBeforeRenderObservable.add(() => {
    if (state.completed) return;

    const d = BABYLON.Vector3.Distance(camera.position, trigger.position);
    state.canInteract = d < 2.4 && !state.inDialog;

    // mensaje depende si ya está activado
    if (state.canInteract) {
      hintEl.innerHTML = state.deviceActivated
        ? 'Presiona <b>E</b> para sintonizar'
        : 'Presiona <b>E</b> para activar el dispositivo';
      hintEl.classList.remove("hidden");
    } else {
      hintEl.classList.add("hidden");
    }
  });

  // ===== Diálogo =====
  function openDialog() {
    state.inDialog = true;
    dialogEl.classList.remove("hidden");
    speakerEl.textContent = "Interferencia espiritual";
    textEl.textContent =
      "…sssh… La verdad está fragmentada. Si confías en esta voz, el lugar cambiará. Si me ignoras… también.";
    camera.detachControl();
  }

  function closeDialog() {
    dialogEl.classList.add("hidden");
    state.inDialog = false;
    camera.attachControl(canvas, true);
    focusCanvas();
  }

  function applyDecision(type) {
    state.completed = true;

    if (type === "A") {
      // más opresivo
      mainLight.intensity = 0.6;
      scene.fogDensity = 0.06;
      roomMat.diffuseColor = new BABYLON.Color3(0.05, 0.02, 0.04);
      groundMat.diffuseColor = new BABYLON.Color3(0.08, 0.04, 0.06);
    } else {
      // más frío/analítico
      mainLight.intensity = 1.2;
      scene.fogDensity = 0.015;
      roomMat.diffuseColor = new BABYLON.Color3(0.04, 0.05, 0.09);
      groundMat.diffuseColor = new BABYLON.Color3(0.07, 0.08, 0.12);
    }

    closeDialog();
    endEl.classList.remove("hidden");
  }

  choiceA.onclick = () => applyDecision("A");
  choiceB.onclick = () => applyDecision("B");
  restartBtn.onclick = () => window.location.reload();

  // Teclas
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyE" && state.canInteract && !state.inDialog && !state.completed) {
      // Primera vez: activar dispositivo (aparece)
      if (!state.deviceActivated) {
        state.deviceActivated = true;
        setDeviceVisible(true);
      }
      openDialog();
    }

    if (e.code === "Escape" && state.inDialog) {
      closeDialog();
    }
  });

  // Pantalla final oculto al inicio
  endEl.classList.add("hidden");
  dialogEl.classList.add("hidden");
  hintEl.classList.add("hidden");

  // Foco inicial
  focusCanvas();

  return scene;
}

const scene = createScene();

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => engine.resize());
