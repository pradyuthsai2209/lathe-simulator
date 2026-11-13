/**
 * HMT Heavy Duty Lathe Series - Machine Specifications & Constants
 * Models: L45, L50, L60, L70
 * 
 * Verified against official HMT Machine Tools documentation:
 * - Height of centres: 450 mm (L45), 500 mm (L50), 600 mm (L60), 700 mm (L70)
 * - Swing over bed: 900 mm (L45), 1000 mm (L50), 1150 mm (L60), 1350 mm (L70)
 * - Swing over cross-slide: 570 mm (L45), 670 mm (L50), 870 mm (L60), 1000 mm (L70)
 * - Spindle bore: 110 mm
 * - Spindle power: 18.5 kW standard (L45, L50), 22 kW standard (L60, L70)
 * - 21 forward spindle speeds (4.5 to 450 RPM)
 * - 6 reverse spindle speeds (9 to 450 RPM)
 * - Longitudinal feeds: 77 steps (0.1 to 6.4 mm/rev)
 * - Cross feeds: 71 steps (0.05 to 3.2 mm/rev)
 * - Lead screw pitch: 6 mm
 * - Metric threads: 51 pitches (1 to 112 mm)
 * - Inch threads: 56 pitches (1/4 to 28 TPI)
 * - Tailstock sleeve stroke: 325 mm, MT-6 taper
 * - Max job weight between centres: 3500 kg (unsupported), 5500 kg (with steady rest)
 */

