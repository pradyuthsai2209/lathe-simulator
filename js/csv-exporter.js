/**
 * 19-Channel Lathe Time-Series CSV Exporter
 * 
 * Strict Column Order:
 * 1. TIME (S)
 * 2. OPERATING STATE
 * 3. MOTOR RPM
 * 4. GEARBOX INPUT RPM
 * 5. SPINDLE RPM
 * 6. FEED SHAFT RPM
 * 7. CUTTING TORQUE (N\u00B7M)
 * 8. SPINDLE POWER (KW)
 * 9. MOTOR INPUT POWER (KW)
 * 10. VOLTAGE (V)
 * 11. CURRENT (A)
 * 12. DRIVE FREQUENCY (HZ)
 * 13. SPEED STEP
 * 14. COOLANT TEMP (\u00B0C)
 * 15. CUTTING ZONE TEMP (\u00B0C)
 * 16. ENERGY USE (KWH)
 * 17. CUMULATIVE ENERGY (KWH)
 * 18. VIBRATION RMS (MM/S)
 * 19. SPINDLE SPEED ERROR (RPM)
 */

export const CSV_HEADERS = [
  'TIME (S)',
  'OPERATING STATE',
  'MOTOR RPM',
  'GEARBOX INPUT RPM',
  'SPINDLE RPM',
  'FEED SHAFT RPM',
  'CUTTING TORQUE (N\u00B7M)',
  'SPINDLE POWER (KW)',
  'MOTOR INPUT POWER (KW)',
  'VOLTAGE (V)',
  'CURRENT (A)',
  'DRIVE FREQUENCY (HZ)',
  'SPEED STEP',
  'COOLANT TEMP (\u00B0C)',
  'CUTTING ZONE TEMP (\u00B0C)',
  'ENERGY USE (KWH)',
  'CUMULATIVE ENERGY (KWH)',
  'VIBRATION RMS (MM/S)',
  'SPINDLE SPEED ERROR (RPM)'
];

export function generateLatheTelemetryCSV(records) {
  if (!records || records.length === 0) {
    return CSV_HEADERS.join(',') + '\n';
  }

  const lines = [CSV_HEADERS.join(',')];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const row = [
      (r.timeS !== undefined ? r.timeS : 0.0).toFixed(2),
      `"${r.operatingState || 'UNKNOWN'}"`,
      (r.motorRpm !== undefined ? r.motorRpm : 0.0).toFixed(1),
      (r.gearboxInputRpm !== undefined ? r.gearboxInputRpm : 0.0).toFixed(1),
      (r.spindleRpm !== undefined ? r.spindleRpm : 0.0).toFixed(1),
      (r.feedShaftRpm !== undefined ? r.feedShaftRpm : 0.0).toFixed(1),
      (r.cuttingTorqueNm !== undefined ? r.cuttingTorqueNm : 0.0).toFixed(2),
      (r.spindlePowerKw !== undefined ? r.spindlePowerKw : 0.0).toFixed(2),
      (r.motorInputPowerKw !== undefined ? r.motorInputPowerKw : 0.0).toFixed(2),
      (r.voltageV !== undefined ? r.voltageV : 0.0).toFixed(1),
      (r.currentA !== undefined ? r.currentA : 0.0).toFixed(1),
      (r.driveFrequencyHz !== undefined ? r.driveFrequencyHz : 0.0).toFixed(1),
      `"${r.speedStep || 'N/A'}"`,
      (r.coolantTempC !== undefined ? r.coolantTempC : 0.0).toFixed(1),
      (r.cuttingZoneTempC !== undefined ? r.cuttingZoneTempC : 0.0).toFixed(1),
      (r.energyUseKwh !== undefined ? r.energyUseKwh : 0.0).toFixed(3),
      (r.cumulativeEnergyKwh !== undefined ? r.cumulativeEnergyKwh : 0.0).toFixed(4),
      (r.vibrationRmsMmS !== undefined ? r.vibrationRmsMmS : 0.0).toFixed(2),
      (r.spindleSpeedErrorRpm !== undefined ? r.spindleSpeedErrorRpm : 0.0).toFixed(1)
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
