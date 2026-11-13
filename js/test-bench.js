/**
 * Test Cases & Data Bench Suite
 * 
 * Manages repeatable industrial test cases, automated execution,
 * pass/fail evaluation, time-series telemetry inspection, pagination,
 * multi-test overlay comparisons, and dataset CSV export.
 */

import { generateLatheTelemetryCSV, downloadCSV } from './csv-exporter.js';

export const DEFAULT_TEST_CASES = [
  {
    id: 'TC-01',
    name: 'Spindle Idle Baseline & No-Load Tare Power',
    category: 'Baseline',
    variantId: 'L45',
    speedStepIndex: 15, // 140 RPM (index 15)
    feedMode: 'neutral',
    feedRate: 0.0,
    depthOfCut: 0.0,
    materialKey: 'mild_steel',
    coolantOn: false,
    tailstockEngaged: true,
    toolOverhang: 45.0,
    toolFlankWear: 0.02,
    durationS: 8.0,
    description: 'Establishes mechanical tare friction power and baseline vibration at 140 RPM without cutting load.',
    criteria: [
      { channel: 'spindleRpm', op: '>=', value: 138.0, label: 'Spindle RPM >= 138' },
      { channel: 'motorInputPowerKw', op: '<=', value: 3.5, label: 'Tare Motor Power <= 3.5 kW' },
      { channel: 'vibrationRmsMmS', op: '<=', value: 1.5, label: 'Baseline Vibration <= 1.5 mm/s' }
    ]
  },
  {
    id: 'TC-02',
    name: 'Workpiece Facing Operation (Variable Surface Speed)',
    category: 'Machining',
    variantId: 'L45',
    speedStepIndex: 13, // 90 RPM (index 13)
    feedMode: 'cross',
    feedRate: 0.25,
    depthOfCut: 2.0,
    materialKey: 'medium_carbon_steel',
    coolantOn: true,
    tailstockEngaged: true,
    toolOverhang: 45.0,
    toolFlankWear: 0.05,
    durationS: 10.0,
    description: 'Simulates radial facing pass from outer diameter inwards toward center axis with cross-feed.',
    criteria: [
      { channel: 'motorInputPowerKw', op: '<=', value: 10.0, label: 'Motor Power <= 10.0 kW' },
      { channel: 'cuttingZoneTempC', op: '<=', value: 350.0, label: 'Cutting Zone Temp <= 350°C' }
    ]
  },
  {
    id: 'TC-03',
    name: 'Medium Straight Turning (AISI 1045)',
    category: 'Machining',
    variantId: 'L50',
    speedStepIndex: 12, // 71 RPM (index 12)
    feedMode: 'longitudinal',
    feedRate: 0.35,
    depthOfCut: 4.0,
    materialKey: 'medium_carbon_steel',
    coolantOn: true,
    tailstockEngaged: true,
    toolOverhang: 45.0,
    toolFlankWear: 0.08,
    durationS: 12.0,
    description: 'Standard medium roughing pass on medium carbon steel bar stock using flood coolant.',
    criteria: [
      { channel: 'spindlePowerKw', op: '>=', value: 3.0, label: 'Spindle Power >= 3.0 kW' },
      { channel: 'vibrationRmsMmS', op: '<=', value: 3.8, label: 'Vibration RMS <= 3.8 mm/s (Class B)' }
    ]
  },
  {
    id: 'TC-04',
    name: 'Heavy Roughing Cut (Motor Peak Load)',
    category: 'Stress Test',
    variantId: 'L60',
    speedStepIndex: 10, // 45 RPM (index 10)
    feedMode: 'longitudinal',
    feedRate: 0.55,
    depthOfCut: 8.0,
    materialKey: 'alloy_steel',
    coolantOn: true,
    tailstockEngaged: true,
    toolOverhang: 50.0,
    toolFlankWear: 0.12,
    durationS: 12.0,
    description: 'Heavy roughing cut in alloy steel 4140, testing heavy torque capacity near 18 kW rated power.',
    criteria: [
      { channel: 'cuttingTorqueNm', op: '>=', value: 1200.0, label: 'Torque >= 1200 N·m' },
      { channel: 'motorInputPowerKw', op: '<=', value: 24.0, label: 'Motor Power <= 24.0 kW' },
      { channel: 'vibrationRmsMmS', op: '<=', value: 5.5, label: 'Vibration <= 5.5 mm/s' }
    ]
  },
  {
    id: 'TC-05',
    name: 'Metric Screw Threading M30x3.5 (Lead Screw)',
    category: 'Threading',
    variantId: 'L45',
    speedStepIndex: 6, // 18 RPM (index 6)
    feedMode: 'threading',
    feedRate: 3.5, // 3.5 mm thread pitch
    depthOfCut: 0.8,
    materialKey: 'mild_steel',
    coolantOn: true,
    tailstockEngaged: true,
    toolOverhang: 45.0,
    toolFlankWear: 0.04,
    durationS: 8.0,
    description: 'Engages lead screw half-nut mechanism at low spindle RPM for synchronized metric screw cutting.',
    criteria: [
      { channel: 'feedShaftRpm', op: '>=', value: 9.0, label: 'Lead Screw RPM >= 9.0 RPM' },
      { channel: 'spindleRpm', op: '>=', value: 16.5, label: 'Spindle RPM >= 16.5' }
    ]
  },
  {
    id: 'TC-06',
    name: 'Tailstock Core Drilling Operation',
    category: 'Machining',
    variantId: 'L50',
    speedStepIndex: 11, // 56 RPM (index 11)
    feedMode: 'drilling',
    feedRate: 0.25,
    depthOfCut: 5.0, // Represents 50 mm core drill (MT-6 tailstock)
    materialKey: 'grey_cast_iron',
    coolantOn: true,
    tailstockEngaged: true,
    toolOverhang: 45.0,
    toolFlankWear: 0.05,
    durationS: 10.0,
    description: 'Tailstock barrel quill feed for large diameter core drilling in grey cast iron.',
    criteria: [
      { channel: 'motorInputPowerKw', op: '<=', value: 12.0, label: 'Power <= 12.0 kW' },
      { channel: 'spindlePowerKw', op: '>=', value: 1.0, label: 'Drill Power >= 1.0 kW' },
      { channel: 'vibrationRmsMmS', op: '<=', value: 3.0, label: 'Vibration <= 3.0 mm/s' }
    ]
  },
  {
    id: 'TC-07',
    name: 'Tool Wear & High Vibration Chatter Resonance',
    category: 'Dynamics',
    variantId: 'L45',
    speedStepIndex: 17, // 224 RPM (index 17)
    feedMode: 'longitudinal',
    feedRate: 0.40,
    depthOfCut: 6.5,
    materialKey: 'alloy_steel',
    coolantOn: false, // Dry cut triggers chatter faster
    tailstockEngaged: true,
    toolOverhang: 95.0, // High overhang lowers stability boundary
    toolFlankWear: 0.35, // Severe flank wear
    durationS: 10.0,
    description: 'Simulates extended tool overhang with worn cutting tip to trigger regenerative chatter vibrations.',
    criteria: [
      { channel: 'vibrationRmsMmS', op: '>=', value: 5.5, label: 'Chatter Excitation Vibration >= 5.5 mm/s (Class C/D)' },
      { channel: 'cuttingZoneTempC', op: '>=', value: 250.0, label: 'Dry Cutting Zone Temp >= 250°C' }
    ]
  },
  {
    id: 'TC-08',
    name: 'Spindle Gearbox 21-Step Sweep Verification',
    category: 'Gearbox',
    variantId: 'L45',
    speedStepIndex: 0,
    feedMode: 'neutral',
    feedRate: 0.0,
    depthOfCut: 0.0,
    materialKey: 'mild_steel',
    coolantOn: false,
    tailstockEngaged: true,
    toolOverhang: 45.0,
    toolFlankWear: 0.02,
    durationS: 21.0,
    description: 'Automated sweep through all 21 forward gear ratios, verifying spindle kinematic synchronization.',
    criteria: [
      { channel: 'spindleRpm', op: '>=', value: 4.0, label: 'Minimum Step RPM >= 4.0' }
    ]
  }
];