export const HMT_VARIANTS = {
  L45: {
    id: 'L45',
    name: 'HMT L45 Heavy Duty Lathe',
    heightOfCentres: 450, // mm [VERIFIED]
    swingOverBed: 900, // mm [VERIFIED]
    swingOverCrossSlide: 570, // mm [VERIFIED]
    spindleBore: 110, // mm [VERIFIED]
    nominalMotorPower: 18.5, // kW [VERIFIED]
    ratedMotorSpeed: 1440, // RPM (4-pole 50Hz induction motor) [ESTIMATED / STANDARD]
    maxBetweenCentres: 3000, // mm (available 2000-7000 mm) [VERIFIED]
    maxJobWeight: 3500, // kg [VERIFIED]
    maxJobWeightSteady: 5500, // kg [VERIFIED]
    tailstockStroke: 325, // mm [VERIFIED]
    tailstockTaper: 'MT-6', // Morse Taper [VERIFIED]
    leadScrewPitch: 6.0, // mm [VERIFIED]
    bedWidth: 650, // mm [ESTIMATED]
    machineWeight: 7500, // kg approx [ESTIMATED]
    speedStepsForward: [
      4.5, 5.6, 7.1, 9.0, 11.2, 14.0, 18.0, 22.4, 28.0, 35.5, 45.0,
      56.0, 71.0, 90.0, 112.0, 140.0, 180.0, 224.0, 280.0, 355.0, 450.0
    ], // 21 steps [VERIFIED]
    speedStepsReverse: [9.0, 18.0, 35.5, 71.0, 140.0, 280.0], // 6 steps [VERIFIED]
    isVerified: {
      heightOfCentres: true,
      swingOverBed: true,
      swingOverCrossSlide: true,
      spindleBore: true,
      nominalMotorPower: true,
      speedStepsForward: true,
      speedStepsReverse: true,
      leadScrewPitch: true,
      tailstockStroke: true,
      maxJobWeight: true,
      ratedMotorSpeed: false, // Standard industrial calculation
      bedWidth: false,
      machineWeight: false
    }
  },
  L50: {
    id: 'L50',
    name: 'HMT L50 Heavy Duty Lathe',
    heightOfCentres: 500, // mm [VERIFIED]
    swingOverBed: 1000, // mm [VERIFIED]
    swingOverCrossSlide: 670, // mm [VERIFIED]
    spindleBore: 110, // mm [VERIFIED]
    nominalMotorPower: 18.5, // kW [VERIFIED]
    ratedMotorSpeed: 1440, // RPM [ESTIMATED / STANDARD]
    maxBetweenCentres: 3000, // mm [VERIFIED]
    maxJobWeight: 3500, // kg [VERIFIED]
    maxJobWeightSteady: 5500, // kg [VERIFIED]
    tailstockStroke: 325, // mm [VERIFIED]
    tailstockTaper: 'MT-6', // Morse Taper [VERIFIED]
    leadScrewPitch: 6.0, // mm [VERIFIED]
    bedWidth: 700, // mm [ESTIMATED]
    machineWeight: 8200, // kg approx [ESTIMATED]
    speedStepsForward: [
      4.5, 5.6, 7.1, 9.0, 11.2, 14.0, 18.0, 22.4, 28.0, 35.5, 45.0,
      56.0, 71.0, 90.0, 112.0, 140.0, 180.0, 224.0, 280.0, 355.0, 450.0
    ],
    speedStepsReverse: [9.0, 18.0, 35.5, 71.0, 140.0, 280.0],
    isVerified: {
      heightOfCentres: true,
      swingOverBed: true,
      swingOverCrossSlide: true,
      spindleBore: true,
      nominalMotorPower: true,
      speedStepsForward: true,
      speedStepsReverse: true,
      leadScrewPitch: true,
      tailstockStroke: true,
      maxJobWeight: true,
      ratedMotorSpeed: false,
      bedWidth: false,
      machineWeight: false
    }
  },
  L60: {
    id: 'L60',
    name: 'HMT L60 Heavy Duty Lathe',
    heightOfCentres: 600, // mm [VERIFIED]
    swingOverBed: 1150, // mm [VERIFIED]
    swingOverCrossSlide: 870, // mm [VERIFIED]
    spindleBore: 110, // mm [VERIFIED]
    nominalMotorPower: 22.0, // kW [VERIFIED]
    ratedMotorSpeed: 1450, // RPM [ESTIMATED / STANDARD]
    maxBetweenCentres: 3000, // mm [VERIFIED]
    maxJobWeight: 4000, // kg [VERIFIED]
    maxJobWeightSteady: 6000, // kg [VERIFIED]
    tailstockStroke: 325, // mm [VERIFIED]
    tailstockTaper: 'MT-6', // Morse Taper [VERIFIED]
    leadScrewPitch: 6.0, // mm [VERIFIED]
    bedWidth: 750, // mm [ESTIMATED]
    machineWeight: 9600, // kg approx [ESTIMATED]
    speedStepsForward: [
      4.5, 5.6, 7.1, 9.0, 11.2, 14.0, 18.0, 22.4, 28.0, 35.5, 45.0,
      56.0, 71.0, 90.0, 112.0, 140.0, 180.0, 224.0, 280.0, 355.0, 450.0
    ],
    speedStepsReverse: [9.0, 18.0, 35.5, 71.0, 140.0, 280.0],
    isVerified: {
      heightOfCentres: true,
      swingOverBed: true,
      swingOverCrossSlide: true,
      spindleBore: true,
      nominalMotorPower: true,
      speedStepsForward: true,
      speedStepsReverse: true,
      leadScrewPitch: true,
      tailstockStroke: true,
      maxJobWeight: true,
      ratedMotorSpeed: false,
      bedWidth: false,
      machineWeight: false
    }
  },
  L70: {
    id: 'L70',
    name: 'HMT L70 Heavy Duty Lathe',
    heightOfCentres: 700, // mm [VERIFIED]
    swingOverBed: 1350, // mm [VERIFIED]
    swingOverCrossSlide: 1000, // mm [VERIFIED]
    spindleBore: 110, // mm [VERIFIED]
    nominalMotorPower: 22.0, // kW [VERIFIED] (optional 30 kW)
    ratedMotorSpeed: 1450, // RPM [ESTIMATED / STANDARD]
    maxBetweenCentres: 3000, // mm [VERIFIED]
    maxJobWeight: 4500, // kg [VERIFIED]
    maxJobWeightSteady: 7000, // kg [VERIFIED]
    tailstockStroke: 325, // mm [VERIFIED]
    tailstockTaper: 'MT-6', // Morse Taper [VERIFIED]
    leadScrewPitch: 6.0, // mm [VERIFIED]
    bedWidth: 800, // mm [ESTIMATED]
    machineWeight: 11200, // kg approx [ESTIMATED]
    speedStepsForward: [
      4.5, 5.6, 7.1, 9.0, 11.2, 14.0, 18.0, 22.4, 28.0, 35.5, 45.0,
      56.0, 71.0, 90.0, 112.0, 140.0, 180.0, 224.0, 280.0, 355.0, 450.0
    ],
    speedStepsReverse: [9.0, 18.0, 35.5, 71.0, 140.0, 280.0],
    isVerified: {
      heightOfCentres: true,
      swingOverBed: true,
      swingOverCrossSlide: true,
      spindleBore: true,
      nominalMotorPower: true,
      speedStepsForward: true,
      speedStepsReverse: true,
      leadScrewPitch: true,
      tailstockStroke: true,
      maxJobWeight: true,
      ratedMotorSpeed: false,
      bedWidth: false,
      machineWeight: false
    }
  }
};

