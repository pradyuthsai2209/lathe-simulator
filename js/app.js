/**
 * Main Application Orchestrator
 * 
 * Coordinates:
 * - Simulation Engine (50 Hz deterministic fixed-step loop)
 * - 3D Live Cockpit & Three.js digital twin
 * - Operator Controls Panel & Safety Interlocks
 * - Live Telemetry Cards & Calculated Metrics Table
 * - Performance Graphs Studio (8 chart modes, time windowing, hover scrubber)
 * - Test Cases & Data Bench (8 industrial benchmarks, pagination, multi-overlay)
 * - Model Config Modal (specifications, formulas, assumptions)
 * - Persistent Status Bar & 19-Channel CSV Exporter
 */

import { SimulationEngine } from './simulation-engine.js';
import { Lathe3DViewer } from './lathe-3d.js';
import { ControlsUI } from './controls-ui.js';
import { TelemetryUI } from './telemetry-ui.js';
import { PerformanceGraphsStudio } from './graphs-studio.js';
import { TestBench } from './test-bench.js';
import { ModelConfigUI } from './model-config-ui.js';
import { generateLatheTelemetryCSV, downloadCSV } from './csv-exporter.js';

class LatheSimulatorApp {
  constructor() {
    this.engine = new SimulationEngine('L45');
    this.activeTab = 'cockpit'; // 'cockpit', 'graphs', 'bench'

    this.init();
  }

  init() {
    // 1. Initialize Subsystems
    this.telemetryUI = new TelemetryUI(this.engine);
    this.lathe3D = new Lathe3DViewer('lathe-3d-viewport', this.engine);
    this.controlsUI = new ControlsUI(this.engine, () => this.onMachineSettingsChanged());
    this.graphsStudio = new PerformanceGraphsStudio('graphs-main-canvas', 'graphs-stats-row', this.engine);
    this.testBench = new TestBench(this.engine);
    this.modelConfigUI = new ModelConfigUI(this.engine, () => this.onModelConfigSaved());

    // 2. Setup Top Navigation Tabs
    this.bindNavigationTabs();

    // 3. Setup Persistent Status Bar
    this.bindStatusBar();

    // 4. Setup 3D View Controls & Overlays
    this.bind3DViewControls();

    // 5. Setup Performance Graphs Controls
    this.bindGraphsControls();

    // 6. Setup Test Bench UI & Interactivity
    this.bindTestBenchUI();

    // 7. Keyboard Shortcuts
    this.bindKeyboardShortcuts();

    // 8. Start Deterministic Simulation Loop (50 Hz)
    this.startSimulationLoop();

    console.log('HMT Heavy Duty Lathe L45/L50/L60/L70 Simulator initialized.');
  }

