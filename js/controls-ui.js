/**
 * Operator Control Panel UI Manager
 * 
 * Binds all tactile lathe levers, rotary knobs, sliders, variant pickers,
 * feeds & threading gearbox selections, presets, and safety interlocks.
 */

import { HMT_VARIANTS, WORKPIECE_MATERIALS, TOOL_MATERIALS, FEED_STEPS_LONGITUDINAL, METRIC_THREADS } from './machine-specs.js';

export class ControlsUI {
  constructor(engine, onSettingsChanged) {
    this.engine = engine;
    this.onSettingsChanged = onSettingsChanged;
    this.init();
  }

  init() {
    this.bindVariantSelector();
    this.bindPowerAndSpindle();
    this.bindSpeedGearbox();
    this.bindFeedGearbox();
    this.bindMachiningParameters();
    this.bindWorkpieceAndTool();
    this.bindPresets();
    this.updateControlsFromEngine();
  }

  bindVariantSelector() {
    const container = document.getElementById('variant-buttons-container');
    if (!container) return;

    container.innerHTML = Object.keys(HMT_VARIANTS).map(vid => `
      <button class="variant-btn ${this.engine.variantId === vid ? 'active' : ''}" data-variant="${vid}">
        <span class="v-name">${vid}</span>
        <span class="v-sub">Swing ${HMT_VARIANTS[vid].swingOverBed}mm</span>
      </button>
    `).join('');

    container.querySelectorAll('.variant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const vid = btn.dataset.variant;
        this.engine.setVariant(vid);
        container.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.populateSpeedSteps();
        if (this.onSettingsChanged) this.onSettingsChanged();
      });
    });
  }

  bindPowerAndSpindle() {
    // Master Power Switch
    const powerToggle = document.getElementById('control-power-toggle');
    if (powerToggle) {
      powerToggle.checked = this.engine.powerOn;
      powerToggle.addEventListener('change', (e) => {
        this.engine.powerOn = e.target.checked;
        if (!this.engine.powerOn) {
          this.engine.spindleDirection = 0;
        }
        this.updateSpindleButtons();
      });
    }

    // Spindle Direction Buttons (FWD, STOP, REV, JOG)
    const btnFwd = document.getElementById('btn-spindle-fwd');
    const btnStop = document.getElementById('btn-spindle-stop');
    const btnRev = document.getElementById('btn-spindle-rev');
    const btnJog = document.getElementById('btn-spindle-jog');

    if (btnFwd) {
      btnFwd.addEventListener('click', () => {
        if (!this.engine.powerOn) return;
        this.engine.spindleDirection = 1;
        this.updateSpindleButtons();
      });
    }

    if (btnStop) {
      btnStop.addEventListener('click', () => {
        this.engine.spindleDirection = 0;
        this.updateSpindleButtons();
      });
    }

    if (btnRev) {
      btnRev.addEventListener('click', () => {
        if (!this.engine.powerOn) return;
        this.engine.spindleDirection = -1;
        this.updateSpindleButtons();
      });
    }

    if (btnJog) {
      // Momentary Jog Button
      const startJog = () => {
        if (!this.engine.powerOn) return;
        this.savedDir = this.engine.spindleDirection;
        this.engine.spindleDirection = 1;
        this.engine.speedStepIndex = 0; // slowest 4.5 RPM
        this.updateSpindleButtons();
      };
      const stopJog = () => {
        this.engine.spindleDirection = 0;
        this.updateSpindleButtons();
      };
      btnJog.addEventListener('mousedown', startJog);
      btnJog.addEventListener('mouseup', stopJog);
      btnJog.addEventListener('touchstart', startJog);
      btnJog.addEventListener('touchend', stopJog);
    }
  }

  updateSpindleButtons() {
    const btnFwd = document.getElementById('btn-spindle-fwd');
    const btnStop = document.getElementById('btn-spindle-stop');
    const btnRev = document.getElementById('btn-spindle-rev');

    if (btnFwd) btnFwd.classList.toggle('active', this.engine.spindleDirection === 1);
    if (btnStop) btnStop.classList.toggle('active', this.engine.spindleDirection === 0);
    if (btnRev) btnRev.classList.toggle('active', this.engine.spindleDirection === -1);
  }

  bindSpeedGearbox() {
    this.populateSpeedSteps();

    // Range Lever Selector (Low: 1-7, Med: 8-14, High: 15-21)
    const rangeLever = document.getElementById('control-speed-range');
    if (rangeLever) {
      rangeLever.addEventListener('change', (e) => {
        const range = parseInt(e.target.value);
        let baseIdx = 0;
        if (range === 2) baseIdx = 7;
        if (range === 3) baseIdx = 14;
        const currentSub = this.engine.speedStepIndex % 7;
        this.setSpeedStepWithNotice(baseIdx + currentSub);
      });
    }
  }

  populateSpeedSteps() {
    const select = document.getElementById('control-speed-step-select');
    if (!select) return;

    const steps = this.engine.variant.speedStepsForward;
    select.innerHTML = steps.map((rpm, idx) => `
      <option value="${idx}" ${idx === this.engine.speedStepIndex ? 'selected' : ''}>
        Step ${idx + 1}: ${rpm} RPM ${idx < 7 ? '(Range I: Low)' : (idx < 14 ? '(Range II: Med)' : '(Range III: High)')}
      </option>
    `).join('');

    select.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value);
      this.setSpeedStepWithNotice(idx);
    });
  }

  setSpeedStepWithNotice(idx) {
    const success = this.engine.setSpeedStep(idx);
    const warningEl = document.getElementById('gear-shift-warning');
    if (!success) {
      if (warningEl) {
        warningEl.textContent = 'INTERLOCK WARNING: Spindle is rotating! Stop spindle before shifting headstock gears.';
        warningEl.style.display = 'block';
        setTimeout(() => { if (warningEl) warningEl.style.display = 'none'; }, 3500);
      }
    } else {
      if (warningEl) warningEl.style.display = 'none';
      const select = document.getElementById('control-speed-step-select');
      if (select) select.value = this.engine.speedStepIndex;
    }
  }

  bindFeedGearbox() {
    // Feed Mode Radio Buttons / Buttons
    const modeBtns = document.querySelectorAll('.feed-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.engine.setFeedMode(mode);
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateFeedControlsVisibility();
      });
    });

    // Feed Rate Selector (Longitudinal / Cross)
    const feedSelect = document.getElementById('control-feed-rate-select');
    const feedInput = document.getElementById('control-feed-rate-input');

    if (feedSelect) {
      feedSelect.innerHTML = FEED_STEPS_LONGITUDINAL.map(f => `
        <option value="${f}" ${f === this.engine.feedRate ? 'selected' : ''}>${f.toFixed(2)} mm/rev</option>
      `).join('');

      feedSelect.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.feedRate = val;
        if (feedInput) feedInput.value = val;
      });
    }

    if (feedInput) {
      feedInput.value = this.engine.feedRate;
      feedInput.addEventListener('input', (e) => {
        const val = Math.max(0.01, Math.min(6.4, parseFloat(e.target.value) || 0.1));
        this.engine.feedRate = val;
      });
    }

    // Thread Pitch Selector
    const threadSelect = document.getElementById('control-thread-pitch-select');
    if (threadSelect) {
      threadSelect.innerHTML = METRIC_THREADS.map(p => `
        <option value="${p}" ${p === this.engine.threadPitch ? 'selected' : ''}>M-Pitch: ${p.toFixed(2)} mm</option>
      `).join('');

      threadSelect.addEventListener('change', (e) => {
        this.engine.threadPitch = parseFloat(e.target.value);
      });
    }
  }

  updateFeedControlsVisibility() {
    const feedBox = document.getElementById('feed-rate-box');
    const threadBox = document.getElementById('thread-pitch-box');
    const apronStatus = document.getElementById('apron-interlock-status');

    if (this.engine.feedMode === 'threading') {
      if (feedBox) feedBox.style.opacity = '0.5';
      if (threadBox) threadBox.style.opacity = '1.0';
      if (apronStatus) apronStatus.textContent = 'LEAD SCREW HALF-NUT ENGAGED (Feed Rod Locked Out)';
    } else if (this.engine.feedMode === 'longitudinal' || this.engine.feedMode === 'cross') {
      if (feedBox) feedBox.style.opacity = '1.0';
      if (threadBox) threadBox.style.opacity = '0.5';
      if (apronStatus) apronStatus.textContent = `FEED ROD CLUTCH ENGAGED (${this.engine.feedMode.toUpperCase()})`;
    } else {
      if (feedBox) feedBox.style.opacity = '0.5';
      if (threadBox) threadBox.style.opacity = '0.5';
      if (apronStatus) apronStatus.textContent = 'MANUAL / NEUTRAL FEED';
    }
  }

  bindMachiningParameters() {
    // Depth of Cut (ap)
    const docSlider = document.getElementById('control-doc-slider');
    const docInput = document.getElementById('control-doc-input');

    if (docSlider && docInput) {
      docSlider.value = this.engine.depthOfCut;
      docInput.value = this.engine.depthOfCut;

      const updateDoc = (val) => {
        const clamped = Math.max(0.0, Math.min(12.0, val));
        this.engine.depthOfCut = clamped;
        docSlider.value = clamped;
        docInput.value = clamped.toFixed(1);
      };

      docSlider.addEventListener('input', (e) => updateDoc(parseFloat(e.target.value)));
      docInput.addEventListener('change', (e) => updateDoc(parseFloat(e.target.value)));
    }

    // Carriage Z Position
    const carSlider = document.getElementById('control-carriage-z-slider');
    const carInput = document.getElementById('control-carriage-z-input');
    if (carSlider && carInput) {
      carSlider.value = this.engine.carriageZ;
      carInput.value = this.engine.carriageZ;

      const updateCarZ = (val) => {
        const clamped = Math.max(30.0, Math.min(2500.0, val));
        this.engine.carriageZ = clamped;
        carSlider.value = clamped;
        carInput.value = clamped.toFixed(0);
      };

      carSlider.addEventListener('input', (e) => updateCarZ(parseFloat(e.target.value)));
      carInput.addEventListener('change', (e) => updateCarZ(parseFloat(e.target.value)));
    }

    // Coolant Pump Switch
    const coolantToggle = document.getElementById('control-coolant-toggle');
    if (coolantToggle) {
      coolantToggle.checked = this.engine.coolantOn;
      coolantToggle.addEventListener('change', (e) => {
        this.engine.coolantOn = e.target.checked;
      });
    }

    // Tailstock Live Center Toggle
    const tailstockToggle = document.getElementById('control-tailstock-toggle');
    if (tailstockToggle) {
      tailstockToggle.checked = this.engine.tailstockEngaged;
      tailstockToggle.addEventListener('change', (e) => {
        this.engine.tailstockEngaged = e.target.checked;
      });
    }
  }

  bindWorkpieceAndTool() {
    // Workpiece Material
    const matSelect = document.getElementById('control-material-select');
    if (matSelect) {
      matSelect.innerHTML = Object.keys(WORKPIECE_MATERIALS).map(k => `
        <option value="${k}" ${k === this.engine.materialKey ? 'selected' : ''}>
          ${WORKPIECE_MATERIALS[k].name} (kc1.1=${WORKPIECE_MATERIALS[k].kc1_1})
        </option>
      `).join('');

      matSelect.addEventListener('change', (e) => {
        this.engine.setMaterial(e.target.value);
      });
    }

    // Workpiece Diameter
    const diaInput = document.getElementById('control-workpiece-dia-input');
    if (diaInput) {
      diaInput.value = this.engine.workpieceDiameter;
      diaInput.addEventListener('change', (e) => {
        const maxSwing = this.engine.variant.swingOverBed;
        const val = Math.max(30.0, Math.min(maxSwing, parseFloat(e.target.value) || 250));
        this.engine.workpieceDiameter = val;
        diaInput.value = val;
      });
    }

    // Workpiece Length
    const lenInput = document.getElementById('control-workpiece-len-input');
    if (lenInput) {
      lenInput.value = this.engine.workpieceLength;
      lenInput.addEventListener('change', (e) => {
        const maxBC = this.engine.variant.maxBetweenCentres;
        const val = Math.max(100.0, Math.min(maxBC, parseFloat(e.target.value) || 1000));
        this.engine.workpieceLength = val;
        lenInput.value = val;
      });
    }

    // Tool Material
    const toolSelect = document.getElementById('control-tool-material-select');
    if (toolSelect) {
      toolSelect.innerHTML = Object.keys(TOOL_MATERIALS).map(k => `
        <option value="${k}" ${k === this.engine.toolMaterialKey ? 'selected' : ''}>
          ${TOOL_MATERIALS[k].name} (Max Vc: ${TOOL_MATERIALS[k].maxSurfaceSpeed} m/min)
        </option>
      `).join('');

      toolSelect.addEventListener('change', (e) => {
        this.engine.setToolMaterial(e.target.value);
      });
    }

    // Tool Overhang Slider & Flank Wear
    const overhangSlider = document.getElementById('control-tool-overhang-slider');
    const overhangVal = document.getElementById('control-tool-overhang-val');
    if (overhangSlider) {
      overhangSlider.value = this.engine.toolOverhang;
      if (overhangVal) overhangVal.textContent = `${this.engine.toolOverhang} mm`;

      overhangSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        this.engine.toolOverhang = v;
        if (overhangVal) overhangVal.textContent = `${v} mm`;
      });
    }

    const wearSlider = document.getElementById('control-tool-wear-slider');
    const wearVal = document.getElementById('control-tool-wear-val');
    if (wearSlider) {
      wearSlider.value = this.engine.toolFlankWear;
      if (wearVal) wearVal.textContent = `${this.engine.toolFlankWear.toFixed(2)} mm`;

      wearSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        this.engine.toolFlankWear = v;
        if (wearVal) wearVal.textContent = `${v.toFixed(2)} mm`;
      });
    }
  }

  bindPresets() {
    const presets = [
      {
        id: 'preset-spindle-idle',
        name: 'Spindle Idle',
        apply: () => {
          this.engine.spindleDirection = 1;
          this.engine.speedStepIndex = 15; // 140 RPM (index 15)
          this.engine.depthOfCut = 0.0;
          this.engine.feedMode = 'neutral';
          this.engine.coolantOn = false;
        }
      },
      {
        id: 'preset-facing',
        name: 'Facing',
        apply: () => {
          this.engine.spindleDirection = 1;
          this.engine.speedStepIndex = 13; // 90 RPM (index 13)
          this.engine.depthOfCut = 2.0;
          this.engine.feedMode = 'cross';
          this.engine.feedRate = 0.25;
          this.engine.coolantOn = true;
        }
      },
      {
        id: 'preset-straight-turning',
        name: 'Straight Turning',
        apply: () => {
          this.engine.spindleDirection = 1;
          this.engine.speedStepIndex = 14; // 112 RPM (index 14)
          this.engine.depthOfCut = 3.5;
          this.engine.feedMode = 'longitudinal';
          this.engine.feedRate = 0.35;
          this.engine.coolantOn = true;
        }
      },
      {
        id: 'preset-heavy-cut',
        name: 'Heavy Cut',
        apply: () => {
          this.engine.spindleDirection = 1;
          this.engine.speedStepIndex = 10; // 45 RPM (index 10)
          this.engine.depthOfCut = 8.0;
          this.engine.feedMode = 'longitudinal';
          this.engine.feedRate = 0.55;
          this.engine.setMaterial('alloy_steel');
          this.engine.coolantOn = true;
        }
      },
      {
        id: 'preset-threading',
        name: 'Threading',
        apply: () => {
          this.engine.spindleDirection = 1;
          this.engine.speedStepIndex = 6; // 18 RPM (index 6)
          this.engine.depthOfCut = 0.8;
          this.engine.feedMode = 'threading';
          this.engine.threadPitch = 3.5;
          this.engine.coolantOn = true;
        }
      },
      {
        id: 'preset-drilling',
        name: 'Drilling',
        apply: () => {
          this.engine.spindleDirection = 1;
          this.engine.speedStepIndex = 11; // 56 RPM (index 11)
          this.engine.depthOfCut = 5.0; // 50 mm diameter core drill
          this.engine.feedMode = 'drilling';
          this.engine.feedRate = 0.25;
          this.engine.coolantOn = true;
        }
      },
      {
        id: 'preset-vibration-wear',
        name: 'High Vibration / Wear',
        apply: () => {
          this.engine.spindleDirection = 1;
          this.engine.speedStepIndex = 17; // 224 RPM (index 17)
          this.engine.depthOfCut = 6.0;
          this.engine.feedMode = 'longitudinal';
          this.engine.feedRate = 0.40;
          this.engine.toolOverhang = 95.0; // High overhang triggers chatter
          this.engine.toolFlankWear = 0.35;
          this.engine.coolantOn = false;
        }
      }
    ];

    presets.forEach(p => {
      const btn = document.getElementById(p.id);
      if (btn) {
        btn.addEventListener('click', () => {
          p.apply();
          this.updateControlsFromEngine();
          if (this.onSettingsChanged) this.onSettingsChanged();
        });
      }
    });
  }

  updateControlsFromEngine() {
    this.updateSpindleButtons();
    this.populateSpeedSteps();
    this.updateFeedControlsVisibility();

    const docSlider = document.getElementById('control-doc-slider');
    const docInput = document.getElementById('control-doc-input');
    if (docSlider) docSlider.value = this.engine.depthOfCut;
    if (docInput) docInput.value = this.engine.depthOfCut.toFixed(1);

    const carSlider = document.getElementById('control-carriage-z-slider');
    const carInput = document.getElementById('control-carriage-z-input');
    if (carSlider) carSlider.value = this.engine.carriageZ;
    if (carInput) carInput.value = this.engine.carriageZ.toFixed(0);

    const coolantToggle = document.getElementById('control-coolant-toggle');
    if (coolantToggle) coolantToggle.checked = this.engine.coolantOn;

    const tailstockToggle = document.getElementById('control-tailstock-toggle');
    if (tailstockToggle) tailstockToggle.checked = this.engine.tailstockEngaged;

    const overhangSlider = document.getElementById('control-tool-overhang-slider');
    const overhangVal = document.getElementById('control-tool-overhang-val');
    if (overhangSlider) overhangSlider.value = this.engine.toolOverhang;
    if (overhangVal) overhangVal.textContent = `${this.engine.toolOverhang} mm`;

    const wearSlider = document.getElementById('control-tool-wear-slider');
    const wearVal = document.getElementById('control-tool-wear-val');
    if (wearSlider) wearSlider.value = this.engine.toolFlankWear;
    if (wearVal) wearVal.textContent = `${this.engine.toolFlankWear.toFixed(2)} mm`;

    // Active feed button
    document.querySelectorAll('.feed-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.engine.feedMode);
    });
  }
}