export class TestBench {
  constructor(engine) {
    this.engine = engine;
    this.testCases = JSON.parse(JSON.stringify(DEFAULT_TEST_CASES));
    this.selectedTestCaseId = this.testCases[0].id;
    this.testResults = {}; // Map of testId -> { status, summary, records, passCriteria }

    // Table pagination
    this.currentPage = 1;
    this.pageSize = 25;
    this.sortColumn = 'timeS';
    this.sortAscending = true;

    // Overlay comparison
    this.overlayChannel = 'spindlePowerKw';
    this.selectedOverlayTests = [this.testCases[0].id];

    // State
    this.isRunningTest = false;
    this.activeRunningTestId = null;
    this.progressPercent = 0;
  }

  getTestCase(id) {
    return this.testCases.find(t => t.id === id);
  }

  selectTestCase(id) {
    this.selectedTestCaseId = id;
    this.currentPage = 1;
  }

  addCustomTestCase(testData) {
    const id = `TC-${String(this.testCases.length + 1).padStart(2, '0')}`;
    const newTest = {
      id,
      name: testData.name || 'Custom Test Scenario',
      category: 'Custom',
      variantId: testData.variantId || 'L45',
      speedStepIndex: parseInt(testData.speedStepIndex || 13),
      feedMode: testData.feedMode || 'longitudinal',
      feedRate: parseFloat(testData.feedRate || 0.3),
      depthOfCut: parseFloat(testData.depthOfCut || 2.0),
      materialKey: testData.materialKey || 'medium_carbon_steel',
      coolantOn: !!testData.coolantOn,
      tailstockEngaged: testData.tailstockEngaged !== false,
      toolOverhang: parseFloat(testData.toolOverhang || 45.0),
      toolFlankWear: parseFloat(testData.toolFlankWear || 0.05),
      durationS: parseFloat(testData.durationS || 10.0),
      description: testData.description || 'User-defined custom simulation benchmark test.',
      criteria: testData.criteria || []
    };
    this.testCases.push(newTest);
    this.selectedTestCaseId = id;
    return newTest;
  }

