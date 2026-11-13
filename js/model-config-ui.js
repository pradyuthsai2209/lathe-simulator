/**
 * Model Config UI Manager
 * 
 * Manages the Model Configuration Modal:
 * - Variant specification tables with [VERIFIED] and [ESTIMATED] tags
 * - Editable machine specifications & physical constants
 * - Formula documentation & units
 * - Model assumptions & scope disclosures
 */

import { HMT_VARIANTS, DEFAULT_MODEL_CONSTANTS } from './machine-specs.js';

export class ModelConfigUI {
  constructor(engine, onConfigSaved) {
    this.engine = engine;
    this.onConfigSaved = onConfigSaved;
    this.modalEl = document.getElementById('model-config-modal');
    this.init();
  }

  init() {
    this.bindTriggers();
    this.bindTabs();
    this.renderVariantSpecsTable();
    this.renderConstantsForm();
    this.bindSaveAndReset();
  }

  bindTriggers() {
    const openBtn = document.getElementById('btn-open-model-config');
    const closeBtn = document.getElementById('btn-close-model-config');
    const closeFooterBtn = document.getElementById('btn-modal-close-footer');

    if (openBtn) {
      openBtn.addEventListener('click', () => this.open());
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    if (closeFooterBtn) {
      closeFooterBtn.addEventListener('click', () => this.close());
    }

    // Close on backdrop click
    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) this.close();
      });
    }

    // ESC key close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl && this.modalEl.classList.contains('active')) {
        this.close();
      }
    });
  }

  open() {
    if (this.modalEl) {
      this.renderVariantSpecsTable();
      this.renderConstantsForm();
      this.modalEl.classList.add('active');
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('active');
    }
  }

  bindTabs() {
    const tabBtns = document.querySelectorAll('.modal-tab-btn');
    const tabPanes = document.querySelectorAll('.modal-tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(`tab-pane-${target}`);
        if (activePane) activePane.classList.add('active');
      });
    });
  }

  renderVariantSpecsTable() {
    const container = document.getElementById('config-variant-table-container');
    if (!container) return;

    const variants = ['L45', 'L50', 'L60', 'L70'];
    const specFields = [
      { key: 'heightOfCentres', label: 'Height of Centres', unit: 'mm' },
      { key: 'swingOverBed', label: 'Swing Over Bed', unit: 'mm' },
      { key: 'swingOverCrossSlide', label: 'Swing Over Cross Slide', unit: 'mm' },
      { key: 'spindleBore', label: 'Spindle Bore', unit: 'mm' },
      { key: 'nominalMotorPower', label: 'Spindle Motor Power', unit: 'kW' },
      { key: 'leadScrewPitch', label: 'Lead Screw Pitch', unit: 'mm' },
      { key: 'maxJobWeight', label: 'Max Job Weight (Between Centres)', unit: 'kg' },
      { key: 'tailstockStroke', label: 'Tailstock Sleeve Stroke', unit: 'mm' },
      { key: 'ratedMotorSpeed', label: 'Rated Motor Speed', unit: 'RPM' },
      { key: 'bedWidth', label: 'Bed Width', unit: 'mm' },
      { key: 'machineWeight', label: 'Machine Weight (approx)', unit: 'kg' }
    ];

    container.innerHTML = `
      <table class="config-specs-table">
        <thead>
          <tr>
            <th>Specification Feature</th>
            <th>Verification Status</th>
            ${variants.map(v => `<th>HMT ${v} ${this.engine.variantId === v ? '<span class="badge-active">ACTIVE</span>' : ''}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${specFields.map(f => {
            const isVer = HMT_VARIANTS.L45.isVerified[f.key];
            const statusBadge = isVer ?
              '<span class="spec-verified">✓ HMT DOCUMENTED</span>' :
              '<span class="spec-estimated">~ ESTIMATED / EDITABLE</span>';

            return `
              <tr>
                <td class="spec-label">
                  <strong>${f.label}</strong>
                  <span class="spec-unit">(${f.unit})</span>
                </td>
                <td class="spec-status">${statusBadge}</td>
                ${variants.map(v => `
                  <td>
                    <input type="number" 
                      class="config-spec-input" 
                      data-variant="${v}" 
                      data-key="${f.key}" 
                      value="${HMT_VARIANTS[v][f.key]}" 
                      step="${f.key === 'nominalMotorPower' || f.key === 'leadScrewPitch' ? '0.1' : '1'}"
                    />
                  </td>
                `).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  renderConstantsForm() {
    const container = document.getElementById('config-constants-form-container');
    if (!container) return;

    const c = this.engine.constants;

    container.innerHTML = `
      <div class="constants-grid">
        <div class="constant-group">
          <label>Supply Voltage Nominal (VL)</label>
          <div class="input-with-unit">
            <input type="number" id="cfg-voltage" value="${c.supplyVoltageNominal}" step="1" />
            <span>V (3-Phase)</span>
          </div>
          <p class="field-hint">Indian standard industrial 415V 50Hz supply.</p>
        </div>

        <div class="constant-group">
          <label>Grid Frequency Nominal</label>
          <div class="input-with-unit">
            <input type="number" id="cfg-freq" value="${c.gridFrequencyNominal}" step="0.5" />
            <span>Hz</span>
          </div>
          <p class="field-hint">AC line supply frequency (50 Hz).</p>
        </div>

        <div class="constant-group">
          <label>Gearbox Mechanical Efficiency (η_mech)</label>
          <div class="input-with-unit">
            <input type="number" id="cfg-gear-eff" value="${c.gearboxMechanicalEfficiency}" step="0.01" min="0.5" max="0.99" />
            <span>ratio (0-1)</span>
          </div>
          <p class="field-hint">Headstock multi-stage transmission efficiency (0.86 typical).</p>
        </div>

        <div class="constant-group">
          <label>Motor Rated Efficiency (η_elec)</label>
          <div class="input-with-unit">
            <input type="number" id="cfg-motor-eff" value="${c.motorNominalEfficiency}" step="0.01" min="0.5" max="0.99" />
            <span>ratio (0-1)</span>
          </div>
          <p class="field-hint">Induction motor full-load electrical conversion efficiency.</p>
        </div>

        <div class="constant-group">
          <label>Base Tare Power (P_tare)</label>
          <div class="input-with-unit">
            <input type="number" id="cfg-tare-power" value="${c.tarePowerBaseKw}" step="0.1" />
            <span>kW</span>
          </div>
          <p class="field-hint">No-load mechanical bearing & oil churning friction power.</p>
        </div>

        <div class="constant-group">
          <label>Coolant Tank Capacity</label>
          <div class="input-with-unit">
            <input type="number" id="cfg-coolant-vol" value="${c.coolantTankVolumeLiters}" step="5" />
            <span>Liters</span>
          </div>
          <p class="field-hint">Fluid volume in chip pan sump for thermal mass integration.</p>
        </div>

        <div class="constant-group">
          <label>Standard Tool Overhang</label>
          <div class="input-with-unit">
            <input type="number" id="cfg-overhang" value="${c.toolOverhangStandardMm}" step="5" />
            <span>mm</span>
          </div>
          <p class="field-hint">Nominal rigid tool post extension before flexure amplification.</p>
        </div>

        <div class="constant-group">
          <label>ISO 10816 Class B Limit (Satisfactory)</label>
          <div class="input-with-unit">
            <input type="number" id="cfg-vib-limit" value="${c.isoVibrationSeveritySatisfactory}" step="0.1" />
            <span>mm/s RMS</span>
          </div>
          <p class="field-hint">Vibration severity threshold for heavy industrial lathe beds.</p>
        </div>
      </div>
    `;
  }

  bindSaveAndReset() {
    const saveBtn = document.getElementById('btn-save-model-config');
    const resetBtn = document.getElementById('btn-reset-model-config');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        // Collect variant table inputs
        document.querySelectorAll('.config-spec-input').forEach(input => {
          const v = input.dataset.variant;
          const k = input.dataset.key;
          const val = parseFloat(input.value);
          if (HMT_VARIANTS[v] && !isNaN(val)) {
            HMT_VARIANTS[v][k] = val;
          }
        });

        // Collect constants form inputs
        const getNum = (id, fallback) => {
          const el = document.getElementById(id);
          return el ? parseFloat(el.value) || fallback : fallback;
        };

        const updatedConstants = {
          supplyVoltageNominal: getNum('cfg-voltage', 415.0),
          gridFrequencyNominal: getNum('cfg-freq', 50.0),
          gearboxMechanicalEfficiency: getNum('cfg-gear-eff', 0.86),
          motorNominalEfficiency: getNum('cfg-motor-eff', 0.91),
          tarePowerBaseKw: getNum('cfg-tare-power', 1.25),
          coolantTankVolumeLiters: getNum('cfg-coolant-vol', 150),
          toolOverhangStandardMm: getNum('cfg-overhang', 45.0),
          isoVibrationSeveritySatisfactory: getNum('cfg-vib-limit', 4.5)
        };

        this.engine.updateConstants(updatedConstants);
        this.engine.setVariant(this.engine.variantId); // refresh active variant copy

        if (this.onConfigSaved) this.onConfigSaved();
        this.close();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset all machine specifications and constants to factory verified HMT defaults?')) {
          this.engine.constants = { ...DEFAULT_MODEL_CONSTANTS };
          this.renderVariantSpecsTable();
          this.renderConstantsForm();
          if (this.onConfigSaved) this.onConfigSaved();
        }
      });
    }
  }
}
