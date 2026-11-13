/**
 * Performance Graphs Studio
 * 
 * High-performance Canvas-based engineering charting suite.
 * Features:
 * - 8 distinct chart modes matching specifications:
 *   1. Speeds (Motor, Gearbox, Spindle, Feed Shaft) vs Time
 *   2. Spindle Speed vs Cutting Torque (XY curve & operating envelope)
 *   3. Spindle & Motor Input Power vs Time
 *   4. Vibration RMS vs Time with ISO 10816 severity thresholds
 *   5. Coolant & Cutting Zone Temperatures vs Time
 *   6. Electrical Telemetry (Power, Current, Energy) vs Time
 *   7. Cutting Force & Material Removal Rate (MRR) vs Time
 *   8. Multi-Channel Telemetry Overview (4-tier synchronized view)
 * - Time window filtering: 5s, 10s, 30s, 60s, 120s, All
 * - Live stats: Active, Min, Max, Mean
 * - Interactive hover cursor scrubber & tooltip
 * - Pause/Resume, Clear, Export CSV
 */

import { generateLatheTelemetryCSV, downloadCSV } from './csv-exporter.js';

export class PerformanceGraphsStudio {
  constructor(canvasId, statsContainerId, engine) {
    this.canvas = document.getElementById(canvasId);
    this.statsContainer = document.getElementById(statsContainerId);
    this.engine = engine;

    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Chart Configuration State
    this.currentChartMode = 'speeds_vs_time';
    this.timeWindow = 30; // seconds (0 = All)
    this.isRecording = true;
    this.hoverData = null; // Mouse hover crosshair state

    this.initEvents();
    this.startRenderLoop();
  }

  setChartMode(mode) {
    this.currentChartMode = mode;
    this.updateStats();
  }

  setTimeWindow(seconds) {
    this.timeWindow = seconds;
  }

  toggleRecording() {
    this.isRecording = !this.isRecording;
    if (this.engine) {
      this.engine.isRecording = this.isRecording;
    }
    return this.isRecording;
  }

  clearHistory() {
    if (this.engine) {
      this.engine.history = [];
    }
    this.updateStats();
  }

  exportCurrentGraphCSV() {
    const data = this.getFilteredData();
    const csv = generateLatheTelemetryCSV(data);
    const filename = `hmt_lathe_${this.engine.variantId}_${this.currentChartMode}_${Date.now()}.csv`;
    downloadCSV(filename, csv);
  }

  initEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();