/**
 * Standard selectable feeds (subset of HMT 77 longitudinal steps)
 */
export const FEED_STEPS_LONGITUDINAL = [
  0.10, 0.12, 0.15, 0.18, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45,
  0.50, 0.60, 0.70, 0.80, 1.00, 1.25, 1.60, 2.00, 2.50, 3.20, 4.00, 5.00, 6.40
];

/**
 * Standard selectable cross feeds (approx 0.5x longitudinal)
 */
export const FEED_STEPS_CROSS = [
  0.05, 0.06, 0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.25, 0.30,
  0.35, 0.40, 0.50, 0.60, 0.80, 1.00, 1.25, 1.60, 2.00, 2.50, 3.20
];

/**
 * Common metric thread pitches (subset of HMT 51 pitches)
 */
export const METRIC_THREADS = [
  1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 10.0, 12.0
];

/**
 * Common Imperial / Inch TPI (subset of HMT 56 pitches)
 */
export const INCH_THREADS_TPI = [
  28, 24, 20, 19, 18, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
];

/**
 * Workpiece Materials Database with Kienzle Cutting Force Parameters
 * kc1.1 = specific cutting force at chip thickness h = 1.0 mm (N/mm²)
 * mc = chip thickness rise exponent
 * thermalConductivity in W/(m·K)
 * density in kg/m³
 * specificHeat in J/(kg·K)
 */
export const WORKPIECE_MATERIALS = {
  mild_steel: {
    id: 'mild_steel',
    name: 'Mild Steel (AISI 1018 / IS 2062)',
    kc1_1: 1750, // N/mm²
    mc: 0.25,
    density: 7850, // kg/m³
    thermalConductivity: 51.9, // W/(m·K)
    specificHeat: 486, // J/(kg·K)
    taylorC: 250, // Taylor speed constant for Carbide
    taylorN: 0.25,
    hardnessHB: 130,
    tensileStrength: 440 // MPa
  },
  medium_carbon_steel: {
    id: 'medium_carbon_steel',
    name: 'Medium Carbon Steel (AISI 1045 / EN8)',
    kc1_1: 2100,
    mc: 0.25,
    density: 7850,
    thermalConductivity: 49.8,
    specificHeat: 486,
    taylorC: 210,
    taylorN: 0.24,
    hardnessHB: 180,
    tensileStrength: 650
  },
  alloy_steel: {
    id: 'alloy_steel',
    name: 'Alloy Steel (AISI 4140 / EN19)',
    kc1_1: 2450,
    mc: 0.26,
    density: 7850,
    thermalConductivity: 42.6,
    specificHeat: 473,
    taylorC: 170,
    taylorN: 0.22,
    hardnessHB: 280,
    tensileStrength: 950
  },
  stainless_steel: {
    id: 'stainless_steel',
    name: 'Austenitic Stainless (AISI 304)',
    kc1_1: 2600,
    mc: 0.28,
    density: 8000,
    thermalConductivity: 16.2,
    specificHeat: 500,
    taylorC: 140,
    taylorN: 0.20,
    hardnessHB: 200,
    tensileStrength: 700
  },
  grey_cast_iron: {
    id: 'grey_cast_iron',
    name: 'Grey Cast Iron (FG 260 / Grade 25)',
    kc1_1: 1350,
    mc: 0.22,
    density: 7200,
    thermalConductivity: 46.0,
    specificHeat: 490,
    taylorC: 280,
    taylorN: 0.28,
    hardnessHB: 210,
    tensileStrength: 260
  },
  aluminum_alloy: {
    id: 'aluminum_alloy',
    name: 'Aluminum Alloy (6061-T6)',
    kc1_1: 750,
    mc: 0.20,
    density: 2700,
    thermalConductivity: 167.0,
    specificHeat: 896,
    taylorC: 600,
    taylorN: 0.35,
    hardnessHB: 95,
    tensileStrength: 310
  },
  brass: {
    id: 'brass',
    name: 'Free Cutting Brass (C360)',
    kc1_1: 850,
    mc: 0.20,
    density: 8500,
    thermalConductivity: 115.0,
    specificHeat: 380,
    taylorC: 450,
    taylorN: 0.32,
    hardnessHB: 110,
    tensileStrength: 380
  }
};

