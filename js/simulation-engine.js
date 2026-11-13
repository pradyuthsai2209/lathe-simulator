/**
 * HMT Lathe Simulation Engine
 * 
 * Deterministic fixed-step physics & telemetry engine.
 * Solves coupled mechanical, electrical, cutting force, thermal, and vibration equations.
 */

import { HMT_VARIANTS, WORKPIECE_MATERIALS, TOOL_MATERIALS, DEFAULT_MODEL_CONSTANTS } from './machine-specs.js';

export class SimulationEngine {
  constructor(variantId = 'L45') {
    this.constants = { ...DEFAULT_MODEL_CONSTANTS };
    this.variantId = variantId;
    this.variant = { ...HMT_VARIANTS[variantId] };

    // Fixed simulation step: 20ms (50 Hz update rate)
    this.dt = 0.02; // seconds
    this.simTime = 0.0;
    this.isRunning = true;

    // Machine Operator Controls State
    this.powerOn = true;
    this.spindleDirection = 1; // 1 = FWD, 0 = OFF/NEUTRAL, -1 = REV
    this.speedStepIndex = 15; // Default 140 RPM (index 15 in 21-step forward list)
    this.feedMode = 'longitudinal'; // 'neutral', 'longitudinal', 'cross', 'threading', 'drilling'
    this.feedRate = 0.30; // mm/rev (longitudinal, cross, or drilling)
    this.threadPitch = 3.0; // mm metric pitch or TPI
    this.threadType = 'metric'; // 'metric' or 'inch'
    this.depthOfCut = 3.0; // mm (ap)
    this.coolantOn = true;
    this.tailstockEngaged = true;

    // Workpiece & Tool Setup
    this.materialKey = 'medium_carbon_steel';
    this.workpieceMaterial = { ...WORKPIECE_MATERIALS[this.materialKey] };
    this.workpieceDiameter = 250.0; // mm (initial diameter)
    this.workpieceLength = 1200.0; // mm
    this.toolMaterialKey = 'carbide_tin';
    this.toolMaterial = { ...TOOL_MATERIALS[this.toolMaterialKey] };
    this.toolRakeAngle = 6.0; // degrees
    this.toolLeadAngle = 75.0; // degrees (entering angle kappa_r)
    this.toolNoseRadius = 1.2; // mm
    this.toolOverhang = 45.0; // mm (standard)
    this.toolFlankWear = 0.05; // mm (VB wear)

    // Position State (Coordinates in mm)
    // Z = distance along bed from chuck face (chuck face = 0)
    // X = radial position / diameter cut
    this.carriageZ = 450.0; // mm from chuck
    this.crossSlideX = this.workpieceDiameter / 2; // mm radial
    this.cutDepthAccumulated = 0.0;

    // Dynamic State Variables
    this.motorRpm = 0.0;
    this.gearboxInputRpm = 0.0;
    this.spindleRpm = 0.0;
    this.feedShaftRpm = 0.0;
    this.cuttingTorque = 0.0; // N·m
    this.spindlePower = 0.0; // kW
    this.motorInputPower = 0.0; // kW
    this.voltage = this.constants.supplyVoltageNominal; // V
    this.current = 0.0; // A
    this.driveFrequency = this.constants.gridFrequencyNominal; // Hz
    this.coolantTemp = this.constants.ambientTemperatureC; // °C
    this.cuttingZoneTemp = this.constants.ambientTemperatureC; // °C
    this.energyUseKwhRate = 0.0; // kW
    this.cumulativeEnergyKwh = 0.0; // kWh
    this.vibrationRms = 0.35; // mm/s
    this.spindleSpeedErrorRpm = 0.0; // RPM
    this.operatingState = 'STOPPED';

    // Calculated Secondary Metrics
    this.cuttingSpeed = 0.0; // Vc (m/min)
    this.tangentialForce = 0.0; // Fc (N)
    this.feedForce = 0.0; // Ff (N)
    this.radialForce = 0.0; // Fp (N)
    this.materialRemovalRate = 0.0; // MRR (cm³/min)
    this.specificCuttingForce = 0.0; // kc (N/mm²)
    this.surfaceRoughnessRa = 0.0; // µm
    this.estimatedToolLifeMin = 180.0; // min
    this.motorThermalLoadPercent = 0.0; // %

    // Safety Interlocks & Alerts
    this.activeInterlocks = [];
    this.interlockTripped = false;

    // Telemetry History Ring Buffer (up to 120 seconds at 50Hz = 6000 points)
    this.maxHistoryLength = 6000;
    this.history = [];
    this.isRecording = true;

    // Listeners for UI notification
    this.listeners = [];
  }