  bindNavigationTabs() {
    const tabs = document.querySelectorAll('.nav-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        this.switchTab(target);
      });
    });
  }

  switchTab(targetTab) {
    this.activeTab = targetTab;

    // Update Tab Buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === targetTab);
    });

    // Update Tab Panes
    document.querySelectorAll('.tab-content-panel').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-panel-${targetTab}`);
    });

    // Handle Resize on specific tabs
    if (targetTab === 'cockpit') {
      setTimeout(() => this.lathe3D.onResize(), 50);
    } else if (targetTab === 'graphs') {
      setTimeout(() => this.graphsStudio.resizeCanvas(), 50);
    } else if (targetTab === 'bench') {
      this.renderTestBench();
    }
  }

  bindStatusBar() {
    // Pause / Resume Button
    const btnPause = document.getElementById('btn-status-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => this.togglePause());
    }

    // Reset Button
    const btnReset = document.getElementById('btn-status-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Reset simulation state, coordinates, and energy logs to initial?')) {
          this.engine.reset(true);
          this.controlsUI.updateControlsFromEngine();
        }
      });
    }

    // Export Live Log Button (Exact 19-Channel CSV)
    const btnExportLog = document.getElementById('btn-status-export-log');
    if (btnExportLog) {
      btnExportLog.addEventListener('click', () => {
        const hist = this.engine.history;
        if (hist.length === 0) {
          alert('No telemetry data recorded yet. Let the simulation run for a few seconds.');
          return;
        }
        const csv = generateLatheTelemetryCSV(hist);
        const filename = `hmt_lathe_${this.engine.variantId}_live_telemetry_${Date.now()}.csv`;
        downloadCSV(filename, csv);
      });
    }
  }

  togglePause() {
    this.engine.isRunning = !this.engine.isRunning;
    const btnPause = document.getElementById('btn-status-pause');
    if (btnPause) {
      btnPause.innerHTML = this.engine.isRunning ?
        '<span class="btn-icon">⏸</span> Pause' :
        '<span class="btn-icon">▶</span> Resume';
      btnPause.classList.toggle('btn-resuming', !this.engine.isRunning);
    }
  }

  bind3DViewControls() {
    const viewButtons = document.querySelectorAll('.view-preset-btn');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.view;
        if (preset === 'autorotate') {
          const isRotating = this.lathe3D.toggleAutoRotate();
          btn.classList.toggle('active', isRotating);
        } else {
          viewButtons.forEach(b => {
            if (b.dataset.view !== 'autorotate') b.classList.remove('active');
          });
          btn.classList.add('active');
          this.lathe3D.setCameraPreset(preset);
        }
      });
    });

    // Update 3D HUD Badge regularly
    this.hudVariant = document.getElementById('hud-3d-variant');
    this.hudSpeed = document.getElementById('hud-3d-speed');
    this.hudFeed = document.getElementById('hud-3d-feed');
    this.hudStatus = document.getElementById('hud-3d-status');
  }

  bindGraphsControls() {
    // Channel Mode Selector
    const modeSelect = document.getElementById('graphs-channel-mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.graphsStudio.setChartMode(e.target.value);
      });
    }

    // Time Window Buttons (5s, 10s, 30s, 60s, 120s, All)
    const timeBtns = document.querySelectorAll('.time-window-btn');
    timeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        timeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const sec = parseInt(btn.dataset.seconds);
        this.graphsStudio.setTimeWindow(sec);
      });
    });

    // Pause / Resume Recording
    const btnRec = document.getElementById('btn-graphs-toggle-rec');
    if (btnRec) {
      btnRec.addEventListener('click', () => {
        const isRec = this.graphsStudio.toggleRecording();
        btnRec.innerHTML = isRec ? '<span>⏸</span> Pause Rec' : '<span>▶</span> Resume Rec';
        btnRec.classList.toggle('paused', !isRec);
      });
    }

    // Clear History
    const btnClear = document.getElementById('btn-graphs-clear-hist');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.graphsStudio.clearHistory();
      });
    }

    // Export Graph CSV
    const btnExpGraph = document.getElementById('btn-graphs-export-csv');
    if (btnExpGraph) {
      btnExpGraph.addEventListener('click', () => {
        this.graphsStudio.exportCurrentGraphCSV();
      });
    }
  }

  bindTestBenchUI() {
    this.renderTestBenchSuiteList();

    // Search bar for test cases
    const searchInput = document.getElementById('bench-test-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.bench-test-card').forEach(card => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? 'block' : 'none';
        });
      });
    }

    // "Run Test" Button
    const btnRunSelected = document.getElementById('btn-bench-run-selected');
    if (btnRunSelected) {
      btnRunSelected.addEventListener('click', () => this.runSelectedBenchmarkTest());
    }

    // "Run All Tests" Button
    const btnRunAll = document.getElementById('btn-bench-run-all');
    if (btnRunAll) {
      btnRunAll.addEventListener('click', () => this.runAllBenchmarkTests());
    }

    // "Duplicate Test Case" Button
    const btnDup = document.getElementById('btn-bench-duplicate-test');
    if (btnDup) {
      btnDup.addEventListener('click', () => {
        const cloned = this.testBench.duplicateTestCase(this.testBench.selectedTestCaseId);
        if (cloned) {
          this.renderTestBenchSuiteList();
          this.renderSelectedTestDetails();
        }
      });
    }

    // "Clear Dataset" Button
    const btnClearData = document.getElementById('btn-bench-clear-dataset');
    if (btnClearData) {
      btnClearData.addEventListener('click', () => {
        this.testBench.clearDataset();
        this.renderTestBench();
      });
    }

    // "Export Test CSV" Button
    const btnExpTestCsv = document.getElementById('btn-bench-export-csv');
    if (btnExpTestCsv) {
      btnExpTestCsv.addEventListener('click', () => {
        this.testBench.exportTestCSV(this.testBench.selectedTestCaseId);
      });
    }

    // "New Test Case" Modal Trigger
    const btnNewTest = document.getElementById('btn-bench-new-test');
    const modalNewTest = document.getElementById('modal-new-test');
    const btnCloseNewTest = document.getElementById('btn-close-new-test');
    const btnSaveNewTest = document.getElementById('btn-save-new-test');

    if (btnNewTest && modalNewTest) {
      btnNewTest.addEventListener('click', () => modalNewTest.classList.add('active'));
    }
    if (btnCloseNewTest && modalNewTest) {
      btnCloseNewTest.addEventListener('click', () => modalNewTest.classList.remove('active'));
    }
    if (btnSaveNewTest && modalNewTest) {
      btnSaveNewTest.addEventListener('click', () => {
        const name = document.getElementById('new-test-name').value;
        const variantId = document.getElementById('new-test-variant').value;
        const speedStepIndex = parseInt(document.getElementById('new-test-speed').value);
        const feedMode = document.getElementById('new-test-feedmode').value;
        const feedRate = parseFloat(document.getElementById('new-test-feedrate').value);
        const depthOfCut = parseFloat(document.getElementById('new-test-doc').value);
        const durationS = parseFloat(document.getElementById('new-test-duration').value);

        this.testBench.addCustomTestCase({
          name, variantId, speedStepIndex, feedMode, feedRate, depthOfCut, durationS
        });
        modalNewTest.classList.remove('active');
        this.renderTestBenchSuiteList();
        this.renderSelectedTestDetails();
      });
    }

    // Table Pagination Controls
    const btnPrevPage = document.getElementById('bench-table-prev');
    const btnNextPage = document.getElementById('bench-table-next');
    const pageSizeSelect = document.getElementById('bench-page-size-select');

    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', () => {
        if (this.testBench.currentPage > 1) {
          this.testBench.currentPage--;
          this.renderBenchDataTable();
        }
      });
    }
    if (btnNextPage) {
      btnNextPage.addEventListener('click', () => {
        this.testBench.currentPage++;
        this.renderBenchDataTable();
      });
    }
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.testBench.pageSize = parseInt(e.target.value);
        this.testBench.currentPage = 1;
        this.renderBenchDataTable();
      });
    }

    // Multi-Test Overlay Channel Selector
    const overlaySelect = document.getElementById('bench-overlay-channel-select');
    if (overlaySelect) {
      overlaySelect.addEventListener('change', (e) => {
        this.testBench.overlayChannel = e.target.value;
        this.drawOverlayComparisonChart();
      });
    }
  }

  renderTestBenchSuiteList() {
    const container = document.getElementById('bench-test-list-container');
    if (!container) return;

    container.innerHTML = this.testBench.testCases.map(tc => {
      const res = this.testBench.testResults[tc.id];
      const statusBadge = res ? (
        res.summary.passed ?
          '<span class="badge-test-status status-pass">PASSED</span>' :
          '<span class="badge-test-status status-fail">FAILED</span>'
      ) : '<span class="badge-test-status status-idle">UNTESTED</span>';

      const isSelected = tc.id === this.testBench.selectedTestCaseId;

      return `
        <div class="bench-test-card ${isSelected ? 'selected' : ''}" data-id="${tc.id}">
          <div class="test-card-header">
            <span class="test-id font-mono">${tc.id}</span>
            ${statusBadge}
          </div>
          <div class="test-title">${tc.name}</div>
          <div class="test-meta">
            <span class="meta-tag font-mono">HMT ${tc.variantId}</span>
            <span class="meta-tag font-mono">${tc.category}</span>
            <span class="meta-tag font-mono">${tc.durationS}s</span>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.bench-test-card').forEach(card => {
      card.addEventListener('click', () => {
        this.testBench.selectTestCase(card.dataset.id);
        this.renderTestBenchSuiteList();
        this.renderSelectedTestDetails();
      });
    });

    this.renderSelectedTestDetails();
  }

  renderSelectedTestDetails() {
    const tc = this.testBench.getTestCase(this.testBench.selectedTestCaseId);
    if (!tc) return;

    const titleEl = document.getElementById('bench-selected-test-title');
    const descEl = document.getElementById('bench-selected-test-desc');
    const paramsEl = document.getElementById('bench-selected-test-params');
    const criteriaEl = document.getElementById('bench-selected-test-criteria');
    const summaryCardEl = document.getElementById('bench-summary-card-container');

    if (titleEl) titleEl.textContent = `${tc.id}: ${tc.name}`;
    if (descEl) descEl.textContent = tc.description;

    if (paramsEl) {
      paramsEl.innerHTML = `
        <div class="param-item"><span class="p-k">Variant:</span><span class="p-v">HMT ${tc.variantId}</span></div>
        <div class="param-item"><span class="p-k">Speed Step:</span><span class="p-v">${tc.speedStepIndex + 1}</span></div>
        <div class="param-item"><span class="p-k">Feed Mode:</span><span class="p-v">${tc.feedMode}</span></div>
        <div class="param-item"><span class="p-k">Feed Rate:</span><span class="p-v">${tc.feedRate.toFixed(2)} mm/rev</span></div>
        <div class="param-item"><span class="p-k">Depth of Cut:</span><span class="p-v">${tc.depthOfCut.toFixed(1)} mm</span></div>
        <div class="param-item"><span class="p-k">Duration:</span><span class="p-v">${tc.durationS} s</span></div>
      `;
    }

    if (criteriaEl) {
      const res = this.testBench.testResults[tc.id];
      if (res && res.summary.criteriaResults) {
        criteriaEl.innerHTML = res.summary.criteriaResults.map(cr => `
          <div class="criteria-item ${cr.passed ? 'crit-pass' : 'crit-fail'}">
            <span class="crit-icon">${cr.passed ? '✓' : '✗'}</span>
            <span class="crit-label">${cr.label}</span>
            <span class="crit-actual font-mono">[Target: ${cr.target} | Actual: ${cr.actual}]</span>
          </div>
        `).join('');
      } else {
        criteriaEl.innerHTML = (tc.criteria || []).map(c => `
          <div class="criteria-item crit-pending">
            <span class="crit-icon">•</span>
            <span class="crit-label">${c.label}</span>
            <span class="crit-actual font-mono">Target: ${c.op} ${c.value}</span>
          </div>
        `).join('');
      }
    }

    if (summaryCardEl) {
      const res = this.testBench.testResults[tc.id];
      if (res) {
        const s = res.summary;
        summaryCardEl.innerHTML = `
          <div class="bench-stat-card">
            <div class="bsc-label">MAX MOTOR POWER</div>
            <div class="bsc-val">${s.maxMotorPowerKw} kW</div>
          </div>
          <div class="bench-stat-card">
            <div class="bsc-label">MAX TORQUE</div>
            <div class="bsc-val">${s.maxTorqueNm} N·m</div>
          </div>
          <div class="bench-stat-card">
            <div class="bsc-label">MAX VIBRATION</div>
            <div class="bsc-val">${s.maxVibrationMmS} mm/s</div>
          </div>
          <div class="bench-stat-card">
            <div class="bsc-label">FINAL TEMP</div>
            <div class="bsc-val">${s.finalTempC} °C</div>
          </div>
          <div class="bench-stat-card">
            <div class="bsc-label">ENERGY USED</div>
            <div class="bsc-val">${s.energyUsedKwh} kWh</div>
          </div>
        `;
      } else {
        summaryCardEl.innerHTML = `<div class="bench-unrun-msg">No test run recorded yet. Click "Run Selected Test" above.</div>`;
      }
    }

    this.renderBenchDataTable();
    this.drawOverlayComparisonChart();
  }

  async runSelectedBenchmarkTest() {
    const testId = this.testBench.selectedTestCaseId;
    const progressEl = document.getElementById('bench-run-progress-bar');
    const statusTextEl = document.getElementById('bench-run-status-text');

    if (progressEl) progressEl.style.width = '0%';
    if (statusTextEl) statusTextEl.textContent = `Running ${testId}...`;

    await this.testBench.runTest(testId, (pct) => {
      if (progressEl) progressEl.style.width = `${pct}%`;
      if (statusTextEl) statusTextEl.textContent = `Running ${testId} (${pct}%)...`;
    });

    if (statusTextEl) statusTextEl.textContent = `Test ${testId} completed.`;
    this.renderTestBenchSuiteList();
    this.renderSelectedTestDetails();
  }

  async runAllBenchmarkTests() {
    const progressEl = document.getElementById('bench-run-progress-bar');
    const statusTextEl = document.getElementById('bench-run-status-text');

    await this.testBench.runAllTests((overallPct, testName) => {
      if (progressEl) progressEl.style.width = `${overallPct}%`;
      if (statusTextEl) statusTextEl.textContent = `Running ${testName} (${overallPct}%)...`;
    });

    if (statusTextEl) statusTextEl.textContent = 'All test cases executed successfully.';
    this.renderTestBenchSuiteList();
    this.renderSelectedTestDetails();
  }

  renderBenchDataTable() {
    const tableBody = document.getElementById('bench-data-table-tbody');
    const pageInfo = document.getElementById('bench-page-info');
    if (!tableBody) return;

    const res = this.testBench.getPaginatedRecords(this.testBench.selectedTestCaseId);

    if (res.totalRows === 0) {
      tableBody.innerHTML = `<tr><td colspan="19" class="text-center text-muted py-6">No data recorded for this test case yet. Run test to capture time-series.</td></tr>`;
      if (pageInfo) pageInfo.textContent = 'Page 0 of 0 (0 records)';
      return;
    }

    if (pageInfo) {
      pageInfo.textContent = `Page ${res.currentPage} of ${res.totalPages} (${res.totalRows} records)`;
    }

    tableBody.innerHTML = res.rows.map(r => `
      <tr>
        <td class="font-mono">${r.timeS.toFixed(2)}</td>
        <td class="font-mono text-cyan">${r.operatingState}</td>
        <td class="font-mono">${r.motorRpm.toFixed(1)}</td>
        <td class="font-mono">${r.gearboxInputRpm.toFixed(1)}</td>
        <td class="font-mono text-bold">${r.spindleRpm.toFixed(1)}</td>
        <td class="font-mono">${r.feedShaftRpm.toFixed(1)}</td>
        <td class="font-mono">${r.cuttingTorqueNm.toFixed(2)}</td>
        <td class="font-mono">${r.spindlePowerKw.toFixed(2)}</td>
        <td class="font-mono text-amber">${r.motorInputPowerKw.toFixed(2)}</td>
        <td class="font-mono">${r.voltageV.toFixed(1)}</td>
        <td class="font-mono">${r.currentA.toFixed(1)}</td>
        <td class="font-mono">${r.driveFrequencyHz.toFixed(1)}</td>
        <td class="font-mono">${r.speedStep}</td>
        <td class="font-mono">${r.coolantTempC.toFixed(1)}</td>
        <td class="font-mono">${r.cuttingZoneTempC.toFixed(1)}</td>
        <td class="font-mono">${r.energyUseKwh.toFixed(3)}</td>
        <td class="font-mono">${r.cumulativeEnergyKwh.toFixed(4)}</td>
        <td class="font-mono">${r.vibrationRmsMmS.toFixed(2)}</td>
        <td class="font-mono">${r.spindleSpeedErrorRpm.toFixed(1)}</td>
      </tr>
    `).join('');
  }

  drawOverlayComparisonChart() {
    const canvas = document.getElementById('bench-overlay-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;

    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth || 600;
    const h = parent.clientHeight || 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, w, h);

    const padL = 60, padR = 20, padT = 30, padB = 30;
    const gw = w - padL - padR, gh = h - padT - padB;

    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(padL, padT, gw, gh);

    const channelKey = this.testBench.overlayChannel || 'spindlePowerKw';
    const testIdsWithResults = Object.keys(this.testBench.testResults);

    if (testIdsWithResults.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RUN TEST CASES TO POPULATE MULTI-TEST OVERLAY COMPARISON', padL + gw / 2, padT + gh / 2);
      return;
    }

    const colors = ['#00e5ff', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a855f7', '#f43f5e', '#eab308'];

    // Find Global Max & Time for selected channel
    let maxVal = -Infinity;
    let maxTime = -Infinity;

    testIdsWithResults.forEach(id => {
      const records = this.testBench.testResults[id].records;
      records.forEach(r => {
        const v = r[channelKey] || 0;
        if (v > maxVal) maxVal = v;
        if (r.timeS > maxTime) maxTime = r.timeS;
      });
    });

    if (maxVal <= 0) maxVal = 10;
    maxVal *= 1.15;
    if (maxTime <= 0) maxTime = 10;

    // Plot each run
    testIdsWithResults.forEach((id, idx) => {
      const records = this.testBench.testResults[id].records;
      const color = colors[idx % colors.length];

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const x = padL + (r.timeS / maxTime) * gw;
        const yVal = r[channelKey] || 0;
        const y = padT + (1 - (yVal / maxVal)) * gh;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // Legend
    let legX = padL;
    ctx.font = '10px "JetBrains Mono", monospace';
    testIdsWithResults.forEach((id, idx) => {
      const color = colors[idx % colors.length];
      ctx.fillStyle = color;
      ctx.fillRect(legX, padT - 18, 10, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(id, legX + 14, padT - 14);
      legX += 55;
    });
  }

  renderTestBench() {
    this.renderTestBenchSuiteList();
    this.renderSelectedTestDetails();
    this.drawOverlayComparisonChart();
  }

  onMachineSettingsChanged() {
    this.telemetryUI.update();
  }

  onModelConfigSaved() {
    this.controlsUI.updateControlsFromEngine();
    this.telemetryUI.update();
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is inside an input field
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      } else if (e.key === '1') {
        this.switchTab('cockpit');
      } else if (e.key === '2') {
        this.switchTab('graphs');
      } else if (e.key === '3') {
        this.switchTab('bench');
      }
    });
  }

  startSimulationLoop() {
    // 50 Hz Fixed Simulation Step = 20ms
    const stepIntervalMs = 20;

    setInterval(() => {
      this.engine.step();
      this.telemetryUI.update();

      // Update 3D HUD Badge
      if (this.hudVariant) this.hudVariant.textContent = `HMT ${this.engine.variantId}`;
      if (this.hudSpeed) {
        const rpm = this.engine.variant.speedStepsForward[this.engine.speedStepIndex] || 140;
        this.hudSpeed.textContent = `STEP ${this.engine.speedStepIndex + 1} (${rpm} RPM)`;
      }
      if (this.hudFeed) {
        if (this.engine.feedMode === 'threading') {
          this.hudFeed.textContent = `LEAD SCREW (P=${this.engine.threadPitch}mm)`;
        } else if (this.engine.feedMode === 'longitudinal' || this.engine.feedMode === 'cross') {
          this.hudFeed.textContent = `FEED ROD (${this.engine.feedRate.toFixed(2)} mm/rev)`;
        } else {
          this.hudFeed.textContent = 'NEUTRAL / MANUAL';
        }
      }
      if (this.hudStatus) {
        this.hudStatus.textContent = this.engine.operatingState;
        this.hudStatus.className = `hud-badge state-${this.engine.operatingState.toLowerCase()}`;
      }
    }, stepIntervalMs);
  }
}

// Instantiate App when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.latheApp = new LatheSimulatorApp();
});
