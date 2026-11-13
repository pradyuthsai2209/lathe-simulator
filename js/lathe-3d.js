/**
 * Lathe 3D Digital Twin Viewer
 * 
 * Powered by Three.js (with high-precision Canvas 2D fallback).
 * Engineering-accurate HMT Heavy Duty Lathe L45/L50/L60/L70 3D Cutaway Twin:
 * - Unified spindle axis: Centerline at Y = 1060mm, Z = 0mm.
 * - Chuck face exact datum: X = +50mm.
 * - 4-jaw independent chuck with dynamic radial jaw gripping based on workpiece diameter.
 * - Dynamic stepped workpiece turning visualization (uncut stock vs turned finished section).
 * - H-shaped saddle with recessed bridge giving zero collision under the rotating workpiece.
 * - Cross-slide, compound rest, and 4-way tool post on front ways with clearance from job.
 * - TiN-coated carbide tool insert perfectly positioned at spindle center height (Y = 1060mm)
 *   and dynamically engaging the workpiece circumference based on depth of cut (ap).
 * - Tailstock with MT-6 live center apex at X = 0 local, matching the job end exactly without overlap.
 * - Lead screw (Acme 6mm pitch) and feed rod passing directly through apron split-nut housing.
 * - Dynamic hot curled chip particle system and articulated Loc-Line coolant spray.
 * - Balanced studio lighting and camera framing showing the entire machine without clipping.
 * - Camera presets: Isometric, Gearbox, Spindle, Cutting Tool, Tailstock, Auto Rotate, Reset.
 */

export class Lathe3DViewer {
  constructor(containerId, engine) {
    this.container = document.getElementById(containerId);
    this.engine = engine;
    this.isThreeLoaded = typeof window.THREE !== 'undefined';
    this.autoRotate = false;
    this.activePreset = 'isometric';

    // Particle systems
    this.chips = [];
    this.coolantDrops = [];

    this.init();
  }

  init() {
    if (!this.container) return;

    if (this.isThreeLoaded) {
      this.initThreeJS();
    } else {
      window.addEventListener('load', () => {
        if (typeof window.THREE !== 'undefined' && !this.scene) {
          this.isThreeLoaded = true;
          this.initThreeJS();
        }
      });
      this.initCanvasFallback();
    }

    window.addEventListener('resize', () => this.onResize());
  }

  initThreeJS() {
    this.container.innerHTML = '';

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c111a);
    // Subtle distant fog for depth cueing without obscuring the machine
    this.scene.fog = new THREE.Fog(0x0c111a, 4500, 12000);