  setVariant(variantId) {
    if (!HMT_VARIANTS[variantId]) return;
    this.variantId = variantId;
    this.variant = { ...HMT_VARIANTS[variantId] };
    // Clamp speed step if needed
    if (this.speedStepIndex >= this.variant.speedStepsForward.length) {
      this.speedStepIndex = this.variant.speedStepsForward.length - 1;
    }
  }

  setMaterial(materialKey) {
    if (WORKPIECE_MATERIALS[materialKey]) {
      this.materialKey = materialKey;
      this.workpieceMaterial = { ...WORKPIECE_MATERIALS[materialKey] };
    }
  }

  setToolMaterial(toolKey) {
    if (TOOL_MATERIALS[toolKey]) {
      this.toolMaterialKey = toolKey;
      this.toolMaterial = { ...TOOL_MATERIALS[toolKey] };
    }
  }

  updateConstants(newConstants) {
    this.constants = { ...this.constants, ...newConstants };
  }

  updateVariantSpecs(variantId, newSpecs) {
    if (HMT_VARIANTS[variantId]) {
      HMT_VARIANTS[variantId] = { ...HMT_VARIANTS[variantId], ...newSpecs };
      if (this.variantId === variantId) {
        this.variant = { ...HMT_VARIANTS[variantId] };
      }
    }
  }

  reset(clearEnergy = false) {
    this.simTime = 0.0;
    this.motorRpm = 0.0;
    this.spindleRpm = 0.0;
    this.gearboxInputRpm = 0.0;
    this.feedShaftRpm = 0.0;
    this.cuttingTorque = 0.0;
    this.spindlePower = 0.0;
    this.motorInputPower = 0.0;
    this.voltage = this.constants.supplyVoltageNominal;
    this.current = 0.0;
    this.coolantTemp = this.constants.ambientTemperatureC;
    this.cuttingZoneTemp = this.constants.ambientTemperatureC;
    this.vibrationRms = 0.35;
    this.spindleSpeedErrorRpm = 0.0;
    this.carriageZ = 450.0;
    this.crossSlideX = this.workpieceDiameter / 2;
    this.cutDepthAccumulated = 0.0;
    this.activeInterlocks = [];
    this.interlockTripped = false;
    this.operatingState = 'STOPPED';
    if (clearEnergy) {
      this.cumulativeEnergyKwh = 0.0;
    }
    this.history = [];
  }

