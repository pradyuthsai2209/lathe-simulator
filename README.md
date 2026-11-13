# HMT Heavy Duty Lathe L45 / L50 / L60 / L70 Series Simulator

An interactive browser-based digital twin and engineering telemetry test bench for the **HMT Heavy Duty Lathe Series (L45, L50, L60, and L70)**, designed with reference to the technical control-room interface, navigation hierarchy, live telemetry, and data export workflows of the [Manual Transmission Simulator](https://anishhn.github.io/manual-transmission-simulator/).

---

## Key Features

### 1. Interface & Navigation Hierarchy
- **Technical Control-Room Aesthetic**: Dark-themed, high-contrast, responsive industrial control interface with real-time gauges, status indicators, and warning badges.
- **Top Navigation Tabs**:
  - **3D Live Cockpit**: Large interactive 3D digital twin cutaway, operator control panel, compact telemetry cards, and calculated kinematics table.
  - **Performance Graphs Studio**: High-frequency 60 FPS Canvas plotting with 8 distinct chart modes, time windowing, live statistics (Active, Min, Max, Mean), interactive scrub crosshair, and graph CSV export.
  - **Test Cases & Data Bench**: Suite of 8 pre-configured industrial tests, custom test case creator, automated execution, pass/fail validation against engineering criteria, multi-test overlay comparison, and 19-channel paginated time-series inspection table.
- **Persistent Status Bar**:
  - Machine model variant indicator, simulation time, operating state pill.
  - One-click controls for **Model Config**, **Pause/Resume** (with Spacebar shortcut), **Reset**, and **Export Live Log** (exact 19-channel CSV).

---

## Machine Model & Verified Specifications

The machine dimensions, speed steps, feed ranges, and ratings are verified against published **HMT Machine Tools Limited** heavy-duty lathe documentation:

| Feature | HMT L45 | HMT L50 | HMT L60 | HMT L70 | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Height of Centres** | 450 mm | 500 mm | 600 mm | 700 mm | **[VERIFIED]** |
| **Swing Over Bed** | 900 mm | 1000 mm | 1150 mm | 1350 mm | **[VERIFIED]** |
| **Swing Over Cross Slide** | 570 mm | 670 mm | 870 mm | 1000 mm | **[VERIFIED]** |
| **Spindle Bore Passage** | 110 mm | 110 mm | 110 mm | 110 mm | **[VERIFIED]** |
| **Nominal Spindle Motor** | 18.5 kW | 18.5 kW | 22.0 kW | 22.0 kW | **[VERIFIED]** |
| **Forward Spindle Speeds** | 21 steps (4.5 to 450 RPM) | 21 steps (4.5 to 450 RPM) | 21 steps (4.5 to 450 RPM) | 21 steps (4.5 to 450 RPM) | **[VERIFIED]** |
| **Reverse Spindle Speeds** | 6 steps (9 to 450 RPM) | 6 steps (9 to 450 RPM) | 6 steps (9 to 450 RPM) | 6 steps (9 to 450 RPM) | **[VERIFIED]** |
| **Longitudinal Feeds** | 77 steps (0.1 to 6.4 mm/rev) | 77 steps (0.1 to 6.4 mm/rev) | 77 steps (0.1 to 6.4 mm/rev) | 77 steps (0.1 to 6.4 mm/rev) | **[VERIFIED]** |
| **Cross Feeds** | 71 steps (0.05 to 3.2 mm/rev) | 71 steps (0.05 to 3.2 mm/rev) | 71 steps (0.05 to 3.2 mm/rev) | 71 steps (0.05 to 3.2 mm/rev) | **[VERIFIED]** |
| **Lead Screw Pitch** | 6.0 mm | 6.0 mm | 6.0 mm | 6.0 mm | **[VERIFIED]** |
| **Tailstock Sleeve Stroke** | 325 mm, MT-6 taper | 325 mm, MT-6 taper | 325 mm, MT-6 taper | 325 mm, MT-6 taper | **[VERIFIED]** |
| **Max Weight on Centres** | 3,500 kg (5,500 kg steady) | 3,500 kg (5,500 kg steady) | 4,000 kg (6,000 kg steady) | 4,500 kg (7,000 kg steady) | **[VERIFIED]** |
| **Rated Motor Speed** | 1440 RPM | 1440 RPM | 1450 RPM | 1450 RPM | **[ESTIMATED / STANDARD]** |
| **Machine Bed Width** | 650 mm | 700 mm | 750 mm | 800 mm | **[ESTIMATED / EDITABLE]** |

All specifications and physical constants are editable in real time in the **Model Config** modal.

---

## Mathematical & Physics Modeling Architecture

The simulation runs a deterministic, fixed-step numerical integration loop ($\Delta t = 0.02$ s / 50 Hz):

1. **Cutting Speed**:
   $$V_c = \frac{\pi \cdot D \cdot N_{spindle}}{1000} \quad [\text{m/min}]$$

2. **Kienzle Specific Cutting Force Model**:
   $$k_c = k_{c1.1} \cdot h^{-m_c} \cdot \left(1 - \frac{\gamma}{100}\right) \cdot K_{wear} \cdot K_{coolant} \quad [\text{N/mm}^2]$$
   where $h = f \cdot \sin(\kappa_r)$ is the uncut chip thickness.

3. **Tangential Cutting Force & Spindle Torque**:
   $$F_c = k_c \cdot a_p \cdot f \quad [\text{N}]$$
   $$M_c = F_c \cdot \frac{D}{2000} \quad [\text{N}\cdot\text{m}]$$

4. **Spindle Cutting Power & Motor Electrical Input**:
   $$P_c = \frac{F_c \cdot V_c}{60000} \quad [\text{kW}]$$
   $$P_{mech} = \frac{P_c}{\eta_{gearbox}} + P_{tare} \quad [\text{kW}]$$
   $$P_{elec} = \frac{P_{mech}}{\eta_{elec}(P_{mech})} + P_{pump} \quad [\text{kW}]$$

5. **3-Phase Symmetrical Line Current**:
   $$I = \frac{P_{elec} \cdot 1000}{\sqrt{3} \cdot V_L \cdot \cos\phi} \quad [\text{A}]$$
   at nominal 415 V supply.

6. **Loewen & Shaw Flash Temperature Model**:
   $$\Delta T = \frac{0.38 \cdot k_c}{\rho \cdot c_p} \left(\frac{V_c \cdot f}{\alpha}\right)^{0.33} \cdot C_{coolant} \quad [^\circ\text{C}]$$

7. **Vibration Severity (ISO 10816)**:
   Accounts for baseline rotational unbalance, dynamic cutting force fluctuations, tool overhang flexure ($\delta \propto L^3 / (3EI)$), and regenerative chatter when $a_p > a_{lim}$.

---

## 19-Channel Time-Series CSV Export Format

Both the **Export Live Log** button and the **Test Bench Data Exporter** generate CSV files with the exact 19 ordered channels:

1. `TIME (S)`
2. `OPERATING STATE`
3. `MOTOR RPM`
4. `GEARBOX INPUT RPM`
5. `SPINDLE RPM`
6. `FEED SHAFT RPM`
7. `CUTTING TORQUE (N·M)`
8. `SPINDLE POWER (KW)`
9. `MOTOR INPUT POWER (KW)`
10. `VOLTAGE (V)`
11. `CURRENT (A)`
12. `DRIVE FREQUENCY (HZ)`
13. `SPEED STEP`
14. `COOLANT TEMP (°C)`
15. `CUTTING ZONE TEMP (°C)`
16. `ENERGY USE (KWH)`
17. `CUMULATIVE ENERGY (KWH)`
18. `VIBRATION RMS (MM/S)`
19. `SPINDLE SPEED ERROR (RPM)`

---

## How to Run

1. Open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).
2. Alternatively, serve via Python:
   ```bash
   python -m http.server 8080
   ```
   and navigate to `http://localhost:8080`.