    // Mouse hover tracking for scrub tooltip
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.handleHover(mouseX, mouseY);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverData = null;
    });
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth || 800;
    const h = parent.clientHeight || 450;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.scale(dpr, dpr);
    this.cssWidth = w;
    this.cssHeight = h;
  }

  getFilteredData() {
    if (!this.engine || !this.engine.history || this.engine.history.length === 0) {
      return [];
    }

    const hist = this.engine.history;
    if (this.timeWindow === 0) {
      return hist; // All
    }

    const latestTime = hist[hist.length - 1].timeS;
    const cutoff = Math.max(0, latestTime - this.timeWindow);
    return hist.filter(d => d.timeS >= cutoff);
  }

  handleHover(mouseX, mouseY) {
    const data = this.getFilteredData();
    if (data.length < 2) return;

    const padLeft = 70;
    const padRight = 30;
    const graphW = this.cssWidth - padLeft - padRight;

    if (mouseX < padLeft || mouseX > this.cssWidth - padRight) {
      this.hoverData = null;
      return;
    }

    if (this.currentChartMode === 'speed_vs_torque') {
      // XY plot hover nearest point
      let nearest = null;
      let minDist = 999999;
      for (const d of data) {
        // Find closest
        const dist = Math.abs(d.cuttingTorqueNm);
        if (dist < minDist) {
          minDist = dist;
          nearest = d;
        }
      }
      this.hoverData = { record: nearest, mouseX, mouseY };
      return;
    }

    // Time-series hover: map mouseX to index
    const frac = (mouseX - padLeft) / graphW;
    const index = Math.min(data.length - 1, Math.max(0, Math.floor(frac * data.length)));
    this.hoverData = {
      record: data[index],
      mouseX,
      mouseY
    };
  }

  startRenderLoop() {
    const loop = () => {
      this.draw();
      this.updateStats();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    if (!ctx || !w || !h) return;

    // Background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, w, h);

    const data = this.getFilteredData();

    if (this.currentChartMode === 'multi_channel_overview') {
      this.drawMultiChannelOverview(ctx, data, w, h);
      return;
    }

    if (this.currentChartMode === 'speed_vs_torque') {
      this.drawSpeedVsTorqueXY(ctx, data, w, h);
      return;
    }

    // Standard Single Chart
    this.drawSingleChart(ctx, data, w, h);
  }

  drawSingleChart(ctx, data, w, h) {
    const padL = 70;
    const padR = 30;
    const padT = 40;
    const padB = 45;
    const gw = w - padL - padR;
    const gh = h - padT - padB;

    // Draw Grid & Axes
    this.drawAxes(ctx, padL, padT, gw, gh);

    if (data.length < 2) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COLLECTING TELEMETRY STREAM...', padL + gw / 2, padT + gh / 2);
      return;
    }

    const seriesList = this.getSeriesForMode(this.currentChartMode);

    // Compute Y Bounds across series
    let minY = Infinity;
    let maxY = -Infinity;

    seriesList.forEach(s => {
      data.forEach(d => {
        const v = d[s.key];
        if (v !== undefined) {
          if (v < minY) minY = v;
          if (v > maxY) maxY = v;
        }
      });
    });

    if (minY === Infinity) { minY = 0; maxY = 100; }
    if (minY > 0) minY = 0; // Baseline zero
    if (maxY <= minY) maxY = minY + 10;
    maxY = maxY * 1.15; // 15% headroom

    // Grid lines and Y labels
    const yTicks = 5;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= yTicks; i++) {
      const frac = i / yTicks;
      const yVal = minY + (maxY - minY) * (1 - frac);
      const yPos = padT + frac * gh;

      ctx.strokeStyle = '#1a2233';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, yPos);
      ctx.lineTo(padL + gw, yPos);
      ctx.stroke();

      ctx.fillText(yVal.toFixed(yVal < 10 && yVal !== 0 ? 2 : 1), padL - 8, yPos + 4);
    }

    // Draw ISO 10816 Threshold bands for Vibration mode
    if (this.currentChartMode === 'vibration_vs_time') {
      this.drawVibrationBands(ctx, padL, padT, gw, gh, minY, maxY);
    }

    // X Axis Time Labels
    const startTime = data[0].timeS;
    const endTime = data[data.length - 1].timeS;
    ctx.textAlign = 'center';
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const frac = i / xTicks;
      const tVal = startTime + (endTime - startTime) * frac;
      const xPos = padL + frac * gw;

      ctx.fillText(`${tVal.toFixed(1)}s`, xPos, padT + gh + 18);
    }

    // Plot Series Lines
    seriesList.forEach(s => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || 2;
      ctx.beginPath();

      for (let i = 0; i < data.length; i++) {
        const fracX = i / (data.length - 1);
        const x = padL + fracX * gw;
        const val = data[i][s.key] !== undefined ? data[i][s.key] : minY;
        const fracY = (val - minY) / (maxY - minY);
        const y = padT + (1 - fracY) * gh;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Area fill for primary series
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.lineTo(padL + gw, padT + gh);
        ctx.lineTo(padL, padT + gh);
        ctx.closePath();
        ctx.fill();
      }
    });

    // Draw Title & Legend
    this.drawLegend(ctx, seriesList, padL, padT - 15);

    // Draw Interactive Hover Crosshair
    if (this.hoverData && this.hoverData.record) {
      this.drawHoverScrubber(ctx, this.hoverData, padL, padT, gw, gh, seriesList);
    }
  }

  drawVibrationBands(ctx, padL, padT, gw, gh, minY, maxY) {
    const zones = [
      { max: 1.8, label: 'Zone A: Good (ISO 10816)', color: 'rgba(34, 197, 94, 0.08)' },
      { max: 4.5, label: 'Zone B: Satisfactory', color: 'rgba(234, 179, 8, 0.08)' },
      { max: 11.2, label: 'Zone C: Unsatisfactory', color: 'rgba(249, 115, 22, 0.08)' },
      { max: maxY, label: 'Zone D: Damaging / Chatter', color: 'rgba(239, 68, 68, 0.12)' }
    ];

    let prevMax = 0;
    zones.forEach(z => {
      if (prevMax >= maxY) return;
      const topVal = Math.min(maxY, z.max);
      const fracBottom = (prevMax - minY) / (maxY - minY);
      const fracTop = (topVal - minY) / (maxY - minY);
      const yBottom = padT + (1 - fracBottom) * gh;
      const yTop = padT + (1 - fracTop) * gh;

      ctx.fillStyle = z.color;
      ctx.fillRect(padL, yTop, gw, yBottom - yTop);

      ctx.fillStyle = '#64748b88';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(z.label, padL + gw - 8, yTop + 14);

      prevMax = z.max;
    });
  }

  drawSpeedVsTorqueXY(ctx, data, w, h) {
    const padL = 70;
    const padR = 40;
    const padT = 40;
    const padB = 45;
    const gw = w - padL - padR;
    const gh = h - padT - padB;

    this.drawAxes(ctx, padL, padT, gw, gh);

    ctx.fillStyle = '#00e5ff';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SPINDLE SPEED (RPM) vs CUTTING TORQUE (N·m) [OPERATING ENVELOPE]', padL, padT - 15);

    if (data.length < 2) return;

    // X = Torque, Y = Speed
    const maxTorque = Math.max(1200, ...data.map(d => d.cuttingTorqueNm * 1.25));
    const maxSpeed = Math.max(500, ...data.map(d => Math.abs(d.spindleRpm) * 1.15));

    // Draw Operating Power Hyperbola Curve (Constant Power P = T * w)
    ctx.strokeStyle = '#38bdf833';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const pKw = this.engine.variant.nominalMotorPower;
    for (let t = 20; t <= maxTorque; t += 20) {
      // P = (T * 2*pi*N / 60) / 1000 => N = (P * 60000) / (2 * pi * T)
      const nHyp = (pKw * 60000) / (2 * Math.PI * t);
      const x = padL + (t / maxTorque) * gw;
      const y = padT + (1 - Math.min(1.0, nHyp / maxSpeed)) * gh;
      if (t === 20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot Scatter points / trajectory trail
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const x = padL + (d.cuttingTorqueNm / maxTorque) * gw;
      const y = padT + (1 - Math.abs(d.spindleRpm) / maxSpeed) * gh;
      const alpha = 0.3 + 0.7 * (i / data.length);

      ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, i === data.length - 1 ? 5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Latest operating point beacon
    const latest = data[data.length - 1];
    const curX = padL + (latest.cuttingTorqueNm / maxTorque) * gw;
    const curY = padT + (1 - Math.abs(latest.spindleRpm) / maxSpeed) * gh;

    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(curX, curY, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Axes Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CUTTING TORQUE (N·m)', padL + gw / 2, padT + gh + 35);
  }

  drawMultiChannelOverview(ctx, data, w, h) {
    const padL = 70;
    const padR = 30;
    const padT = 30;
    const padB = 30;
    const totalH = h - padT - padB;
    const stripH = (totalH - 30) / 4;
    const gw = w - padL - padR;

    const channels = [
      { title: 'SPINDLE & MOTOR RPM', keys: [{ k: 'spindleRpm', c: '#00e5ff' }, { k: 'motorRpm', c: '#3b82f6' }], unit: 'RPM' },
      { title: 'POWER CONSUMPTION', keys: [{ k: 'spindlePowerKw', c: '#10b981' }, { k: 'motorInputPowerKw', c: '#f59e0b' }], unit: 'kW' },
      { title: 'VIBRATION RMS', keys: [{ k: 'vibrationRmsMmS', c: '#ec4899' }], unit: 'mm/s' },
      { title: 'CUTTING ZONE & COOLANT TEMP', keys: [{ k: 'cuttingZoneTempC', c: '#ef4444' }, { k: 'coolantTempC', c: '#06b6d4' }], unit: '°C' }
    ];

    channels.forEach((ch, idx) => {
      const topY = padT + idx * (stripH + 10);

      // Background strip
      ctx.fillStyle = '#0f1420';
      ctx.fillRect(padL, topY, gw, stripH);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(padL, topY, gw, stripH);

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ch.title, padL + 8, topY + 14);

      if (data.length < 2) return;

      // Plot
      ch.keys.forEach(kObj => {
        let maxV = -Infinity;
        let minV = Infinity;
        data.forEach(d => {
          const v = d[kObj.k] || 0;
          if (v > maxV) maxV = v;
          if (v < minV) minV = v;
        });
        if (minV > 0) minV = 0;
        if (maxV <= minV) maxV = minV + 1;
        maxV *= 1.15;

        ctx.strokeStyle = kObj.c;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = padL + (i / (data.length - 1)) * gw;
          const yVal = data[i][kObj.k] || 0;
          const y = topY + stripH - ((yVal - minV) / (maxV - minV)) * (stripH - 20) - 4;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Latest value badge
        const latestVal = data[data.length - 1][kObj.k] || 0;
        ctx.fillStyle = kObj.c;
        ctx.textAlign = 'right';
        ctx.fillText(`${latestVal.toFixed(1)} ${ch.unit}`, padL + gw - 8, topY + 14);
      });
    });
  }

  drawAxes(ctx, padL, padT, gw, gh) {
    ctx.strokeStyle = '#27354a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padL, padT, gw, gh);
  }

  drawLegend(ctx, seriesList, padL, y) {
    ctx.font = '11px "JetBrains Mono", monospace';
    let offsetX = padL;

    seriesList.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.fillRect(offsetX, y - 8, 12, 4);
      offsetX += 18;

      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(`${s.label} (${s.unit})`, offsetX, y - 4);
      offsetX += ctx.measureText(`${s.label} (${s.unit})`).width + 20;
    });
  }

  drawHoverScrubber(ctx, hover, padL, padT, gw, gh, seriesList) {
    const x = hover.mouseX;
    const r = hover.record;

    // Vertical line
    ctx.strokeStyle = '#ffffff66';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + gh);
    ctx.stroke();
    ctx.setLineDash([]);

    // Floating Tooltip Box
    const tipW = 190;
    const tipH = 24 + seriesList.length * 16;
    let tipX = x + 15;
    if (tipX + tipW > padL + gw) tipX = x - tipW - 15;
    const tipY = Math.min(padT + gh - tipH, Math.max(padT, hover.mouseY - 20));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.fillRect(tipX, tipY, tipW, tipH);
    ctx.strokeRect(tipX, tipY, tipW, tipH);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`T = ${r.timeS.toFixed(2)}s | ${r.operatingState}`, tipX + 8, tipY + 16);

    seriesList.forEach((s, idx) => {
      const val = r[s.key] !== undefined ? r[s.key] : 0;
      ctx.fillStyle = s.color;
      ctx.fillText(`${s.label}: ${val.toFixed(1)} ${s.unit}`, tipX + 8, tipY + 34 + idx * 16);
    });
  }

  getSeriesForMode(mode) {
    switch (mode) {
      case 'speeds_vs_time':
        return [
          { key: 'spindleRpm', label: 'Spindle Speed', color: '#00e5ff', unit: 'RPM', fill: 'rgba(0, 229, 255, 0.05)' },
          { key: 'motorRpm', label: 'Motor Speed', color: '#3b82f6', unit: 'RPM' },
          { key: 'gearboxInputRpm', label: 'Gearbox In', color: '#a855f7', unit: 'RPM' },
          { key: 'feedShaftRpm', label: 'Feed Shaft', color: '#f59e0b', unit: 'RPM' }
        ];
      case 'power_vs_time':
        return [
          { key: 'spindlePowerKw', label: 'Spindle Cut Power', color: '#10b981', unit: 'kW', fill: 'rgba(16, 185, 129, 0.08)' },
          { key: 'motorInputPowerKw', label: 'Motor Elec Power', color: '#f59e0b', unit: 'kW' }
        ];
      case 'vibration_vs_time':
        return [
          { key: 'vibrationRmsMmS', label: 'Vibration RMS', color: '#ec4899', unit: 'mm/s', fill: 'rgba(236, 72, 153, 0.1)' }
        ];
      case 'temperature_vs_time':
        return [
          { key: 'cuttingZoneTempC', label: 'Cutting Zone', color: '#ef4444', unit: '°C' },
          { key: 'coolantTempC', label: 'Coolant Sump', color: '#06b6d4', unit: '°C' }
        ];
      case 'electrical_vs_time':
        return [
          { key: 'motorInputPowerKw', label: 'Elec Power', color: '#10b981', unit: 'kW' },
          { key: 'currentA', label: 'Line Current', color: '#f59e0b', unit: 'A' },
          { key: 'cumulativeEnergyKwh', label: 'Cumulative Energy', color: '#a855f7', unit: 'kWh' }
        ];
      case 'cutting_force_mrr':
        return [
          { key: 'tangentialForceN', label: 'Cutting Force Fc', color: '#f43f5e', unit: 'N', fill: 'rgba(244, 63, 94, 0.08)' },
          { key: 'mrrCm3Min', label: 'MRR', color: '#00e5ff', unit: 'cm³/min' }
        ];
      default:
        return [
          { key: 'spindleRpm', label: 'Spindle RPM', color: '#00e5ff', unit: 'RPM' }
        ];
    }
  }

  updateStats() {
    if (!this.statsContainer) return;

    const data = this.getFilteredData();
    const seriesList = this.getSeriesForMode(this.currentChartMode);
    const primarySeries = seriesList[0];

    if (!primarySeries || data.length === 0) {
      this.statsContainer.innerHTML = `
        <div class="stat-pill"><span class="stat-label">ACTIVE</span><span class="stat-val">--</span></div>
        <div class="stat-pill"><span class="stat-label">MIN</span><span class="stat-val">--</span></div>
        <div class="stat-pill"><span class="stat-label">MAX</span><span class="stat-val">--</span></div>
        <div class="stat-pill"><span class="stat-label">MEAN</span><span class="stat-val">--</span></div>
      `;
      return;
    }

    const key = primarySeries.key;
    const unit = primarySeries.unit;
    const values = data.map(d => d[key] !== undefined ? d[key] : 0);

    const active = values[values.length - 1];
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const mean = sum / values.length;

    this.statsContainer.innerHTML = `
      <div class="stat-pill primary">
        <span class="stat-label">ACTIVE (${primarySeries.label})</span>
        <span class="stat-val">${active.toFixed(1)} ${unit}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-label">MIN</span>
        <span class="stat-val">${min.toFixed(1)} ${unit}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-label">MAX</span>
        <span class="stat-val">${max.toFixed(1)} ${unit}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-label">MEAN</span>
        <span class="stat-val">${mean.toFixed(1)} ${unit}</span>
      </div>
    `;
  }
}