  duplicateTestCase(id) {
    const orig = this.getTestCase(id);
    if (!orig) return null;
    const cloned = JSON.parse(JSON.stringify(orig));
    cloned.id = `TC-${String(this.testCases.length + 1).padStart(2, '0')}`;
    cloned.name = `${orig.name} (Copy)`;
    cloned.category = 'Custom';
    this.testCases.push(cloned);
    this.selectedTestCaseId = cloned.id;
    return cloned;
  }

  clearDataset() {
    this.testResults = {};
    this.currentPage = 1;
  }

  /**
   * Run a Single Test Case Deterministically
   */
  async runTest(testId, onProgress = null) {
    const tc = this.getTestCase(testId);
    if (!tc) return null;

    this.isRunningTest = true;
    this.activeRunningTestId = testId;
    this.progressPercent = 0;

    // Save previous engine state
    const savedState = {
      variantId: this.engine.variantId,
      speedStepIndex: this.engine.speedStepIndex,
      feedMode: this.engine.feedMode,
      feedRate: this.engine.feedRate,
      depthOfCut: this.engine.depthOfCut,
      materialKey: this.engine.materialKey,
      coolantOn: this.engine.coolantOn,
      tailstockEngaged: this.engine.tailstockEngaged,
      toolOverhang: this.engine.toolOverhang,
      toolFlankWear: this.engine.toolFlankWear
    };

    // Apply Test Case Inputs
    this.engine.setVariant(tc.variantId);
    this.engine.speedStepIndex = tc.speedStepIndex;
    this.engine.feedMode = tc.feedMode;
    this.engine.feedRate = tc.feedRate;
    this.engine.depthOfCut = tc.depthOfCut;
    this.engine.setMaterial(tc.materialKey);
    this.engine.coolantOn = tc.coolantOn;
    this.engine.tailstockEngaged = tc.tailstockEngaged;
    this.engine.toolOverhang = tc.toolOverhang;
    this.engine.toolFlankWear = tc.toolFlankWear;
    this.engine.spindleDirection = 1;
    this.engine.powerOn = true;
    this.engine.reset(false);

    const isSweep = tc.id === 'TC-08';
    const totalDuration = tc.durationS;
    const dt = 0.05; // 20 Hz recording for test bench
    const totalSteps = Math.floor(totalDuration / dt);
    const records = [];

    // Run steps in chunks to allow UI responsiveness
    const chunkSize = 20;
    for (let step = 0; step < totalSteps; step++) {
      if (isSweep) {
        // Step gearbox across all 21 speeds
        const sweepIdx = Math.min(20, Math.floor((step / totalSteps) * 21));
        this.engine.speedStepIndex = sweepIdx;
      }

      this.engine.step(dt);
      records.push(this.engine.getTelemetrySnapshot());

      if (step % chunkSize === 0) {
        this.progressPercent = Math.floor((step / totalSteps) * 100);
        if (onProgress) onProgress(this.progressPercent);
        await new Promise(r => setTimeout(r, 2));
      }
    }

    // Evaluate Criteria
    const criteriaResults = [];
    let allPassed = true;

    for (const c of tc.criteria) {
      let passed = true;
      let actualVal = 0;

      // Extract values for channel
      const vals = records.map(r => r[c.channel] !== undefined ? r[c.channel] : 0);
      if (c.op === '>=') {
        actualVal = Math.max(...vals);
        passed = actualVal >= c.value;
      } else if (c.op === '<=') {
        actualVal = Math.max(...vals);
        passed = actualVal <= c.value;
      } else if (c.op === '==') {
        actualVal = vals[vals.length - 1];
        passed = Math.abs(actualVal - c.value) < 0.1;
      }

      if (!passed) allPassed = false;
      criteriaResults.push({
        label: c.label,
        channel: c.channel,
        target: `${c.op} ${c.value}`,
        actual: actualVal.toFixed(1),
        passed
      });
    }

    // Compute Summary Stats
    const summary = {
      testId: tc.id,
      name: tc.name,
      variantId: tc.variantId,
      durationS: tc.durationS,
      status: allPassed ? 'PASSED' : 'FAILED',
      passed: allPassed,
      criteriaResults,
      avgSpindleRpm: (records.reduce((a, b) => a + b.spindleRpm, 0) / records.length).toFixed(1),
      maxMotorPowerKw: Math.max(...records.map(r => r.motorInputPowerKw)).toFixed(2),
      maxTorqueNm: Math.max(...records.map(r => r.cuttingTorqueNm)).toFixed(1),
      maxVibrationMmS: Math.max(...records.map(r => r.vibrationRmsMmS)).toFixed(2),
      finalTempC: records[records.length - 1].cuttingZoneTempC.toFixed(1),
      energyUsedKwh: (records[records.length - 1].cumulativeEnergyKwh - records[0].cumulativeEnergyKwh).toFixed(4)
    };

    this.testResults[tc.id] = {
      testCase: tc,
      summary,
      records
    };

    // Restore engine state
    this.engine.setVariant(savedState.variantId);
    this.engine.speedStepIndex = savedState.speedStepIndex;
    this.engine.feedMode = savedState.feedMode;
    this.engine.feedRate = savedState.feedRate;
    this.engine.depthOfCut = savedState.depthOfCut;
    this.engine.setMaterial(savedState.materialKey);
    this.engine.coolantOn = savedState.coolantOn;
    this.engine.tailstockEngaged = savedState.tailstockEngaged;
    this.engine.toolOverhang = savedState.toolOverhang;
    this.engine.toolFlankWear = savedState.toolFlankWear;
    this.engine.reset(false);

    this.isRunningTest = false;
    this.activeRunningTestId = null;
    this.progressPercent = 100;
    if (onProgress) onProgress(100);

    return summary;
  }