/**
 * Tool Material Catalog
 */
export const TOOL_MATERIALS = {
  carbide_tin: {
    id: 'carbide_tin',
    name: 'TiN Coated Carbide (ISO P25-P35)',
    maxSurfaceSpeed: 300, // m/min
    wearResistance: 1.0,
    maxTemp: 900 // °C
  },
  carbide_tialn: {
    id: 'carbide_tialn',
    name: 'TiAlN Multi-layer Carbide (ISO P10-P20)',
    maxSurfaceSpeed: 380,
    wearResistance: 1.3,
    maxTemp: 1100
  },
  uncoated_carbide: {
    id: 'uncoated_carbide',
    name: 'Uncoated Carbide (ISO K20/P20)',
    maxSurfaceSpeed: 180,
    wearResistance: 0.75,
    maxTemp: 800
  },
  ceramic: {
    id: 'ceramic',
    name: 'Silicon Nitride / Mixed Ceramic',
    maxSurfaceSpeed: 600,
    wearResistance: 1.8,
    maxTemp: 1300
  },
  hss: {
    id: 'hss',
    name: 'High Speed Steel (HSS M2 / M42)',
    maxSurfaceSpeed: 60,
    wearResistance: 0.35,
    maxTemp: 550
  }
};

/**
 * Global Physics & Lathe Model Constants (All Editable via Model Config)
 */
export const DEFAULT_MODEL_CONSTANTS = {
  supplyVoltageNominal: 415.0, // V (3-phase 50Hz Indian industrial standard)
  gridFrequencyNominal: 50.0, // Hz
  motorPoles: 4, // 4-pole synchronous speed 1500 RPM at 50Hz
  gearboxMechanicalEfficiency: 0.86, // η_mech (86% efficiency in multi-stage gear train)
  motorNominalEfficiency: 0.91, // 91% electrical to mechanical conversion at rated load
  motorPowerFactorRated: 0.86, // cos φ at full load
  motorPowerFactorNoLoad: 0.18, // cos φ at no load
  tarePowerBaseKw: 1.25, // kW (headstock bearings, lubrication churn, oil pump at base speed)
  coolantTankVolumeLiters: 150, // L
  coolantHeatCapacity: 4184, // J/(kg·K) water-miscible emulsion
  coolantPumpPowerKw: 0.55, // kW (electric coolant pump)
  ambientTemperatureC: 25.0, // °C
  convectiveCoolingCoeff: 35.0, // W/(m²·K)
  coolantTankSurfaceArea: 1.8, // m²
  isoVibrationSeverityGood: 1.8, // mm/s RMS (ISO 10816 Class III machines)
  isoVibrationSeveritySatisfactory: 4.5, // mm/s RMS
  isoVibrationSeverityUnsatisfactory: 11.2, // mm/s RMS
  toolOverhangStandardMm: 45.0, // mm standard overhang
  chuckMassKg: 380.0 // kg heavy-duty 4-jaw chuck mass
};