  /**
   * Main Simulation Step Execution
   */
  step(manualDt = null) {
    const dt = manualDt || this.dt;

    if (!this.isRunning) return this.getTelemetrySnapshot();

    this.simTime += dt;

    // Check Safety Interlocks first
    this.evaluateInterlocks();

    // 1. Spindle Nominal Demand Speed
    const forwardSteps = this.variant.speedStepsForward;
    const reverseSteps = this.variant.speedStepsReverse;
    let nominalSpindleRpm = 0.0;

    if (this.powerOn && !this.interlockTripped && this.spindleDirection !== 0) {
      if (this.spindleDirection > 0) {
        nominalSpindleRpm = forwardSteps[Math.min(this.speedStepIndex, forwardSteps.length - 1)] || 140.0;
      } else {
        const revIdx = Math.min(this.speedStepIndex % reverseSteps.length, reverseSteps.length - 1);
        nominalSpindleRpm = reverseSteps[revIdx] || 140.0;
      }
    }

    // 2. Kinematic Gearbox Ratio
    // Rated induction motor speed is ~1440-1450 RPM
    const ratedMotorSpeed = this.variant.ratedMotorSpeed || 1440.0;
    const gearboxRatio = nominalSpindleRpm > 0 ? (ratedMotorSpeed / nominalSpindleRpm) : 10.0;

    // 3. Workpiece Inertia Calculation
    // Cylinder: J = 0.5 * m * r²
    const radiusM = (this.workpieceDiameter / 2) / 1000.0;
    const lengthM = this.workpieceLength / 1000.0;
    const volumeM3 = Math.PI * radiusM * radiusM * lengthM;
    const workpieceMassKg = volumeM3 * this.workpieceMaterial.density;
    const jWorkpiece = 0.5 * workpieceMassKg * radiusM * radiusM;
    const jChuck = 0.5 * this.constants.chuckMassKg * 0.35 * 0.35; // chuck diameter ~700mm
    const jTotalSpindle = Math.max(8.0, jChuck + jWorkpiece);

    // 4. Cutting Mechanics & Conditions
    let isCutting = false;
    let actualAp = 0.0;
    let actualFeed = 0.0;

    if (nominalSpindleRpm > 0 && Math.abs(this.spindleRpm) > 5.0 && !this.interlockTripped) {
      if (this.feedMode === 'longitudinal' || this.feedMode === 'cross') {
        actualAp = Math.max(0.0, this.depthOfCut);
        actualFeed = Math.max(0.0, this.feedRate);
        isCutting = actualAp > 0.0 && actualFeed > 0.0;
      } else if (this.feedMode === 'threading') {
        actualAp = Math.min(this.depthOfCut, 1.5); // Threading infeed per pass
        actualFeed = this.threadPitch; // mm/rev
        isCutting = actualAp > 0.0;
      } else if (this.feedMode === 'drilling') {
        actualAp = Math.max(0.0, this.depthOfCut);
        actualFeed = Math.max(0.0, this.feedRate);
        isCutting = actualAp > 0.0 && actualFeed > 0.0;
      }
    }

    // Cutting Speed Vc = π * D * N / 1000 (m/min)
    let activeDiameter = Math.max(20.0, this.workpieceDiameter - 2 * this.cutDepthAccumulated);
    if (this.feedMode === 'cross') {
      activeDiameter = Math.max(15.0, 2.0 * this.crossSlideX);
    } else if (this.feedMode === 'drilling') {
      activeDiameter = Math.max(12.0, this.depthOfCut * 10.0); // Drill diameter
    }
    this.cuttingSpeed = (Math.PI * activeDiameter * Math.abs(this.spindleRpm)) / 1000.0;

    // Kienzle Cutting Force Equation
    if (isCutting) {
      const kappaRad = (this.toolLeadAngle * Math.PI) / 180.0;
      const chipThicknessH = Math.max(0.01, actualFeed * Math.sin(kappaRad));
      const chipWidthB = actualAp / Math.sin(kappaRad);

      // Tool geometry rake angle correction factor (1 - gamma/100)
      const rakeFactor = 1.0 - (this.toolRakeAngle / 100.0);

      // Tool wear correction factor: Flank wear VB increases friction force
      const wearFactor = 1.0 + 0.40 * (this.toolFlankWear / 0.4);

      // Coolant lubrication factor: flood coolant reduces friction
      const coolantFactor = this.coolantOn ? 0.88 : 1.00;

      // Specific cutting force kc (N/mm²)
      const kc1_1 = this.workpieceMaterial.kc1_1;
      const mc = this.workpieceMaterial.mc;
      this.specificCuttingForce = kc1_1 * Math.pow(chipThicknessH, -mc) * rakeFactor * wearFactor * coolantFactor;

      // Tangential cutting force Fc (N) & Spindle Power Pc (kW)
      if (this.feedMode === 'drilling') {
        // Tailstock core/twist drilling: hole diameter D_drill = activeDiameter
        const dDrill = activeDiameter;
        // Two cutting lips: drilling torque M = (1/5500) * kc * f * D² (N·m)
        this.cuttingTorque = (this.specificCuttingForce * actualFeed * (dDrill * dDrill)) / 5500.0;
        const omega = (2.0 * Math.PI * Math.abs(this.spindleRpm)) / 60.0;
        this.spindlePower = (this.cuttingTorque * omega) / 1000.0;
        this.tangentialForce = (2.0 * this.cuttingTorque) / (dDrill / 1000.0);
        this.feedForce = this.specificCuttingForce * actualAp * actualFeed * 0.85; // High axial thrust
        this.radialForce = 0.05 * this.tangentialForce; // Symmetrical opposing lips cancel radial forces
        this.materialRemovalRate = (Math.PI / 4.0) * (dDrill * dDrill / 100.0) * (actualFeed * Math.abs(this.spindleRpm) / 10.0);
      } else {
        this.tangentialForce = this.specificCuttingForce * actualAp * actualFeed;
        this.feedForce = 0.38 * this.tangentialForce * Math.cos(kappaRad);
        this.radialForce = 0.28 * this.tangentialForce * Math.sin(kappaRad);
        // Cutting torque on spindle (N·m)
        this.cuttingTorque = this.tangentialForce * (activeDiameter / 2000.0);
        // Spindle cutting power Pc (kW)
        this.spindlePower = (this.tangentialForce * this.cuttingSpeed) / 60000.0;
        // Material removal rate MRR (cm³/min)
        this.materialRemovalRate = this.cuttingSpeed * actualAp * actualFeed;
      }

      // Estimated tool surface roughness Ra ≈ f² / (32 * r_eps) in µm
      this.surfaceRoughnessRa = Math.max(0.4, (actualFeed * actualFeed) / (32.0 * (this.toolNoseRadius / 1000.0)));

      // Taylor Tool Life: V * T^n = C  => T = (C / V)^(1/n)
      if (this.cuttingSpeed > 5.0) {
        const C = this.workpieceMaterial.taylorC * (this.toolMaterial.wearResistance || 1.0);
        const n = this.workpieceMaterial.taylorN;
        this.estimatedToolLifeMin = Math.min(600.0, Math.max(1.0, Math.pow(C / this.cuttingSpeed, 1.0 / n)));
      }
    } else {
      this.specificCuttingForce = 0.0;
      this.tangentialForce = 0.0;
      this.feedForce = 0.0;
      this.radialForce = 0.0;
      this.cuttingTorque = 0.0;
      this.spindlePower = 0.0;
      this.materialRemovalRate = 0.0;
      this.surfaceRoughnessRa = 0.0;
    }

    // 5. Motor Tare Friction Power & Drive Coupling
    // Base tare power of heavy lathe headstock gears and bearings at given RPM
    const speedRatio = nominalSpindleRpm > 0 ? (nominalSpindleRpm / 450.0) : 0.0;
    const tarePower = nominalSpindleRpm > 0 ? (this.constants.tarePowerBaseKw * (0.6 + 0.4 * speedRatio)) : 0.0;

    // Total required mechanical power at motor shaft
    const totalMechPower = (this.spindlePower / this.constants.gearboxMechanicalEfficiency) + tarePower;

    // 6. Motor Induction Slip & Actual RPM
    // Standard induction motor slip curve: slip = ratedSlip * (P_mech / P_rated)
    const ratedPower = this.variant.nominalMotorPower;
    const loadFraction = totalMechPower / Math.max(5.0, ratedPower);
    const slip = 0.035 * Math.min(2.5, loadFraction); // Slip increases under load
    const syncMotorRpm = (120.0 * this.constants.gridFrequencyNominal) / this.constants.motorPoles; // 1500 RPM
    const loadedMotorRpm = syncMotorRpm * (1.0 - slip);

    // Target spindle speed accounting for loaded motor speed and transmission
    const targetSpindleRpm = nominalSpindleRpm > 0 ? (loadedMotorRpm / gearboxRatio) * Math.sign(this.spindleDirection) : 0.0;

    // Inertial spin-up / spin-down ramp
    // Heavy headstock takes ~1.5 - 2.5 seconds to reach full speed
    const rampRate = (nominalSpindleRpm > 0) ? (ratedPower * 18.0 / jTotalSpindle) : 80.0; // RPM/s
    if (this.spindleRpm < targetSpindleRpm) {
      this.spindleRpm = Math.min(targetSpindleRpm, this.spindleRpm + rampRate * dt);
    } else if (this.spindleRpm > targetSpindleRpm) {
      this.spindleRpm = Math.max(targetSpindleRpm, this.spindleRpm - rampRate * dt);
    }

    // Motor and Gearbox Speeds
    this.motorRpm = Math.abs(this.spindleRpm * gearboxRatio);
    this.gearboxInputRpm = this.motorRpm * 0.995; // 0.5% belt slip

    // Spindle Speed Error / Slip (RPM difference from nominal)
    this.spindleSpeedErrorRpm = nominalSpindleRpm > 0 ? (nominalSpindleRpm - Math.abs(this.spindleRpm)) : 0.0;

    // Feed Shaft RPM (Feed rod or Lead screw)
    if (this.feedMode === 'longitudinal' || this.feedMode === 'cross') {
      // Feed rod drives apron gearbox
      this.feedShaftRpm = Math.abs(this.spindleRpm) * (this.feedRate / 1.0);
    } else if (this.feedMode === 'threading') {
      // Lead screw rotation: N_leadscrew = N_spindle * (Pitch_cut / Pitch_leadscrew)
      const leadPitch = this.variant.leadScrewPitch || 6.0;
      this.feedShaftRpm = Math.abs(this.spindleRpm) * (this.threadPitch / leadPitch);
    } else {
      this.feedShaftRpm = 0.0;
    }

    // 7. Tool & Carriage Feed Kinematics
    if (isCutting && Math.abs(this.spindleRpm) > 5.0) {
      const revsThisStep = (Math.abs(this.spindleRpm) / 60.0) * dt;
      if (this.feedMode === 'longitudinal' || this.feedMode === 'threading') {
        const feedStepMm = actualFeed * revsThisStep;
        this.carriageZ = Math.max(30.0, this.carriageZ - feedStepMm); // Feeding towards chuck
      } else if (this.feedMode === 'cross') {
        const crossStepMm = actualFeed * revsThisStep;
        this.crossSlideX = Math.max(0.0, this.crossSlideX - crossStepMm);
        this.cutDepthAccumulated += crossStepMm * 0.1;
      }
    }

    // 8. Electrical Dynamics
    if (this.powerOn && Math.abs(this.spindleRpm) > 1.0) {
      // Motor electrical efficiency curve
      const etaElec = Math.max(0.65, Math.min(0.93, this.constants.motorNominalEfficiency * (0.75 + 0.25 * Math.min(1.0, loadFraction))));
      let pumpPower = this.coolantOn ? this.constants.coolantPumpPowerKw : 0.0;
      this.motorInputPower = (totalMechPower / etaElec) + pumpPower;

      // Power Factor (cos φ): 0.18 at idle, up to 0.86 at full load
      const powerFactor = Math.min(0.88, Math.max(0.18, this.constants.motorPowerFactorNoLoad + 
        (this.constants.motorPowerFactorRated - this.constants.motorPowerFactorNoLoad) * Math.sqrt(Math.min(1.5, loadFraction))));

      // 3-Phase Line Current: I = (P_elec * 1000) / (sqrt(3) * V_L * cos φ)
      // Slight supply line drop under heavy load
      this.voltage = this.constants.supplyVoltageNominal - (loadFraction > 1.0 ? (loadFraction - 1.0) * 8.0 : 0.0);
      this.current = (this.motorInputPower * 1000.0) / (Math.sqrt(3.0) * this.voltage * powerFactor);

      // Grid / Drive Frequency
      this.driveFrequency = this.constants.gridFrequencyNominal;

      // Motor Thermal Load %
      this.motorThermalLoadPercent = (this.motorInputPower / ratedPower) * 100.0;
    } else {
      this.motorInputPower = this.powerOn ? 0.08 : 0.0; // Control electronics standby ~80W
      this.voltage = this.powerOn ? this.constants.supplyVoltageNominal : 0.0;
      this.current = this.powerOn ? 0.35 : 0.0;
      this.driveFrequency = this.powerOn ? this.constants.gridFrequencyNominal : 0.0;
      this.motorThermalLoadPercent = 0.0;
    }

    // Energy consumption accumulation
    // Instantaneous power in kW, rate in kWh/s, integrated into cumulative kWh
    this.energyUseKwhRate = this.motorInputPower;
    this.cumulativeEnergyKwh += (this.motorInputPower / 3600.0) * dt;

    // 9. Thermal Modeling
    if (isCutting && this.spindlePower > 0.1) {
      // Heat generation in cutting zone ~95% of cutting energy
      const qGenKw = 0.95 * this.spindlePower;

      // Loewen & Shaw flash temperature model
      const rhoCp = this.workpieceMaterial.density * this.workpieceMaterial.specificHeat;
      const kThermal = this.workpieceMaterial.thermalConductivity;
      const alphaThermal = (kThermal / rhoCp) * 1e6; // thermal diffusivity mm²/s

      const flashDeltaT = (0.38 * this.specificCuttingForce / 1000.0) * 
        Math.pow(Math.max(1.0, this.cuttingSpeed * actualFeed) / Math.max(1.0, alphaThermal), 0.33) * 120.0;

      // Coolant cooling mitigation
      const coolantDrop = this.coolantOn ? 0.45 : 1.0;
      const targetCzTemp = this.constants.ambientTemperatureC + flashDeltaT * coolantDrop;

      // Thermal response time constant for cutting zone ~ 0.5s
      this.cuttingZoneTemp += (targetCzTemp - this.cuttingZoneTemp) * (dt / 0.5);

      // Coolant bulk tank heating: coolant absorbs ~45% of cutting zone heat when ON
      if (this.coolantOn) {
        const qToCoolant = qGenKw * 0.45 * 1000.0; // Watts
        const coolantMass = this.constants.coolantTankVolumeLiters * 1.0; // ~150 kg
        const coolantCp = this.constants.coolantHeatCapacity; // J/(kg·K)
        const heatLoss = this.constants.convectiveCoolingCoeff * this.constants.coolantTankSurfaceArea * 
                         (this.coolantTemp - this.constants.ambientTemperatureC);
        const dCoolantTemp = ((qToCoolant - heatLoss) / (coolantMass * coolantCp)) * dt;
        this.coolantTemp += dCoolantTemp;
      }
    } else {
      // Natural convective cooldown towards ambient
      this.cuttingZoneTemp += (this.constants.ambientTemperatureC - this.cuttingZoneTemp) * (dt / 4.0);
      this.coolantTemp += (this.constants.ambientTemperatureC - this.coolantTemp) * (dt / 30.0);
    }

    // 10. Vibration RMS Modeling (ISO 10816 Heavy Machine Tool)
    // Base vibration due to rotating unbalance of chuck & spindle
    const unbalanceVib = 0.25 + 0.003 * Math.abs(this.spindleRpm);

    // Cutting vibration: dynamic force component and regenerative chatter
    let cuttingVib = 0.0;
    if (isCutting) {
      // Dynamic force component ~ 8% of tangential cutting force
      // Dynamic cutting force ratio
      const forceRatio = Math.min(2.5, this.tangentialForce / 5000.0);
      
      // Overhang flexibility factor: Deflection δ ∝ (L_overhang)³ / (3EI)
      // Heavy lathe tool holder (32x32 mm or 40x40 mm shank) has high rigidity
      const overhangRatio = this.toolOverhang / this.constants.toolOverhangStandardMm;
      const overhangFactor = Math.pow(overhangRatio, 1.6);

      // Process damping at low surface speed (Vc < 60 m/min) stabilizes heavy roughing cuts
      const processDamping = 1.0 + Math.max(0.0, (60.0 - this.cuttingSpeed) / 25.0);
      const stabilityLimitAp = (9.0 / overhangFactor) * processDamping;
      let chatterFactor = 1.0;
      if (actualAp > stabilityLimitAp) {
        chatterFactor = 1.0 + 1.8 * Math.min(4.0, (actualAp - stabilityLimitAp));
      }

      // Tool wear vibration booster
      const wearVib = 1.0 + 0.8 * (this.toolFlankWear / 0.4);

      // Balanced cutting in drilling: opposing lips cancel lateral radial vibrations
      const vibModeFactor = this.feedMode === 'drilling' ? 0.40 : 1.0;

      // Cutting vibration in mm/s RMS (ISO 10816 Class III)
      cuttingVib = forceRatio * 1.55 * overhangFactor * chatterFactor * wearVib * vibModeFactor;
      if (!this.coolantOn) {
        cuttingVib *= 1.25; // Dry friction excitation
      }
      cuttingVib = Math.min(24.0, cuttingVib);
    }

    // Workpiece Slenderness / Unbalance vibration if unsupported L/D is high
    const ldRatio = this.workpieceLength / this.workpieceDiameter;
    const tailstockFactor = (!this.tailstockEngaged && ldRatio > 3.0) ? (ldRatio * 0.4) : 0.0;

    const targetVibration = Math.min(26.0, unbalanceVib + cuttingVib + tailstockFactor);
    // Vibration smoothing
    this.vibrationRms += (targetVibration - this.vibrationRms) * (dt / 0.15);

    // 11. Determine Operating State Label
    this.determineOperatingState(nominalSpindleRpm, isCutting, actualAp);

    // 12. Record to Telemetry History
    if (this.isRecording) {
      this.recordTelemetrySnapshot();
    }

    // Notify listeners
    this.notifyListeners();

    return this.getTelemetrySnapshot();
  }