    // Camera - 40° FOV gives natural, undistorted perspective
    this.camera = new THREE.PerspectiveCamera(40, width / height, 10, 15000);
    this.setCameraPreset('isometric');

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.04; // Prevent going underground
      this.controls.minDistance = 300;
      this.controls.maxDistance = 6500;
      this.controls.target.set(600, 620, 0); // Lathe volumetric geometric center
    }

    this.setupLighting();
    this.buildLatheModel();
    this.setupParticleSystems();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    // Balanced high-clarity industrial studio lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.88);
    this.scene.add(ambientLight);

    // Studio Key Light (Front-Right, high angle)
    const keyLight = new THREE.DirectionalLight(0xfff7ee, 1.35);
    keyLight.position.set(1400, 2400, 1900);
    keyLight.target.position.set(600, 620, 0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 400;
    keyLight.shadow.camera.far = 5500;
    const d = 1800;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    this.scene.add(keyLight);
    this.scene.add(keyLight.target);

    // Fill Light (Rear-Left, soft cyan tint)
    const fillLight = new THREE.DirectionalLight(0x88b0d8, 0.75);
    fillLight.position.set(-1200, 1500, -900);
    fillLight.target.position.set(600, 620, 0);
    this.scene.add(fillLight);
    this.scene.add(fillLight.target);

    // Rim / Way Light (Rear-Right, highlights precision ground ways)
    const rimLight = new THREE.DirectionalLight(0x4488bb, 0.65);
    rimLight.position.set(800, 1800, -1600);
    this.scene.add(rimLight);

    // Workzone Accent Spot (Illuminates chuck, workpiece, and tool tip)
    const workzoneLight = new THREE.PointLight(0xaae4ff, 1.25, 2400);
    workzoneLight.position.set(250, 1300, 500);
    this.scene.add(workzoneLight);

    // Ground Grid & Floor
    const gridHelper = new THREE.GridHelper(5000, 100, 0x22324c, 0x131c2a);
    gridHelper.position.set(600, -1, 0);
    this.scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(7000, 7000);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080c14,
      roughness: 0.95,
      metalness: 0.05
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(600, -2, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  buildLatheModel() {
    this.machineGroup = new THREE.Group();
    this.scene.add(this.machineGroup);

    // Materials - Distinctive visible tones with high-quality PBR sheen
    // HMT Classic Machine Enamel (RAL 5015 / Teal-Blue Heavy Machine Enamel)
    this.matCastIron = new THREE.MeshStandardMaterial({
      color: 0x244c66,
      roughness: 0.52,
      metalness: 0.35
    });

    // Precision Flame-Hardened Ground Guideway Steel
    this.matGroundSteel = new THREE.MeshStandardMaterial({
      color: 0xe4edf5,
      roughness: 0.16,
      metalness: 0.88
    });

    // Dark Machinery Grey / Phosphated Fasteners / Bed Plates
    this.matDarkMetal = new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.45,
      metalness: 0.75
    });

    // Bright Polished Steel (Spindle nose, Quill, Lead screw, Handwheels)
    this.matBrightSteel = new THREE.MeshStandardMaterial({
      color: 0xf2f7fc,
      roughness: 0.10,
      metalness: 0.94
    });

    // Bearing Bronze / Brass Graduated Dials & Bushings
    this.matBronze = new THREE.MeshStandardMaterial({
      color: 0xd4a84a,
      roughness: 0.32,
      metalness: 0.84
    });

    // Transparent Cutaway Acrylic Window
    this.matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x99ddff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.08,
      transmission: 0.88,
      ior: 1.5
    });

    // Workpiece Uncut Raw Stock (Industrial hot-rolled steel bar)
    this.matRawStock = new THREE.MeshStandardMaterial({
      color: 0x76889b,
      roughness: 0.42,
      metalness: 0.70
    });

    // Freshly Machined Turned Surface (Mirror-finish cut diameter)
    this.matTurnedSurface = new THREE.MeshStandardMaterial({
      color: 0xf5faff,
      roughness: 0.08,
      metalness: 0.96
    });

    // TiN Gold Coated Carbide Insert
    this.matToolInsert = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.20,
      metalness: 0.90
    });

    // Sub-assemblies
    this.buildBedAndPedestals();
    this.buildHeadstockAndGearbox();
    this.buildChuckAndSpindle();
    this.buildWorkpiece();
    this.buildCarriageAndCrossSlide();
    this.buildTailstock();
    this.buildFeedShafts();
  }

  buildBedAndPedestals() {
    const bedLength = 2900;
    const bedHeight = 360;
    const bedWidth = 500;

    // Left Pedestal (under headstock: X = -680 to -160)
    const legGeo = new THREE.BoxGeometry(520, 500, 560);
    const leftLeg = new THREE.Mesh(legGeo, this.matCastIron);
    leftLeg.position.set(-420, 250, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    this.machineGroup.add(leftLeg);

    // Right Pedestal (under tailstock end: X = 1290 to 1810)
    const rightLeg = new THREE.Mesh(legGeo, this.matCastIron);
    rightLeg.position.set(1550, 250, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    this.machineGroup.add(rightLeg);

    // Deep Chip Pan & Coolant Sump Tray
    const trayGeo = new THREE.BoxGeometry(bedLength + 200, 45, bedWidth + 260);
    const chipTray = new THREE.Mesh(trayGeo, this.matDarkMetal);
    chipTray.position.set(560, 505, 0);
    chipTray.castShadow = true;
    chipTray.receiveShadow = true;
    this.machineGroup.add(chipTray);

    // Main Bed Casting (Box-type ribbed diagonal web construction)
    // Spans from X = -890 to X = +2010 (Length 2900, Height 360, centered at Y = 685)
    const bedGeo = new THREE.BoxGeometry(bedLength, bedHeight, bedWidth);
    const bed = new THREE.Mesh(bedGeo, this.matCastIron);
    bed.position.set(560, 685, 0);
    bed.castShadow = true;
    bed.receiveShadow = true;
    this.machineGroup.add(bed);

    // Flame-Hardened Inverted V-Ways (Front & Rear Prismatic Guideways at Y = 875)
    const wayGeo = new THREE.CylinderGeometry(18, 26, bedLength, 4);
    wayGeo.rotateZ(Math.PI / 2);

    const frontVWay = new THREE.Mesh(wayGeo, this.matGroundSteel);
    frontVWay.position.set(560, 875, 170);
    frontVWay.castShadow = true;
    this.machineGroup.add(frontVWay);

    const rearVWay = new THREE.Mesh(wayGeo, this.matGroundSteel);
    rearVWay.position.set(560, 875, -170);
    rearVWay.castShadow = true;
    this.machineGroup.add(rearVWay);

    // Center Flat Guideways for Tailstock Alignment (at Y = 870)
    const flatWayGeo = new THREE.BoxGeometry(bedLength, 14, 120);
    const flatWay = new THREE.Mesh(flatWayGeo, this.matGroundSteel);
    flatWay.position.set(560, 870, 0);
    this.machineGroup.add(flatWay);

    // Characteristic HMT Gap Bed Cutaway (in front of headstock spindle)
    const gapBlock = new THREE.Mesh(new THREE.BoxGeometry(220, 140, bedWidth + 10), this.matDarkMetal);
    gapBlock.position.set(-40, 800, 0);
    this.machineGroup.add(gapBlock);
  }

  buildHeadstockAndGearbox() {
    this.headstockGroup = new THREE.Group();
    this.machineGroup.add(this.headstockGroup);

    // Headstock main casing spans X = -820 to X = -110 (Length 710, Height 540, Width 540)
    const hsLength = 710;
    const hsHeight = 540;
    const hsWidth = 540;

    const hsGeo = new THREE.BoxGeometry(hsLength, hsHeight, hsWidth);
    const hsCasing = new THREE.Mesh(hsGeo, this.matCastIron);
    hsCasing.position.set(-465, 950, 0);
    hsCasing.castShadow = true;
    this.headstockGroup.add(hsCasing);

    // Top Cutaway Viewing Window
    const cutawayGeo = new THREE.BoxGeometry(500, 18, 420);
    const cutawayCover = new THREE.Mesh(cutawayGeo, this.matGlass);
    cutawayCover.position.set(-465, 1222, 0);
    this.headstockGroup.add(cutawayCover);

    // Inside Gearbox Model
    this.gearGroup = new THREE.Group();
    this.headstockGroup.add(this.gearGroup);

    // 1. Spindle Hollow Shaft at Y = 1060, Z = 0
    const spindleShaft = new THREE.Mesh(new THREE.CylinderGeometry(35, 35, 520, 20), this.matBrightSteel);
    spindleShaft.rotation.z = Math.PI / 2;
    spindleShaft.position.set(-465, 1060, 0);
    this.gearGroup.add(spindleShaft);

    // 2. Intermediate Splined Shaft at Y = 940, Z = 70
    const interShaft = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 520, 16), this.matBrightSteel);
    interShaft.rotation.z = Math.PI / 2;
    interShaft.position.set(-465, 940, 70);
    this.gearGroup.add(interShaft);

    // 3. Motor Drive Shaft at Y = 820, Z = -60
    const driveShaft = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 520, 16), this.matBrightSteel);
    driveShaft.rotation.z = Math.PI / 2;
    driveShaft.position.set(-465, 820, -60);
    this.gearGroup.add(driveShaft);

    // Cluster Gears
    this.headstockGears = [];
    const createGear = (radius, width, x, y, z, teeth) => {
      const gGroup = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, teeth || 28), this.matBrightSteel);
      disc.rotation.z = Math.PI / 2;
      gGroup.add(disc);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 6, 8, teeth || 28), this.matBronze);
      rim.rotation.y = Math.PI / 2;
      gGroup.add(rim);

      gGroup.position.set(x, y, z);
      this.gearGroup.add(gGroup);
      this.headstockGears.push(gGroup);
      return gGroup;
    };

    // Spindle gears
    createGear(145, 48, -580, 1060, 0, 36);
    createGear(115, 48, -470, 1060, 0, 28);
    createGear(85, 48, -360, 1060, 0, 22);

    // Intermediate mating gears
    createGear(95, 48, -580, 940, 70, 24);
    createGear(125, 48, -470, 940, 70, 32);
    createGear(155, 48, -360, 940, 70, 38);

    // Motor input gears
    createGear(75, 45, -580, 820, -60, 20);
    createGear(110, 45, -420, 820, -60, 28);

    // Front Control Levers on Headstock
    this.buildHeadstockLevers();
  }

  buildHeadstockLevers() {
    const leverPositions = [
      { x: -620, y: 1040, z: 280, label: 'Speed Range' },
      { x: -480, y: 1040, z: 280, label: 'Speed Step' },
      { x: -340, y: 1040, z: 280, label: 'Feed Direction' }
    ];

    leverPositions.forEach((pos, idx) => {
      const leverGroup = new THREE.Group();
      leverGroup.position.set(pos.x, pos.y, pos.z);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 22, 16), this.matBronze);
      hub.rotation.x = Math.PI / 2;
      leverGroup.add(hub);

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 95, 12), this.matBrightSteel);
      arm.position.set(0, 48, 12);
      leverGroup.add(arm);

      const knobMat = new THREE.MeshStandardMaterial({
        color: idx === 1 ? 0xd92626 : (idx === 0 ? 0x22c55e : 0x1e293b),
        roughness: 0.25
      });
      const knob = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 16), knobMat);
      knob.position.set(0, 95, 12);
      leverGroup.add(knob);

      this.headstockGroup.add(leverGroup);
    });
  }

  buildChuckAndSpindle() {
    // Spindle group datum at X = -110, Y = 1060, Z = 0
    this.spindleGroup = new THREE.Group();
    this.spindleGroup.position.set(-110, 1060, 0);
    this.machineGroup.add(this.spindleGroup);

    // Flanged Spindle Nose (D1-11 Camlock flange, X = -110 to -80 in world)
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(190, 200, 30, 32), this.matDarkMetal);
    flange.rotation.z = Math.PI / 2;
    flange.position.x = 15;
    this.spindleGroup.add(flange);

    // 4-Jaw Independent Chuck Body
    // Spans X = -90 to X = +50 in world coords (x = 20 to 160 in spindleGroup)
    // Chuck width = 140 mm. Front gripping face is at exact X = 160 (+50 mm world!)
    this.chuckWidth = 140;
    this.chuckRadius = 340; // 680 mm diameter

    const chuckBodyGeo = new THREE.CylinderGeometry(this.chuckRadius, this.chuckRadius, this.chuckWidth, 40);
    this.chuckMesh = new THREE.Mesh(chuckBodyGeo, this.matGroundSteel);
    this.chuckMesh.rotation.z = Math.PI / 2;
    this.chuckMesh.position.x = 20 + this.chuckWidth / 2; // Center at x = 90
    this.chuckMesh.castShadow = true;
    this.spindleGroup.add(this.chuckMesh);

    // Faceplate Concentric Alignment Rings
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x2e3540, roughness: 0.35 });
    for (let r = 80; r < this.chuckRadius - 20; r += 50) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 2.5, 6, 40), rimMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = this.chuckWidth / 2 + 1;
      this.chuckMesh.add(ring);
    }

    // 4 Radial T-Slots
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.8 });
    for (let a = 0; a < 4; a++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(6, 45, this.chuckRadius * 1.8), slotMat);
      slot.rotation.x = a * (Math.PI / 4);
      slot.position.x = this.chuckWidth / 2 + 0.5;
      this.chuckMesh.add(slot);
    }

    // 4 Independent Stepped Hardened Clamping Jaws
    this.chuckJaws = [];
    const jawAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

    jawAngles.forEach((angle) => {
      const jawGroup = new THREE.Group();
      jawGroup.rotation.x = angle;

      // Base Master Jaw
      const jawBase = new THREE.Mesh(new THREE.BoxGeometry(45, 50, 48), this.matDarkMetal);
      jawBase.position.set(0, 140, 0);
      jawGroup.add(jawBase);

      // 2 Hardened Gripping Steps
      const step1 = new THREE.Mesh(new THREE.BoxGeometry(32, 28, 42), this.matGroundSteel);
      step1.position.set(this.chuckWidth / 2 + 10, 115, 0);
      jawGroup.add(step1);

      const step2 = new THREE.Mesh(new THREE.BoxGeometry(24, 22, 38), this.matGroundSteel);
      step2.position.set(this.chuckWidth / 2 + 22, 95, 0);
      jawGroup.add(step2);

      this.chuckMesh.add(jawGroup);
      this.chuckJaws.push({ group: jawGroup, base: jawBase, step1, step2 });
    });

    // 110 mm Spindle Through-Bore
    const bore = new THREE.Mesh(new THREE.CylinderGeometry(55, 55, this.chuckWidth + 50, 24), this.matDarkMetal);
    bore.rotation.z = Math.PI / 2;
    bore.position.x = 90;
    this.spindleGroup.add(bore);
  }

  buildWorkpiece() {
    this.workpieceGroup = new THREE.Group();
    // Mounted flush on chuck face: X = 160 inside spindleGroup (+50 mm in world coords)
    this.workpieceGroup.position.set(160, 0, 0);
    this.spindleGroup.add(this.workpieceGroup);

    // Pre-oriented Unit Cylinder Geometry (Height along X, Radii along Y & Z)
    // Avoids local coordinate rotation pitfalls during dynamic scaling
    const unitCylGeo = new THREE.CylinderGeometry(1, 1, 1, 36);
    unitCylGeo.rotateZ(-Math.PI / 2); // Axis along X: x in [-0.5, +0.5]

    // 1. Turned Finished Section (from chuck face X = 0 to tool cut position)
    this.turnedMesh = new THREE.Mesh(unitCylGeo, this.matTurnedSurface);
    this.turnedMesh.castShadow = true;
    this.turnedMesh.visible = false;
    this.workpieceGroup.add(this.turnedMesh);

    // 2. Transition Shoulder (bevel between cut and raw stock)
    this.shoulderMesh = new THREE.Mesh(unitCylGeo, this.matTurnedSurface);
    this.shoulderMesh.castShadow = true;
    this.shoulderMesh.visible = false;
    this.workpieceGroup.add(this.shoulderMesh);

    // 3. Uncut Raw Stock Section (from tool cut position to tailstock live center)
    this.rawStockMesh = new THREE.Mesh(unitCylGeo, this.matRawStock);
    this.rawStockMesh.castShadow = true;
    this.workpieceGroup.add(this.rawStockMesh);
  }

  buildCarriageAndCrossSlide() {
    this.carriageGroup = new THREE.Group();
    this.machineGroup.add(this.carriageGroup);

    // 1. Authentic H-Shaped Saddle
    // Front wing rides front V-way at Z = +170
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(400, 48, 140), this.matCastIron);
    frontWing.position.set(0, 895, 170);
    frontWing.castShadow = true;
    this.carriageGroup.add(frontWing);

    // Rear wing rides rear V-way at Z = -170
    const rearWing = new THREE.Mesh(new THREE.BoxGeometry(400, 48, 140), this.matCastIron);
    rearWing.position.set(0, 895, -170);
    rearWing.castShadow = true;
    this.carriageGroup.add(rearWing);

    // Low Connecting Saddle Bridge (recessed below Y = 865 to give full clearance for rotating job)
    const lowBridge = new THREE.Mesh(new THREE.BoxGeometry(400, 22, 220), this.matCastIron);
    lowBridge.position.set(0, 858, 0);
    lowBridge.castShadow = true;
    this.carriageGroup.add(lowBridge);

    // Inverted V-Groove Guide Pads
    const vGrooveGeo = new THREE.BoxGeometry(400, 18, 45);
    const fGroove = new THREE.Mesh(vGrooveGeo, this.matGroundSteel);
    fGroove.position.set(0, 874, 170);
    this.carriageGroup.add(fGroove);

    const rGroove = new THREE.Mesh(vGrooveGeo, this.matGroundSteel);
    rGroove.position.set(0, 874, -170);
    this.carriageGroup.add(rGroove);

    // 2. Apron Gearbox Housing (Hangs down on front at Z = 280, Y = 715)
    const apronGeo = new THREE.BoxGeometry(380, 280, 85);
    const apron = new THREE.Mesh(apronGeo, this.matCastIron);
    apron.position.set(0, 715, 280);
    apron.castShadow = true;
    this.carriageGroup.add(apron);

    // Bronze Bores for Lead Screw (Y = 715) and Feed Rod (Y = 645)
    const boreLead = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 95, 16), this.matBronze);
    boreLead.rotation.z = Math.PI / 2;
    boreLead.position.set(0, 715, 280);
    this.carriageGroup.add(boreLead);

    const boreFeed = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 95, 16), this.matBronze);
    boreFeed.rotation.z = Math.PI / 2;
    boreFeed.position.set(0, 645, 280);
    this.carriageGroup.add(boreFeed);

    // Handwheels & Levers on Apron
    const handwheel = new THREE.Mesh(new THREE.TorusGeometry(68, 11, 14, 24), this.matBrightSteel);
    handwheel.position.set(-90, 740, 330);
    this.carriageGroup.add(handwheel);

    const hwHandle = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 45, 10), this.matBrightSteel);
    hwHandle.rotation.x = Math.PI / 2;
    hwHandle.position.set(-90, 790, 350);
    this.carriageGroup.add(hwHandle);

    const crossWheel = new THREE.Mesh(new THREE.TorusGeometry(48, 8, 12, 24), this.matBrightSteel);
    crossWheel.position.set(80, 765, 330);
    this.carriageGroup.add(crossWheel);

    const crossDial = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 18, 24), this.matBronze);
    crossDial.rotation.x = Math.PI / 2;
    crossDial.position.set(80, 765, 322);
    this.carriageGroup.add(crossDial);

    const halfNutLever = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 85, 10), this.matBrightSteel);
    halfNutLever.position.set(140, 660, 330);
    halfNutLever.rotation.z = 0.45;
    this.carriageGroup.add(halfNutLever);

    const hnKnob = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 14), new THREE.MeshStandardMaterial({ color: 0xd92626 }));
    hnKnob.position.set(168, 695, 330);
    this.carriageGroup.add(hnKnob);

    // 3. Cross-Slide & Tool Post Assembly
    // Mounted on front saddle wing, sliding radially along Z
    this.crossSlideGroup = new THREE.Group();
    this.carriageGroup.add(this.crossSlideGroup);

    // Dovetail Cross-Slide Table
    const crossTable = new THREE.Mesh(new THREE.BoxGeometry(260, 42, 280), this.matGroundSteel);
    crossTable.position.set(0, 936, 120);
    crossTable.castShadow = true;
    this.crossSlideGroup.add(crossTable);

    // Swiveling Compound Rest Base with 360° Circular Graduations
    this.compoundRestGroup = new THREE.Group();
    this.compoundRestGroup.position.set(0, 970, 75);
    this.crossSlideGroup.add(this.compoundRestGroup);

    const compBase = new THREE.Mesh(new THREE.CylinderGeometry(95, 105, 22, 32), this.matBronze);
    this.compoundRestGroup.add(compBase);

    const compTop = new THREE.Mesh(new THREE.BoxGeometry(150, 28, 130), this.matGroundSteel);
    compTop.position.set(0, 24, 0);
    this.compoundRestGroup.add(compTop);

    // 4-Way Indexing Tool Post Body (Positioned clear of the workpiece)
    const toolPost = new THREE.Mesh(new THREE.BoxGeometry(105, 82, 105), this.matDarkMetal);
    toolPost.position.set(0, 78, 0);
    toolPost.castShadow = true;
    this.compoundRestGroup.add(toolPost);

    const postClamp = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 52, 14), this.matBrightSteel);
    postClamp.position.set(0, 135, 0);
    this.compoundRestGroup.add(postClamp);

    // Tool Clamping Square-Head Bolts
    [-30, 0, 30].forEach(bx => {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 16, 8), this.matDarkMetal);
      bolt.position.set(bx, 124, -38);
      this.compoundRestGroup.add(bolt);
    });

    // Right-Hand Turning Tool Holder Shank (32x32 mm forged shank)
    // Extends forward from the tool post towards the workpiece
    const shankGeo = new THREE.BoxGeometry(160, 32, 32);
    this.toolShank = new THREE.Mesh(shankGeo, this.matDarkMetal);
    // Tool center sits at Y = 1060mm in world coordinates: 970 + 78 + 12 = 1060mm!
    this.toolShank.position.set(25, 76, -55);
    this.toolShank.rotation.y = -Math.PI / 16;
    this.compoundRestGroup.add(this.toolShank);

    // Gold TiN-Coated Indexable Carbide Tool Insert
    const insertGeo = new THREE.BoxGeometry(22, 7, 22);
    this.toolInsertMesh = new THREE.Mesh(insertGeo, this.matToolInsert);
    this.toolInsertMesh.position.set(-58, 16, -10);
    this.toolInsertMesh.rotation.y = Math.PI / 4;
    this.toolShank.add(this.toolInsertMesh);

    // Articulated Coolant Hose
    this.buildCoolantNozzle();
  }

  buildCoolantNozzle() {
    this.coolantNozzleGroup = new THREE.Group();
    this.coolantNozzleGroup.position.set(80, 960, 80);
    this.carriageGroup.add(this.coolantNozzleGroup);

    const segMat = new THREE.MeshStandardMaterial({ color: 0x0055cc, roughness: 0.35 });
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.35 });

    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(8, 7, 18, 10), segMat);
      seg.position.set(-i * 11, i * 4.5, -i * 15);
      seg.rotation.x = 0.55;
      seg.rotation.y = -0.42;
      this.coolantNozzleGroup.add(seg);
    }

    this.nozzleTip = new THREE.Mesh(new THREE.ConeGeometry(7, 22, 12), ballMat);
    this.nozzleTip.position.set(-77, 32, -105);
    this.nozzleTip.rotation.x = -1.75;
    this.coolantNozzleGroup.add(this.nozzleTip);
  }

  buildTailstock() {
    // Tailstock assembly group is modeled with its local origin (0, 0, 0)
    // positioned at the LIVE CENTER APEX TIP!
    // Centerline is Y = 0 (relative to Y = 1060 world) and Z = 0.
    this.tailstockGroup = new THREE.Group();
    this.machineGroup.add(this.tailstockGroup);

    // MT-6 Live Center Cone
    // Apex is at local X = 0! Extends +X into quill from X = 0 to X = 75
    const centerConeGeo = new THREE.ConeGeometry(35, 75, 24);
    centerConeGeo.rotateZ(-Math.PI / 2); // Apex points to -X (towards workpiece)
    centerConeGeo.translate(37.5, 0, 0); // Apex at X = 0, base at X = 75

    this.liveCenterMesh = new THREE.Mesh(centerConeGeo, this.matBrightSteel);
    this.liveCenterMesh.castShadow = true;
    this.tailstockGroup.add(this.liveCenterMesh);

    // Live Center Bearing Housing
    const centerHubGeo = new THREE.CylinderGeometry(44, 44, 55, 24);
    centerHubGeo.rotateZ(-Math.PI / 2);
    const centerHub = new THREE.Mesh(centerHubGeo, this.matGroundSteel);
    centerHub.position.set(102.5, 0, 0); // Spans X = 75 to 130
    this.tailstockGroup.add(centerHub);

    // Tailstock Quill / Barrel Sleeve (Spans X = 110 to X = 430)
    const quillGeo = new THREE.CylinderGeometry(55, 55, 320, 28);
    quillGeo.rotateZ(-Math.PI / 2);
    this.quillMesh = new THREE.Mesh(quillGeo, this.matBrightSteel);
    this.quillMesh.position.set(270, 0, 0);
    this.tailstockGroup.add(this.quillMesh);

    // Tailstock Main Casting Body (Spans X = 200 to X = 540)
    const tsBodyGeo = new THREE.BoxGeometry(340, 185, 260);
    const tsBody = new THREE.Mesh(tsBodyGeo, this.matCastIron);
    tsBody.position.set(370, -25, 0);
    tsBody.castShadow = true;
    this.tailstockGroup.add(tsBody);

    // Tailstock Clamping Base on Bed Ways (Y = -190 to rest on ways at Y = 870)
    const tsBaseGeo = new THREE.BoxGeometry(380, 85, 340);
    const tsBase = new THREE.Mesh(tsBaseGeo, this.matCastIron);
    tsBase.position.set(370, -148, 0);
    tsBase.castShadow = true;
    this.tailstockGroup.add(tsBase);

    // Tailstock Feed Handwheel at Rear
    const tsWheel = new THREE.Mesh(new THREE.TorusGeometry(88, 12, 14, 28), this.matBrightSteel);
    tsWheel.rotation.y = Math.PI / 2;
    tsWheel.position.set(560, 0, 0);
    this.tailstockGroup.add(tsWheel);

    const tsHandle = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 45, 10), this.matBrightSteel);
    tsHandle.position.set(570, 65, 0);
    this.tailstockGroup.add(tsHandle);

    // Quick-Acting Cam Clamping Lever
    const clampLever = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 130, 10), this.matBrightSteel);
    clampLever.position.set(370, 95, 80);
    clampLever.rotation.x = 0.35;
    this.tailstockGroup.add(clampLever);
  }

  buildFeedShafts() {
    this.shaftGroup = new THREE.Group();
    this.machineGroup.add(this.shaftGroup);

    const shaftLength = 2600;

    // 1. Acme Lead Screw (50mm diameter, 6mm pitch) at Y = 715, Z = 280
    this.leadScrewMesh = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, shaftLength, 20), this.matGroundSteel);
    this.leadScrewMesh.rotation.z = Math.PI / 2;
    this.leadScrewMesh.position.set(700, 715, 280);
    this.shaftGroup.add(this.leadScrewMesh);

    // 2. Feed Rod (Splined turning rod, 32mm diameter) at Y = 645, Z = 280
    this.feedRodMesh = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, shaftLength, 16), this.matBrightSteel);
    this.feedRodMesh.rotation.z = Math.PI / 2;
    this.feedRodMesh.position.set(700, 645, 280);
    this.shaftGroup.add(this.feedRodMesh);

    // 3. Spindle Start / Reverse Control Rod at Y = 580, Z = 280
    this.switchRodMesh = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, shaftLength, 12), this.matDarkMetal);
    this.switchRodMesh.rotation.z = Math.PI / 2;
    this.switchRodMesh.position.set(700, 580, 280);
    this.shaftGroup.add(this.switchRodMesh);
  }

  setupParticleSystems() {
    // 1. Hot Metal Chips Particle Pool
    const chipCount = 140;
    const chipGeo = new THREE.BufferGeometry();
    const chipPositions = new Float32Array(chipCount * 3);
    const chipColors = new Float32Array(chipCount * 3);

    for (let i = 0; i < chipCount; i++) {
      chipPositions[i * 3] = 0;
      chipPositions[i * 3 + 1] = -500;
      chipPositions[i * 3 + 2] = 0;

      chipColors[i * 3] = 1.0;
      chipColors[i * 3 + 1] = 0.65;
      chipColors[i * 3 + 2] = 0.15;
    }

    chipGeo.setAttribute('position', new THREE.BufferAttribute(chipPositions, 3));
    chipGeo.setAttribute('color', new THREE.BufferAttribute(chipColors, 3));

    const chipMat = new THREE.PointsMaterial({
      size: 7.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    this.chipParticles = new THREE.Points(chipGeo, chipMat);
    this.scene.add(this.chipParticles);

    this.chipPool = [];
    for (let i = 0; i < chipCount; i++) {
      this.chipPool.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0,
        maxLife: 0.45
      });
    }

    // 2. Pressurized Coolant Mist & Droplets
    const dropCount = 120;
    const dropGeo = new THREE.BufferGeometry();
    const dropPositions = new Float32Array(dropCount * 3);

    for (let i = 0; i < dropCount; i++) {
      dropPositions[i * 3] = 0;
      dropPositions[i * 3 + 1] = -500;
      dropPositions[i * 3 + 2] = 0;
    }

    dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPositions, 3));

    const dropMat = new THREE.PointsMaterial({
      size: 5.5,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8
    });

    this.coolantParticles = new THREE.Points(dropGeo, dropMat);
    this.scene.add(this.coolantParticles);

    this.coolantPool = [];
    for (let i = 0; i < dropCount; i++) {
      this.coolantPool.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0,
        maxLife: 0.35
      });
    }
  }

  setCameraPreset(preset) {
    this.activePreset = preset;
    if (!this.camera) return;

    // Lathe volumetric geometric center: X = 600, Y = 620, Z = 0
    switch (preset) {
      case 'isometric':
        // Full machine overview: perfectly frames the 3-meter machine from headstock to tailstock
        this.camera.position.set(1850, 1550, 2550);
        if (this.controls) this.controls.target.set(600, 620, 0);
        break;
      case 'gearbox':
        // Headstock internal gears cutaway view
        this.camera.position.set(-465, 1420, 700);
        if (this.controls) this.controls.target.set(-465, 1020, 0);
        break;
      case 'spindle':
        // 4-Jaw Chuck and spindle nose datum
        this.camera.position.set(50, 1320, 1150);
        if (this.controls) this.controls.target.set(50, 1060, 0);
        break;
      case 'tool':
        // Close-up on tool tip, depth of cut, and chip generation
        const carZ = this.engine ? this.engine.carriageZ : 450;
        const curR = this.engine ? this.engine.workpieceDiameter / 2 : 125;
        this.camera.position.set(50 + carZ + 140, 1220, curR + 420);
        if (this.controls) this.controls.target.set(50 + carZ, 1060, curR);
        break;
      case 'tailstock':
        // Tailstock quill and live center engagement
        const wpLen = this.engine ? this.engine.workpieceLength : 800;
        this.camera.position.set(50 + wpLen + 200, 1300, 850);
        if (this.controls) this.controls.target.set(50 + wpLen, 1060, 0);
        break;
      case 'reset':
        this.camera.position.set(1850, 1550, 2550);
        if (this.controls) this.controls.target.set(600, 620, 0);
        break;
    }
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
      this.controls.autoRotateSpeed = 1.6;
    }
    return this.autoRotate;
  }

  updateFromEngine(dt) {
    if (!this.engine) return;

    // 1. Spindle & Chuck Rotation
    const spindleRadPerSec = (this.engine.spindleRpm * 2 * Math.PI) / 60.0;
    const rotationDelta = spindleRadPerSec * dt;

    if (this.spindleGroup) {
      this.spindleGroup.rotation.x += rotationDelta;
    }

    // 2. Headstock Internal Gears Rotation
    if (this.headstockGears && this.headstockGears.length > 0) {
      const motorRadPerSec = (this.engine.motorRpm * 2 * Math.PI) / 60.0;
      this.headstockGears.forEach((gear, idx) => {
        const dir = (idx % 2 === 0) ? 1 : -1;
        gear.rotation.x += motorRadPerSec * dt * dir * (0.6 + (idx % 3) * 0.18);
      });
    }

    // 3. Feed Rod & Lead Screw Rotation
    if (this.engine.feedShaftRpm > 0) {
      const feedShaftDelta = (this.engine.feedShaftRpm * 2 * Math.PI / 60.0) * dt;
      if (this.engine.feedMode === 'threading' && this.leadScrewMesh) {
        this.leadScrewMesh.rotation.x += feedShaftDelta;
      } else if (this.feedRodMesh) {
        this.feedRodMesh.rotation.x += feedShaftDelta;
      }
    }

    // 4. Live Center Rotation on Tailstock
    if (this.liveCenterMesh && this.engine.tailstockEngaged) {
      this.liveCenterMesh.rotation.x += rotationDelta;
    }

    // 5. Workpiece Geometry Sizing & Dynamic Stepped Turning
    const curDia = this.engine.workpieceDiameter;
    const curLen = Math.min(2200, Math.max(100, this.engine.workpieceLength));
    const radius = curDia / 2.0;

    // Chuck Jaws Dynamic Gripping: Jaws slide radially to grip workpiece circumference
    if (this.chuckJaws && this.chuckJaws.length === 4) {
      const jawOffset = Math.max(50, radius);
      this.chuckJaws.forEach(j => {
        j.base.position.y = jawOffset + 24;
        j.step1.position.y = jawOffset;
        j.step2.position.y = Math.max(25, jawOffset - 20);
      });
    }

    // Carriage Position along bed (Datum: Chuck Face at X = +50 mm!)
    const carXWorld = 50 + this.engine.carriageZ;
    if (this.carriageGroup) {
      this.carriageGroup.position.x = carXWorld;
    }

    // Cross-Slide Position along Z: moves tool insert to bite into workpiece
    const ap = this.engine.depthOfCut;
    if (this.crossSlideGroup) {
      if (this.engine.feedMode === 'cross') {
        const targetZ = Math.max(0, this.engine.crossSlideX);
        this.crossSlideGroup.position.z = targetZ - 10;
      } else {
        const targetZ = Math.max(10, radius - ap);
        this.crossSlideGroup.position.z = targetZ - 10;
      }
    }

    // Dynamic Workpiece Stepped Model (Precise unit cylinder scaling)
    const hasCut = ap > 0.05 && this.engine.carriageZ < curLen;

    if (hasCut) {
      // 1. Turned Finished Section: from chuck face (X = 0) to carriageZ
      const turnedLen = Math.max(1, Math.min(curLen, this.engine.carriageZ));
      const turnedRad = Math.max(5, radius - ap);

      this.turnedMesh.visible = true;
      this.turnedMesh.scale.set(turnedLen, turnedRad, turnedRad);
      this.turnedMesh.position.set(turnedLen / 2, 0, 0);

      // 2. Conical Transition Shoulder at carriageZ
      const shoulderLen = Math.min(6, Math.max(1, curLen - turnedLen));
      const showShoulder = shoulderLen > 0.5 && ap > 0.1;
      this.shoulderMesh.visible = showShoulder;
      if (showShoulder) {
        this.shoulderMesh.scale.set(shoulderLen, (turnedRad + radius) / 2, (turnedRad + radius) / 2);
        this.shoulderMesh.position.set(turnedLen + shoulderLen / 2, 0, 0);
      }

      // 3. Uncut Raw Stock Section: from shoulder to workpiece end (curLen)
      const rawStart = turnedLen + (showShoulder ? shoulderLen : 0);
      const rawLen = Math.max(0, curLen - rawStart);
      if (rawLen > 1.0) {
        this.rawStockMesh.visible = true;
        this.rawStockMesh.scale.set(rawLen, radius, radius);
        this.rawStockMesh.position.set(rawStart + rawLen / 2, 0, 0);
      } else {
        this.rawStockMesh.visible = false;
      }
    } else {
      // Entire bar is uncut raw stock from chuck face (X = 0) to end (X = curLen)
      this.turnedMesh.visible = false;
      this.shoulderMesh.visible = false;
      this.rawStockMesh.visible = true;
      this.rawStockMesh.scale.set(curLen, radius, radius);
      this.rawStockMesh.position.set(curLen / 2, 0, 0);
    }

    // 6. Tailstock Positioning & Live Center Engagement
    // Workpiece ends at X = 50 + curLen in world coordinates.
    // Live center tip is at local X = 0 in tailstockGroup.
    if (this.tailstockGroup) {
      if (this.engine.tailstockEngaged) {
        // Tip touches workpiece end hole with zero collision!
        this.tailstockGroup.position.set(50 + curLen, 1060, 0);
      } else {
        // Backed off / disengaged: 220 mm clear gap from the job
        this.tailstockGroup.position.set(50 + curLen + 220, 1060, 0);
      }
    }

    // 7. Dynamic Cutting Chips & Coolant Spray
    const isCutting = this.engine.tangentialForce > 10.0;
    this.updateCuttingParticles(carXWorld, radius - ap, isCutting, dt);
  }

  updateCuttingParticles(toolXWorld, toolZRadius, isCutting, dt) {
    const toolTipX = toolXWorld;
    const toolTipY = 1060; // Spindle center height
    const toolTipZ = toolZRadius; // Exact radial contact point

    // 1. Emit Metal Chips when cutting
    if (this.chipParticles && this.chipPool) {
      const posAttr = this.chipParticles.geometry.attributes.position;
      const colAttr = this.chipParticles.geometry.attributes.color;

      if (isCutting) {
        for (let k = 0; k < 3; k++) {
          const chip = this.chipPool.find(c => !c.active);
          if (chip) {
            chip.active = true;
            chip.life = 0;
            chip.maxLife = 0.35 + Math.random() * 0.2;
            chip.x = toolTipX + (Math.random() - 0.5) * 6;
            chip.y = toolTipY + (Math.random() - 0.5) * 6;
            chip.z = toolTipZ + (Math.random() - 0.5) * 6;

            // Fling trajectory: curls upward and back toward rear bed chip tray
            chip.vx = (Math.random() - 0.35) * 160;
            chip.vy = 260 + Math.random() * 220;
            chip.vz = -240 - Math.random() * 220;
          }
        }
      }

      for (let i = 0; i < this.chipPool.length; i++) {
        const c = this.chipPool[i];
        if (c.active) {
          c.life += dt;
          if (c.life >= c.maxLife) {
            c.active = false;
            posAttr.setY(i, -500);
          } else {
            c.vy -= 980 * dt; // Gravity
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.z += c.vz * dt;
            posAttr.setXYZ(i, c.x, c.y, c.z);

            // Incandescent color gradient (white-yellow -> orange -> dull red -> grey)
            const heat = 1.0 - (c.life / c.maxLife);
            colAttr.setXYZ(i, 1.0, 0.2 + 0.6 * heat, 0.1 * heat);
          }
        }
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // 2. Coolant Fluid Stream
    if (this.coolantParticles && this.coolantPool) {
      const cPosAttr = this.coolantParticles.geometry.attributes.position;

      if (this.engine.coolantOn) {
        for (let k = 0; k < 2; k++) {
          const drop = this.coolantPool.find(d => !d.active);
          if (drop) {
            drop.active = true;
            drop.life = 0;
            drop.maxLife = 0.28 + Math.random() * 0.15;
            drop.x = toolTipX + 15 + (Math.random() - 0.5) * 10;
            drop.y = toolTipY + 40;
            drop.z = toolTipZ + 20;

            // Stream directed at tool tip
            drop.vx = -45 + Math.random() * 25;
            drop.vy = -340 - Math.random() * 80;
            drop.vz = -180 - Math.random() * 60;
          }
        }
      }

      for (let i = 0; i < this.coolantPool.length; i++) {
        const d = this.coolantPool[i];
        if (d.active) {
          d.life += dt;
          if (d.life >= d.maxLife) {
            d.active = false;
            cPosAttr.setY(i, -500);
          } else {
            d.vy -= 420 * dt;
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.z += d.vz * dt;
            cPosAttr.setXYZ(i, d.x, d.y, d.z);
          }
        }
      }
      cPosAttr.needsUpdate = true;
    }
  }

  animate(time) {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000.0) : 0.02;
    this.lastTime = now;

    if (this.controls) {
      this.controls.update();
    }

    this.updateFromEngine(dt);

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * High-Precision Canvas 2D Fallback
   */
  initCanvasFallback() {
    this.container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.className = 'lathe-2d-canvas';
    this.container.appendChild(canvas);
    this.canvas2D = canvas;
    this.ctx2D = canvas.getContext('2d');

    const render2D = () => {
      if (!this.ctx2D) return;
      this.drawCanvas2D();
      requestAnimationFrame(render2D);
    };
    render2D();
  }

  drawCanvas2D() {
    const canvas = this.canvas2D;
    const ctx = this.ctx2D;
    if (!canvas || !ctx) return;

    canvas.width = this.container.clientWidth;
    canvas.height = this.container.clientHeight;
    const w = canvas.width;
    const h = canvas.height;

    // Dark control-room backdrop
    ctx.fillStyle = '#0c111a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#172233';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Machine Centerline
    const centerY = h * 0.48;
    ctx.strokeStyle = '#00d4ff33';
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bed & Guideways
    ctx.fillStyle = '#244c66';
    ctx.fillRect(80, centerY + 75, w - 160, 95);
    ctx.fillStyle = '#e4edf5'; // Ground ways
    ctx.fillRect(80, centerY + 65, w - 160, 10);

    // Headstock Housing
    ctx.fillStyle = '#244c66';
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.fillRect(80, centerY - 130, 200, 210);
    ctx.strokeRect(80, centerY - 130, 200, 210);

    // Cutaway Gear Window
    ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.fillRect(95, centerY - 115, 170, 75);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(95, centerY - 115, 170, 75);

    // Rotating 4-Jaw Chuck (Face at X = 330)
    const chuckW = 50;
    const chuckH = 220;
    ctx.fillStyle = '#3a4859';
    ctx.fillRect(280, centerY - chuckH / 2, chuckW, chuckH);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(280, centerY - chuckH / 2, chuckW, chuckH);

    // Stepped Chuck Jaws
    const rJaw = Math.min(90, Math.max(30, (this.engine.workpieceDiameter / 500) * 80));
    ctx.fillStyle = '#e4edf5';
    ctx.fillRect(295, centerY - rJaw - 15, 35, 15);
    ctx.fillRect(295, centerY + rJaw, 35, 15);

    // Dynamic Workpiece: Turned section vs Uncut Raw Stock
    const totalWpLen = Math.min(w * 0.42, 440);
    const rawDia = Math.max(30, (this.engine.workpieceDiameter / 500) * 85);
    const apPx = (this.engine.depthOfCut / 12) * 14;
    const turnedDia = Math.max(15, rawDia - apPx * 2);

    const carZFrac = Math.min(1.0, this.engine.carriageZ / this.engine.workpieceLength);
    const turnedLen = Math.max(10, carZFrac * totalWpLen);
    const rawLen = Math.max(0, totalWpLen - turnedLen);

    // 1. Turned Finished Section
    ctx.fillStyle = '#f5faff';
    ctx.fillRect(330, centerY - turnedDia / 2, turnedLen, turnedDia);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(330, centerY - turnedDia / 2, turnedLen, turnedDia);

    // 2. Uncut Raw Stock
    if (rawLen > 0) {
      ctx.fillStyle = '#76889b';
      ctx.fillRect(330 + turnedLen, centerY - rawDia / 2, rawLen, rawDia);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(330 + turnedLen, centerY - rawDia / 2, rawLen, rawDia);
    }

    // Carriage & 4-Way Tool Post with Carbide Insert
    const carX = 330 + turnedLen;
    ctx.fillStyle = '#1e2430';
    ctx.fillRect(carX - 25, centerY + rawDia / 2 + 10, 70, 75);

    // TiN Carbide Tool Insert
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(carX - 8, centerY + rawDia / 2 - apPx - 6, 16, 10);

    // Tailstock with Live Center
    const tsX = 330 + totalWpLen;
    ctx.fillStyle = '#244c66';
    ctx.fillRect(tsX + 25, centerY - 95, 110, 175);

    // Live Center Cone (Tip touches workpiece end at tsX with zero overlap!)
    ctx.fillStyle = '#e4edf5';
    ctx.beginPath();
    ctx.moveTo(tsX, centerY);
    ctx.lineTo(tsX + 25, centerY - 20);
    ctx.lineTo(tsX + 25, centerY + 20);
    ctx.closePath();
    ctx.fill();

    // Hot Chips Animation on Canvas 2D
    if (this.engine.tangentialForce > 10.0) {
      ctx.fillStyle = '#ff9900';
      for (let k = 0; k < 6; k++) {
        const cx = carX + (Math.random() - 0.5) * 10;
        const cy = centerY + rawDia / 2 - 10 - Math.random() * 25;
        ctx.fillRect(cx, cy, 3, 3);
      }
    }

    // Overlay Header
    ctx.fillStyle = '#00e5ff';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(`HMT ${this.engine.variantId} DIGITAL TWIN [CANVAS 2D FALLBACK]`, 20, 28);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`SPINDLE: ${this.engine.spindleRpm.toFixed(1)} RPM | Vc: ${this.engine.cuttingSpeed.toFixed(1)} m/min | STATE: ${this.engine.operatingState}`, 20, 48);
  }
}
