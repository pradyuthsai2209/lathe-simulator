/**
 * Telemetry UI & Calculated Metrics Manager
 * 
 * Updates the 16+ live telemetry cards, gauge meters, operating state pill,
 * active safety interlock banners, and the comprehensive Calculated Metrics table.
 */

export class TelemetryUI {
  constructor(engine) {
    this.engine = engine;
    this.initElements();
  }

  initElements() {
    // Top & Status bar indicators
    this.elStatePill = document.getElementById('status-operating-state');
    this.elSimTime = document.getElementById('status-sim-time');
    this.elVariantBadge = document.getElementById('status-variant-badge');
    this.elAlertsContainer = document.getElementById('active-alerts-banner');

    // 16+ Primary Telemetry Card Elements
    this.cards = {
      motorRpm: document.getElementById('card-motor-rpm'),
      gearboxInputRpm: document.getElementById('card-gearbox-input-rpm'),
      spindleRpm: document.getElementById('card-spindle-rpm'),
      feedShaftRpm: document.getElementById('card-feed-shaft-rpm'),
      cuttingTorque: document.getElementById('card-cutting-torque'),
      spindlePower: document.getElementById('card-spindle-power'),
      motorPower: document.getElementById('card-motor-power'),
      voltage: document.getElementById('card-voltage'),
      current: document.getElementById('card-current'),
      frequency: document.getElementById('card-frequency'),
      speedStep: document.getElementById('card-speed-step'),
      coolantTemp: document.getElementById('card-coolant-temp'),
      cuttingZoneTemp: document.getElementById('card-cutting-zone-temp'),
      energyRate: document.getElementById('card-energy-rate'),
      cumulativeEnergy: document.getElementById('card-cumulative-energy'),
      vibrationRms: document.getElementById('card-vibration-rms'),
      spindleSlip: document.getElementById('card-spindle-slip')
    };

    // Gauge bar elements
    this.gauges = {
      spindleRpmBar: document.getElementById('gauge-spindle-rpm-bar'),
      powerBar: document.getElementById('gauge-power-bar'),
      vibrationBar: document.getElementById('gauge-vibration-bar'),
      tempBar: document.getElementById('gauge-temp-bar')
    };

    // Calculated Metrics Table container
    this.elMetricsTable = document.getElementById('calculated-metrics-tbody');
  }