  async runAllTests(onProgress = null) {
    for (let i = 0; i < this.testCases.length; i++) {
      const tc = this.testCases[i];
      await this.runTest(tc.id, (p) => {
        const overall = Math.floor(((i + p / 100) / this.testCases.length) * 100);
        if (onProgress) onProgress(overall, tc.name);
      });
    }
  }

  exportTestCSV(testId) {
    const res = this.testResults[testId];
    if (!res || !res.records) return;
    const csv = generateLatheTelemetryCSV(res.records);
    downloadCSV(`test_benchmark_${testId}_${res.testCase.variantId}_results.csv`, csv);
  }

  /**
   * Paginated & Sorted Time-Series Records
   */
  getPaginatedRecords(testId) {
    const res = this.testResults[testId];
    if (!res || !res.records || res.records.length === 0) {
      return { totalRows: 0, totalPages: 0, rows: [] };
    }

    let records = [...res.records];

    // Sorting
    records.sort((a, b) => {
      const vA = a[this.sortColumn];
      const vB = b[this.sortColumn];
      if (typeof vA === 'string') {
        return this.sortAscending ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return this.sortAscending ? (vA - vB) : (vB - vA);
    });

    const totalRows = records.length;
    const totalPages = Math.ceil(totalRows / this.pageSize);
    this.currentPage = Math.min(this.currentPage, Math.max(1, totalPages));

    const start = (this.currentPage - 1) * this.pageSize;
    const rows = records.slice(start, start + this.pageSize);

    return { totalRows, totalPages, rows, currentPage: this.currentPage };
  }
}