  determineOperatingState(nominalSpindleRpm, isCutting, actualAp) {
    if (this.interlockTripped) {
      this.operatingState = 'INTERLOCK_TRIP';
    } else if (!this.powerOn) {
      this.operatingState = 'POWER_OFF';
    } else if (this.spindleDirection === 0 || Math.abs(this.spindleRpm) < 2.0) {
      this.operatingState = 'STOPPED';
    } else if (Math.abs(this.spindleRpm) < nominalSpindleRpm * 0.85) {
      this.operatingState = 'SPINDLE_ACCEL';
    } else if (this.motorThermalLoadPercent > 105.0) {
      this.operatingState = 'MOTOR_OVERLOAD';
    } else if (this.vibrationRms > this.constants.isoVibrationSeverityUnsatisfactory) {
      this.operatingState = 'CHATTER_EXCITED';
    } else if (isCutting) {
      if (this.feedMode === 'threading') {
        this.operatingState = 'THREADING';
      } else if (this.feedMode === 'cross') {
        this.operatingState = 'FACING';
      } else if (actualAp >= 6.0) {
        this.operatingState = 'HEAVY_ROUGHING';
      } else if (actualAp >= 2.0) {
        this.operatingState = 'TURNING_ROUGH';
      } else {
        this.operatingState = 'TURNING_FINISH';
      }
    } else {
      this.operatingState = 'SPINDLE_IDLE';
    }
  }