  update() {
    const snap = this.engine.getTelemetrySnapshot();

    // 1. Operating State & Sim Time
    if (this.elStatePill) {
      this.elStatePill.textContent = snap.operatingState;
      this.elStatePill.className = `status-pill state-${snap.operatingState.toLowerCase()}`;
    }
    if (this.elSimTime) {
      this.elSimTime.textContent = `${snap.timeS.toFixed(1)}s`;
    }
    if (this.elVariantBadge) {
      this.elVariantBadge.textContent = `HMT ${snap.variantId}`;
    }

    // 2. Active Interlocks & Alerts Banner
    if (this.elAlertsContainer) {
      if (snap.activeInterlocks && snap.activeInterlocks.length > 0) {
        this.elAlertsContainer.style.display = 'block';
        this.elAlertsContainer.innerHTML = snap.activeInterlocks.map(alert => `
          <div class="alert-item alert-${alert.level.toLowerCase()}">
            <span class="alert-badge">[${alert.level}]</span>
            <span class="alert-msg">${alert.message}</span>
          </div>
        `).join('');
      } else {
        this.elAlertsContainer.style.display = 'none';
        this.elAlertsContainer.innerHTML = '';
      }
    }

    // 3. Update Cards
    if (this.cards.motorRpm) this.cards.motorRpm.textContent = snap.motorRpm.toFixed(1);
    if (this.cards.gearboxInputRpm) this.cards.gearboxInputRpm.textContent = snap.gearboxInputRpm.toFixed(1);
    if (this.cards.spindleRpm) this.cards.spindleRpm.textContent = snap.spindleRpm.toFixed(1);
    if (this.cards.feedShaftRpm) this.cards.feedShaftRpm.textContent = snap.feedShaftRpm.toFixed(1);
    if (this.cards.cuttingTorque) this.cards.cuttingTorque.textContent = snap.cuttingTorqueNm.toFixed(2);
    if (this.cards.spindlePower) this.cards.spindlePower.textContent = snap.spindlePowerKw.toFixed(2);
    if (this.cards.motorPower) this.cards.motorPower.textContent = snap.motorInputPowerKw.toFixed(2);
    if (this.cards.voltage) this.cards.voltage.textContent = snap.voltageV.toFixed(1);
    if (this.cards.current) this.cards.current.textContent = snap.currentA.toFixed(1);
    if (this.cards.frequency) this.cards.frequency.textContent = snap.driveFrequencyHz.toFixed(1);
    if (this.cards.speedStep) this.cards.speedStep.textContent = snap.speedStep;
    if (this.cards.coolantTemp) this.cards.coolantTemp.textContent = snap.coolantTempC.toFixed(1);
    if (this.cards.cuttingZoneTemp) this.cards.cuttingZoneTemp.textContent = snap.cuttingZoneTempC.toFixed(1);
    if (this.cards.energyRate) this.cards.energyRate.textContent = snap.energyUseKwh.toFixed(3);
    if (this.cards.cumulativeEnergy) this.cards.cumulativeEnergy.textContent = snap.cumulativeEnergyKwh.toFixed(4);
    if (this.cards.vibrationRms) this.cards.vibrationRms.textContent = snap.vibrationRmsMmS.toFixed(2);
    if (this.cards.spindleSlip) this.cards.spindleSlip.textContent = snap.spindleSpeedErrorRpm.toFixed(1);

    // 4. Update Gauge Bars
    if (this.gauges.spindleRpmBar) {
      const pct = Math.min(100, (Math.abs(snap.spindleRpm) / 450.0) * 100);
      this.gauges.spindleRpmBar.style.width = `${pct}%`;
    }
    if (this.gauges.powerBar) {
      const ratedP = this.engine.variant.nominalMotorPower;
      const pct = Math.min(100, (snap.motorInputPowerKw / ratedP) * 100);
      this.gauges.powerBar.style.width = `${pct}%`;
      this.gauges.powerBar.className = `gauge-fill ${pct > 100 ? 'bar-danger' : (pct > 80 ? 'bar-warning' : 'bar-normal')}`;
    }
    if (this.gauges.vibrationBar) {
      const pct = Math.min(100, (snap.vibrationRmsMmS / 12.0) * 100);
      this.gauges.vibrationBar.style.width = `${pct}%`;
      this.gauges.vibrationBar.className = `gauge-fill ${snap.vibrationRmsMmS > 4.5 ? 'bar-danger' : (snap.vibrationRmsMmS > 1.8 ? 'bar-warning' : 'bar-normal')}`;
    }
    if (this.gauges.tempBar) {
      const pct = Math.min(100, ((snap.cuttingZoneTempC - 20) / 700.0) * 100);
      this.gauges.tempBar.style.width = `${pct}%`;
      this.gauges.tempBar.className = `gauge-fill ${snap.cuttingZoneTempC > 500 ? 'bar-danger' : (snap.cuttingZoneTempC > 300 ? 'bar-warning' : 'bar-normal')}`;
    }

    // 5. Update Calculated Lathe Metrics Table (Section 04)
    if (this.elMetricsTable) {
      const feedPerRevDisplay = (this.engine.feedMode === 'longitudinal' || this.engine.feedMode === 'cross') ?
        `${this.engine.feedRate.toFixed(2)} mm/rev` : 'Disengaged (0.00)';
      const threadPitchDisplay = this.engine.feedMode === 'threading' ?
        `${this.engine.threadPitch.toFixed(2)} mm` : 'N/A (Feed Rod Mode)';

      const rows = [
        { metric: 'Machine Variant & Swing', val: `HMT ${snap.variantId} (Swing: ${this.engine.variant.swingOverBed} mm)`, unit: 'Spec', formula: 'Verified HMT standard' },
        { metric: 'Selected Speed Step', val: snap.speedStep, unit: 'Gear Stage', formula: 'Discrete 21-speed gearbox' },
        { metric: 'Spindle Actual RPM', val: snap.spindleRpm.toFixed(1), unit: 'RPM', formula: 'N_spindle = N_motor / i_gearbox' },
        { metric: 'Spindle Speed Error / Slip', val: snap.spindleSpeedErrorRpm.toFixed(1), unit: 'RPM', formula: 'ΔN = N_nominal - N_actual' },
        { metric: 'Feed per Revolution', val: feedPerRevDisplay, unit: 'mm/rev', formula: 'Apron quick-change feed gearbox' },
        { metric: 'Thread Pitch (Lead Screw)', val: threadPitchDisplay, unit: 'mm', formula: 'Half-nut kinematic sync: P_thread' },
        { metric: 'Cutting Speed (Vc)', val: snap.cuttingSpeedMMin.toFixed(1), unit: 'm/min', formula: 'Vc = (π · D · N) / 1000' },
        { metric: 'Tangential Cutting Force (Fc)', val: snap.tangentialForceN.toFixed(1), unit: 'N', formula: 'Fc = kc · ap · f (Kienzle model)' },
        { metric: 'Feed Force (Ff) / Radial (Fp)', val: `${snap.feedForceN.toFixed(1)} / ${snap.radialForceN.toFixed(1)}`, unit: 'N', formula: 'Ff = 0.38·Fc, Fp = 0.28·Fc' },
        { metric: 'Specific Cutting Force (kc)', val: snap.specificCuttingForceNmm2.toFixed(1), unit: 'N/mm²', formula: 'kc = kc1.1 · h^(-mc) · K_wear' },
        { metric: 'Cutting Torque (Mc)', val: snap.cuttingTorqueNm.toFixed(2), unit: 'N·m', formula: 'Mc = Fc · (D / 2000)' },
        { metric: 'Spindle Cutting Power (Pc)', val: snap.spindlePowerKw.toFixed(2), unit: 'kW', formula: 'Pc = (Fc · Vc) / 60000' },
        { metric: 'Motor Electrical Power (Pe)', val: snap.motorInputPowerKw.toFixed(2), unit: 'kW', formula: 'Pe = (Pc / η_mech + P_tare) / η_elec' },
        { metric: 'Motor Thermal Load %', val: `${snap.motorThermalLoadPercent.toFixed(1)}%`, unit: '% Rated', formula: '(Pe / P_rated) · 100%' },
        { metric: 'Material Removal Rate (MRR)', val: snap.mrrCm3Min.toFixed(1), unit: 'cm³/min', formula: 'MRR = Vc · ap · f' },
        { metric: 'Estimated Surface Roughness (Ra)', val: snap.surfaceRoughnessRaUm > 0 ? snap.surfaceRoughnessRaUm.toFixed(2) : 'N/A', unit: 'µm', formula: 'Ra ≈ f² / (32 · r_ε)' },
        { metric: 'Taylor Tool Life Estimate', val: `${snap.estimatedToolLifeMin.toFixed(0)} min`, unit: 'min', formula: 'Vc · T^n = C' },
        { metric: 'Vibration RMS Severity', val: `${snap.vibrationRmsMmS.toFixed(2)} mm/s`, unit: 'ISO 10816', formula: 'Dynamic cutting force + unbalance' },
        { metric: 'Cutting Zone Temperature', val: `${snap.cuttingZoneTempC.toFixed(1)} °C`, unit: '°C', formula: 'Loewen & Shaw flash model' },
        { metric: 'Coolant Sump Temperature', val: `${snap.coolantTempC.toFixed(1)} °C`, unit: '°C', formula: 'Lumped tank thermal capacitance' },
        { metric: 'Cumulative Energy Consumption', val: `${snap.cumulativeEnergyKwh.toFixed(4)} kWh`, unit: 'kWh', formula: '∫ Pe dt' },
        { metric: 'Active Operating Regime', val: snap.operatingState, unit: 'State', formula: 'Coupled supervisor state machine' }
      ];

      this.elMetricsTable.innerHTML = rows.map(r => `
        <tr>
          <td class="metric-name font-mono">${r.metric}</td>
          <td class="metric-value font-mono text-cyan">${r.val}</td>
          <td class="metric-unit font-mono text-muted">${r.unit}</td>
          <td class="metric-formula font-mono text-subtle">${r.formula}</td>
        </tr>
      `).join('');
    }
  }
}