  evaluateInterlocks() {
    this.activeInterlocks = [];

    // Interlock 1: Spindle running gear shifting prevention
    // (Handled at lever change event; if forced, set trip)

    // Interlock 2: Half-Nut & Feed Rod simultaneous engagement lockout
    // (Checked when setting feedMode)

    // Interlock 3: Chuck max centrifugal speed warning for large diameter
    if (this.workpieceDiameter > 600.0 && Math.abs(this.spindleRpm) > 200.0) {
      this.activeInterlocks.push({
        code: 'CHUCK_CENTRIFUGAL_LIMIT',
        level: 'WARNING',
        message: 'High centrifugal force on heavy chuck jaws! Reduce spindle RPM for workpiece diameter > 600 mm.'
      });
    }

    // Interlock 4: Tailstock center support required when L/D > 3.0
    const ldRatio = this.workpieceLength / this.workpieceDiameter;
    if (ldRatio > 3.0 && !this.tailstockEngaged) {
      this.activeInterlocks.push({
        code: 'TAILSTOCK_SUPPORT_REQUIRED',
        level: 'DANGER',
        message: `Slenderness ratio L/D = ${ldRatio.toFixed(1)} > 3.0 without tailstock center support. High risk of deflection or workpiece ejection!`
      });
    }

    // Interlock 5: Carriage collision boundary
    if (this.carriageZ <= 45.0) {
      this.activeInterlocks.push({
        code: 'CARRIAGE_COLLISION_STOP',
        level: 'CRITICAL',
        message: 'Carriage reached safety limit near chuck face (Z <= 45mm)! Emergency feed stop engaged.'
      });
      // Disengage feeds
      this.feedMode = 'neutral';
    }

    // Interlock 6: Motor Thermal Overload
    if (this.motorThermalLoadPercent > 125.0) {
      this.activeInterlocks.push({
        code: 'MOTOR_THERMAL_OVERLOAD',
        level: 'CRITICAL',
        message: `Spindle motor current exceeded thermal rating (${this.current.toFixed(1)} A / ${this.motorThermalLoadPercent.toFixed(0)}%). Reduce depth of cut!`
      });
      if (this.motorThermalLoadPercent > 145.0) {
        this.interlockTripped = true;
      }
    } else {
      this.interlockTripped = false;
    }
  }

  /**
   * Set Spindle Speed Step with Gear Shift Interlock Check
   */
  setSpeedStep(index) {
    if (Math.abs(this.spindleRpm) > 8.0) {
      // Cannot shift gear while spindle is running
      this.activeInterlocks.push({
        code: 'GEAR_SHIFT_RUNNING_ERROR',
        level: 'WARNING',
        message: 'HEADSTOCK INTERLOCK: Cannot shift speed gearbox gears while spindle is in motion! Stop spindle first.'
      });
      return false;
    }
    const maxSteps = this.variant.speedStepsForward.length;
    this.speedStepIndex = Math.max(0, Math.min(index, maxSteps - 1));
    return true;
  }

  /**
   * Set Feed Mode with Apron Lockout Check
   */
  setFeedMode(mode) {
    // Both feed rod and lead-screw cannot be engaged simultaneously
    if (mode === 'threading' && (this.feedMode === 'longitudinal' || this.feedMode === 'cross')) {
      // Lockout is mechanically enforced in the HMT apron
      this.feedMode = 'threading';
    } else {
      this.feedMode = mode;
    }
  }

  /**
   * Captures a single 19-channel telemetry frame
   */
  getTelemetrySnapshot() {
    const forwardSteps = this.variant.speedStepsForward;
    const speedStepStr = `${this.speedStepIndex + 1} (${forwardSteps[this.speedStepIndex] || 140} RPM)`;

    return {
      // 19 Primary Reference Channels
      timeS: parseFloat(this.simTime.toFixed(2)),
      operatingState: this.operatingState,
      motorRpm: parseFloat(this.motorRpm.toFixed(1)),
      gearboxInputRpm: parseFloat(this.gearboxInputRpm.toFixed(1)),
      spindleRpm: parseFloat(this.spindleRpm.toFixed(1)),
      feedShaftRpm: parseFloat(this.feedShaftRpm.toFixed(1)),
      cuttingTorqueNm: parseFloat(this.cuttingTorque.toFixed(2)),
      spindlePowerKw: parseFloat(this.spindlePower.toFixed(2)),
      motorInputPowerKw: parseFloat(this.motorInputPower.toFixed(2)),
      voltageV: parseFloat(this.voltage.toFixed(1)),
      currentA: parseFloat(this.current.toFixed(1)),
      driveFrequencyHz: parseFloat(this.driveFrequency.toFixed(1)),
      speedStep: speedStepStr,
      coolantTempC: parseFloat(this.coolantTemp.toFixed(1)),
      cuttingZoneTempC: parseFloat(this.cuttingZoneTemp.toFixed(1)),
      energyUseKwh: parseFloat(this.energyUseKwhRate.toFixed(3)),
      cumulativeEnergyKwh: parseFloat(this.cumulativeEnergyKwh.toFixed(4)),
      vibrationRmsMmS: parseFloat(this.vibrationRms.toFixed(2)),
      spindleSpeedErrorRpm: parseFloat(this.spindleSpeedErrorRpm.toFixed(1)),

      // Secondary & Geometric Metrics
      cuttingSpeedMMin: parseFloat(this.cuttingSpeed.toFixed(1)),
      tangentialForceN: parseFloat(this.tangentialForce.toFixed(1)),
      feedForceN: parseFloat(this.feedForce.toFixed(1)),
      radialForceN: parseFloat(this.radialForce.toFixed(1)),
      mrrCm3Min: parseFloat(this.materialRemovalRate.toFixed(1)),
      specificCuttingForceNmm2: parseFloat(this.specificCuttingForce.toFixed(1)),
      surfaceRoughnessRaUm: parseFloat(this.surfaceRoughnessRa.toFixed(2)),
      estimatedToolLifeMin: parseFloat(this.estimatedToolLifeMin.toFixed(0)),
      motorThermalLoadPercent: parseFloat(this.motorThermalLoadPercent.toFixed(1)),
      carriageZ: parseFloat(this.carriageZ.toFixed(1)),
      crossSlideX: parseFloat(this.crossSlideX.toFixed(1)),
      variantId: this.variantId,
      feedRate: this.feedRate,
      depthOfCut: this.depthOfCut,
      activeInterlocks: this.activeInterlocks
    };
  }

  recordTelemetrySnapshot() {
    const snap = this.getTelemetrySnapshot();
    this.history.push(snap);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    for (let i = 0; i < this.listeners.length; i++) {
      try {
        this.listeners[i](this);
      } catch (e) {
        console.error('Error in simulation engine listener:', e);
      }
    }
  }
}
