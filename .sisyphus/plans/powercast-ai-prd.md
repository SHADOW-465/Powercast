# Product Requirements Document (PRD)
## Powercast AI - Multi-Region Grid Forecasting & Decision Support System

**Version:** 2.0  
**Date:** January 26, 2026  
**Document Owner:** Senior Product Manager  
**Stakeholders:** Grid Operators, Plant Managers, Energy Analysts, Government Agencies  

---

## Executive Summary

### Product Vision
Powercast AI is an AI-powered electrical load forecasting and decision support platform designed to optimize power generation scheduling, maintenance planning, and capacity expansion across **India and Switzerland** (with extensibility to other regions). The platform empowers grid operators and plant managers to make data-driven decisions that reduce costs, improve grid stability, and maximize renewable energy utilization.

### Business Objectives
1. **Cost Savings**: Reduce over-generation waste and fuel costs through accurate forecasting (Target: 12-18% reduction in operational costs)
2. **Grid Stability**: Prevent blackouts and load shedding via proactive demand-supply balancing
3. **Market Opportunity**: Capture B2B SaaS market targeting utility companies and government grid agencies in India and Switzerland
4. **Research & Innovation**: Establish credibility as a leader in AI-driven grid optimization for emerging markets

### Success Metrics (Year 1)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Forecast Accuracy (MAPE)** | <8% overall | Thermal/Nuclear: ±5%, Solar/Wind: ±12% |
| **System Uptime** | 99.5% | Monthly availability tracking |
| **API Latency (P95)** | <5 seconds | Forecast generation time |
| **User Adoption** | 15 utility companies | Active subscriptions (India + Switzerland) |
| **Cost Savings** | CHF 2.5M | Documented savings across pilot deployments |

---

## Problem Statement

### Current Pain Points
1. **Inaccurate Forecasting**: Traditional methods fail to capture nonlinear temporal patterns in renewable energy sources (solar/wind variability)
2. **Over-Generation Waste**: Excess power generation during low demand periods leads to 15-20% cost inefficiency
3. **Reactive Maintenance**: Unplanned downtime costs utilities ₹8-12 crore annually per plant
4. **Renewable Integration Challenges**: India's 175 GW renewable target by 2026 requires sophisticated grid balancing
5. **Data Silos**: Plant operators lack unified dashboards combining historical, real-time, and forecast data

### Target Users
| Persona | Role | Key Needs | Pain Points |
|---------|------|-----------|-------------|
| **Grid Operator** (Primary) | Dispatch control, real-time balancing | Intraday (15-min to 6h) forecasts, anomaly alerts | System instability during peak demand |
| **Plant Manager** (Primary) | Operations, maintenance scheduling | Day-ahead (24-48h) forecasts, maintenance windows | Unplanned shutdowns, capacity underutilization |
| **Energy Analyst** (Primary) | Performance tracking, reporting | Historical accuracy trends, export capabilities | Manual data aggregation from multiple sources |
| **Utility Executive** (Secondary) | Strategic planning, investment | Long-term (week/month) forecasts, ROI metrics | Lack of actionable insights for capacity expansion |

---

## Product Scope

### In-Scope (MVP + Phase 1)
✅ **Core Forecasting**
- XGBoost-based multi-horizon forecasting (hours, days, weeks)
- Support for 5 plant types: Solar, Hydro, Wind, Nuclear, Thermal
- Confidence intervals (Q10/Q50/Q90) for uncertainty quantification
- Real-time CSV upload + API ingestion (SCADA/POSOCO compatible)

✅ **Data Integration**
- CSV upload with validation (15-minute interval data)
- Weather API integration (OpenWeatherMap: irradiance, wind speed, temperature)
- Real-time SCADA data connector (OPC UA/IEC 61850 protocols)
- Multi-region timezone support (IST for India, CET/CEST for Switzerland)

✅ **Decision Support**
- Generator ON/OFF recommendations based on load forecasts
- Maintenance window identification (low-load period detection)
- Dynamic optimization suggestions (fuel efficiency, dispatch timing)
- Export reports (PDF executive summary + Excel with charts)

✅ **User Experience**
- Modern pill-box UI design with glassmorphism
- Multi-horizon graph visualization (scrollable for 8760+ data points)
- Auto-refresh forecasts (10-15 min intervals) + manual refresh
- AI chat assistant (Gemini 2.0 Flash for Q&A)

### Out-of-Scope (Future Phases)
❌ Multi-plant comparison dashboard (Phase 2)  
❌ Automated SCADA control commands (Phase 3)  
❌ Mobile native app (Phase 2)  
❌ Carbon footprint tracking (Phase 3)  
❌ Anomaly detection with ML alerts (Phase 2)  

---

## Technical Architecture

### System Overview
```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                  │
│  - Dashboard, Forecasts, Optimize Tabs                   │
│  - Recharts visualization + CSV export                   │
│  - Zustand state management + localStorage               │
└────────────────┬─────────────────────────────────────────┘
                 │ REST API
┌────────────────▼─────────────────────────────────────────┐
│                 Backend (FastAPI - Python)                │
│  - XGBoost inference service (96 sub-models)             │
│  - Weather API integration (OpenWeatherMap)              │
│  - SCADA data connector (OPC UA client)                  │
│  - Report generation (PDF/Excel via ReportLab/openpyxl)  │
└────────────────┬─────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│              Database (Supabase PostgreSQL)               │
│  - User authentication (email/password, future SSO)      │
│  - Forecast data (time-series partitioning)              │
│  - Plant configurations (generator metadata)             │
│  - Audit logs (GDPR/compliance)                          │
└──────────────────────────────────────────────────────────┘
```

### Technology Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript | Modern SSR framework, excellent DX |
| **Backend** | FastAPI (Python 3.11+) | High-performance async, native ML integration |
| **ML Model** | XGBoost 2.0.3 (96 sub-models) | Industry-leading accuracy for time-series |
| **Database** | Supabase (PostgreSQL 15) | Managed DB with built-in auth, real-time subscriptions |
| **State Management** | Zustand + localStorage | Lightweight, persistent session state |
| **Visualization** | Recharts | Responsive charts, good performance with large datasets |
| **AI Assistant** | Gemini 2.0 Flash API | Conversational Q&A for grid operators |
| **Weather API** | OpenWeatherMap (Solar Irradiance API) | 15-min intervals, global coverage, affordable |

### ML Model Specifications

**XGBoost Multi-Horizon Architecture:**
- **96 individual XGBRegressor models** (one per 15-minute interval in 24-hour window)
- **Hyperparameters** (from `training_config.json`):
  - `n_estimators`: 500
  - `max_depth`: 7
  - `learning_rate`: 0.061156
  - `subsample`: 0.822780
  - `colsample_bytree`: 0.918789

**Performance Metrics (Validation Set):**
- Test MAPE: **0.9108%** (exceeds industry target of <8%)
- MAE: **69.16 MW**
- Inference Time: **157.83 ms** (well under 5s requirement)
- Coverage 90%: **91.04%** (high confidence interval accuracy)

**Feature Engineering (21 features):**
1. **Lag Features**: 1h, 6h, 24h, 168h (7 days)
2. **Rolling Statistics**: 24h mean/std, 168h mean/std
3. **Calendar Features**: Hour (sin/cos), Day of week (sin/cos), Month (sin/cos), Weekend flag, Peak hour flag
4. **Weather Features**: Temperature, humidity, wind speed, irradiance (solar), cloud cover, precipitation

**Conformal Prediction**:
- Provides uncertainty quantification via quantile intervals (Q10, Q50, Q90)
- Critical for risk-aware decision making in grid operations

---

## Data Standards & Integration

### CSV Format (Standard Grid API Schema)

**Base Schema** (All Plant Types):
```csv
timestamp,output_mw,temperature,humidity,wind_speed,[plant_specific_cols]
2024-01-15T00:00:00Z,680,4.5,72,2.8,142.5,87.2
```

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `timestamp` | ISO 8601 (UTC) | 15-minute intervals | `2024-01-15T00:15:00Z` |
| `output_mw` | float | Power output in MW | `680.5` |
| `temperature` | float | Ambient temp (°C) | `4.5` |
| `humidity` | int | Relative humidity (%) | `72` |
| `wind_speed` | float | Wind speed (m/s) | `2.8` |

**Plant-Specific Extensions**:
- **Solar**: `cloud_cover` (%), `irradiance` (W/m²)
- **Hydro**: `water_flow_rate` (m³/s), `reservoir_level` (%)
- **Wind**: `wind_direction` (degrees), `turbulence` (%)
- **Thermal**: `fuel_consumption` (tons/h), `efficiency` (%)
- **Nuclear**: `reactor_temp` (°C), `capacity_factor` (%)

### Regional Compliance

**India (POSOCO/SLDC Standards)**:
- Follows **Forum of Regulators (FOR)** 5-minute scheduling guidelines
- Data interval: 15-minute blocks (compatible with POSOCO reporting)
- Timezone: IST (UTC+5:30)
- Regulatory: CEA reporting formats, MNRE renewable integration norms

**Switzerland (Swissgrid/ENTSO-E Standards)**:
- Aligns with **ENTSO-E Transparency Platform** schemas
- Data interval: 15-minute (EU standard)
- Timezone: CET/CEST (UTC+1/+2 with DST handling)
- Regulatory: Swiss Federal Electricity Act compliance

### API Integration Points

**SCADA Connector** (Real-time Data):
- **Protocol**: OPC UA (IEC 62541) - industry standard for industrial automation
- **Fallback**: IEC 61850 for legacy systems
- **Polling Interval**: 5 minutes (aggregated to 15-min for forecasting)
- **Data Points**: Active power (MW), reactive power (MVAR), frequency, voltage

**Weather API** (OpenWeatherMap):
- **Endpoint**: `https://api.openweathermap.org/energy/2.0/solar/interval_data`
- **Parameters**: `lat`, `lon`, `date`, `interval=15m`
- **Data**: GHI (Global Horizontal Irradiance), DNI, DHI, cloud cover, wind speed
- **Cost**: ~$500/month for 100,000 calls (suitable for 50 plants with hourly updates)

---

## Functional Requirements

### FR1: Dashboard - Plant Configuration

**User Story**: As a plant manager, I want to configure my plant's parameters so the system can generate accurate forecasts.

**Acceptance Criteria**:
- [ ] User selects plant type from 5 options (Solar, Hydro, Wind, Nuclear, Thermal)
- [ ] User inputs plant name (max 100 characters) and total capacity (MW, integer 1-10,000)
- [ ] **Generator Configuration** (NEW):
  - User adds 1-10 generator units with individual capacities
  - Each unit has ON/OFF status, minimum turndown level (%), ramp rate (MW/min)
  - Example: Solar Plant (500 MW) = Inverter 1 (200 MW) + Inverter 2 (300 MW)
- [ ] CSV upload validates against plant type schema (shows errors if columns missing)
- [ ] System displays data summary: row count, avg output, max output, date range
- [ ] "Initialize Forecast" button is disabled until plant name + CSV + valid capacity

**Technical Notes**:
- Store generator configs in `plant_generators` table (FK to `plants`)
- Validation logic in `lib/utils/csv-parser.ts` (add generator-level checks)

---

### FR2: Forecasts - Multi-Horizon Visualization

**User Story**: As a grid operator, I want to view forecasts for different time horizons (hours, days, weeks) to plan dispatch schedules.

**Acceptance Criteria**:
- [ ] Horizon selector: **Hours** (6h, 12h, 24h, 48h) | **Days** (3d, 7d, 14d) | **Weeks** (4w, 12w)
- [ ] Graph adjusts X-axis dynamically:
  - Hours: 15-min ticks
  - Days: Hourly ticks
  - Weeks: Daily ticks
- [ ] Chart is horizontally scrollable for >200 data points (no UI glitches)
- [ ] Confidence bands (Q10-Q90) shown as shaded area
- [ ] Metrics update to match selected horizon: Peak Output, Avg Output, Total Energy
- [ ] Export button downloads CSV with filtered data (only selected horizon)
- [ ] Auto-refresh every 10-15 minutes (user sees countdown timer)
- [ ] Manual refresh button (spins on click, shows "Last updated: 2m ago")

**Performance Requirements**:
- Graph renders 8,760 data points (1 year hourly) in <3 seconds
- Smooth scrolling (60 FPS) with 1000+ points visible
- Use virtualization for large datasets (react-window or similar)

**Technical Notes**:
- XGBoost model supports up to 96 intervals (24h). For longer horizons:
  - 7 days = 7 separate 24h forecasts (chained)
  - 12 weeks = Weekly aggregates from daily forecasts
- Store forecast cache in Supabase with 24h TTL

---

### FR3: Optimize - Dynamic Recommendations

**User Story**: As a plant manager, I want AI-generated optimization suggestions based on my actual forecast data to improve efficiency.

**Acceptance Criteria**:
- [ ] **Generator ON/OFF Table**:
  - Shows each generator unit with current status, forecasted load, and recommended action
  - Logic: If forecast < (generator min turndown × capacity), recommend OFF
  - Example: Thermal Unit 2 (300 MW, 40% min) → If forecast shows 100 MW → Recommend OFF
- [ ] **Maintenance Windows**:
  - Identifies 4-hour+ periods where forecast is <50% of capacity
  - Displays table: Date/Time, Duration, Forecasted Avg Load, Potential Savings (CHF/₹)
- [ ] **Efficiency Recommendations**:
  - Plant-specific suggestions (from demo: 13 hardcoded, replace with dynamic)
  - Priority-coded (High=Red, Medium=Yellow, Low=Green)
  - Impact estimates: Cost savings (CHF/₹), Efficiency gain (%), Energy capture (+MW)
- [ ] **Apply/Dismiss Actions**:
  - "Apply" logs recommendation to audit trail (no automated SCADA control in MVP)
  - "Dismiss" hides from list (persists in session storage)
- [ ] Export recommendations as PDF report (executive summary format)

**Recommendation Logic** (Pseudo-code):
```python
# Generator ON/OFF
for unit in plant.generators:
    if forecast_avg < (unit.capacity * unit.min_turndown):
        recommend_action = "Turn OFF to save fuel"
        estimated_savings = calculate_idle_cost(unit, duration_hours)

# Maintenance Windows
low_load_periods = forecast.find_consecutive_periods(
    threshold=plant.capacity * 0.5, 
    min_duration_hours=4
)
for period in low_load_periods:
    recommend_window = {
        "start": period.start_time,
        "end": period.end_time,
        "avg_load": period.avg_mw,
        "impact": "Minimal grid disruption"
    }
```

**Technical Notes**:
- Replace static `PLANT_SUGGESTIONS` array with database table + dynamic generation
- Use forecast data from `forecastData` store to calculate real-time suggestions

---

### FR4: Weather Integration

**User Story**: As the system, I need real-time weather data to improve forecast accuracy for renewable plants.

**Acceptance Criteria**:
- [ ] On plant creation, user provides lat/lon or selects from map
- [ ] System fetches weather data from OpenWeatherMap API every hour
- [ ] Weather features integrated into XGBoost input:
  - Solar: `irradiance`, `cloud_cover`
  - Wind: `wind_speed`, `wind_direction`, `turbulence`
  - Hydro: `precipitation` (24h accumulated), `temperature` (snow melt proxy)
- [ ] Fallback to historical averages if API fails (no blocking errors)
- [ ] Weather data cached in Supabase for 7 days (cost optimization)
- [ ] User sees weather icon in forecast header (e.g., ☀️ Clear, 850 W/m²)

**API Response Schema** (OpenWeatherMap Solar Irradiance):
```json
{
  "lat": 28.6139,
  "lon": 77.2090,
  "date": "2026-01-26",
  "interval": "15m",
  "data": [
    {
      "dt": 1706256000,
      "ghi": 850.5,
      "dni": 920.3,
      "dhi": 120.8,
      "cloud_cover": 15
    }
  ]
}
```

**Cost Estimate**: 50 plants × 24 calls/day = 36,000 calls/month → ~$180/month

**Technical Notes**:
- Create `weather_cache` table with composite index on (lat, lon, timestamp)
- Weather fetcher service runs as cron job (every hour)

---

### FR5: SCADA Real-Time Connector

**User Story**: As a grid operator, I want the system to automatically pull live data from my SCADA system so forecasts stay current without manual CSV uploads.

**Acceptance Criteria**:
- [ ] Admin configures SCADA endpoint via UI:
  - Protocol: OPC UA or IEC 61850
  - Server URL: `opc.tcp://192.168.1.100:4840`
  - Node ID: `ns=2;s=PlantOutput.ActivePower`
  - Poll interval: 5 minutes
- [ ] System validates connection (green checkmark if successful)
- [ ] Live data populates forecast chart with "LIVE" badge
- [ ] Historical CSV data + live SCADA data merged seamlessly on graph
- [ ] If SCADA connection fails, system falls back to last CSV data (shows warning)
- [ ] Audit log records all SCADA data fetch events (timestamp, value, status)

**Security**:
- SCADA credentials stored encrypted (AES-256) in Supabase vault
- Connection over VPN or secure tunnel (no public internet exposure)
- IP whitelisting for SCADA server access

**Technical Notes**:
- Use `asyncua` library (Python) for OPC UA client
- SCADA connector runs as background worker (Celery or similar)
- Create `scada_connections` and `scada_data` tables

---

### FR6: Export Reports (PDF/Excel)

**User Story**: As an energy analyst, I want to export forecast data and recommendations as professional reports for management review.

**Acceptance Criteria**:
- [ ] **Excel Export**:
  - Contains 3 sheets: "Forecast Data", "Metrics Summary", "Recommendations"
  - Forecast Data: timestamp, output_mw, q10, q50, q90, actual (if available)
  - Charts embedded (line chart for forecast, bar chart for metrics)
  - File naming: `{PlantName}_Forecast_{Date}.xlsx`
- [ ] **PDF Export** (Executive Summary):
  - Cover page: Plant name, logo, date range, report period
  - Page 1: Key Metrics (Peak, Avg, Efficiency, Savings)
  - Page 2: Forecast chart with annotations (peak hours highlighted)
  - Page 3: Top 5 Recommendations with impact estimates
  - Page 4: Accuracy analysis (if historical data available)
  - File naming: `{PlantName}_ExecutiveSummary_{Date}.pdf`
- [ ] Export triggered from "Download" button in Forecasts/Optimize tabs
- [ ] Progress indicator during generation (typically 3-5 seconds)
- [ ] Files auto-downloaded to user's device (no email in MVP)

**Technical Notes**:
- Excel: `openpyxl` (Python) or `exceljs` (Node.js)
- PDF: `ReportLab` (Python) with custom templates
- Charts rendered as PNG via `matplotlib` or `Recharts` server-side

---

## Non-Functional Requirements

### NFR1: Performance
| Metric | Requirement | Measurement Method |
|--------|-------------|-------------------|
| Forecast Generation | P95 latency <5s | API endpoint monitoring (96-interval prediction) |
| Page Load Time | <3s (first contentful paint) | Lighthouse CI in build pipeline |
| Chart Rendering | 8,760 points in <3s | Browser DevTools Performance tab |
| API Throughput | 100 concurrent forecasts | Load testing with Locust/k6 |
| Database Queries | <200ms (95th percentile) | Supabase query analyzer |

### NFR2: Scalability
- **Horizontal Scaling**: Backend API supports auto-scaling (3-10 instances based on load)
- **Data Volume**: Handle 1,000 plants × 8,760 data points/year = ~8.76M rows
- **Concurrent Users**: Support 500 simultaneous users across India + Switzerland timezones
- **Forecast Storage**: Partition time-series data by month (PostgreSQL partitioning)

### NFR3: Security & Compliance

**India Compliance**:
- **Data Localization**: Store Indian utility data in Mumbai region (AWS ap-south-1)
- **Audit Logs**: Retain for 7 years (as per CEA guidelines)
- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Access Control**: Role-based (Admin, Analyst, Viewer)

**Switzerland Compliance**:
- **GDPR**: Right to erasure, data portability, consent management
- **Data Residency**: EU region (Frankfurt - eu-central-1)
- **Audit Logs**: 3-year retention

**Multi-Tenancy Isolation**:
- Row-Level Security (RLS) in Supabase (each plant belongs to one organization)
- API keys scoped to organization ID
- No cross-tenant data leakage (verified via penetration testing)

### NFR4: Reliability
- **Uptime SLA**: 99.5% (max 3.65 hours downtime/month)
- **Data Backup**: Automated daily backups, 30-day retention
- **Disaster Recovery**: RTO=4 hours, RPO=15 minutes
- **Failover**: Multi-region deployment (India: Mumbai + Delhi, Switzerland: Frankfurt)

### NFR5: Observability
- **Logging**: Structured logs (JSON) to CloudWatch/Datadog
- **Metrics**: Prometheus for API latency, error rates, forecast accuracy
- **Tracing**: OpenTelemetry for distributed request tracing
- **Alerting**: PagerDuty for critical errors (forecast failure, SCADA disconnect)

---

## User Journey Flows

### Primary Flow: Generate First Forecast
```
1. User logs in → Dashboard tab
2. Selects plant type (e.g., Solar)
3. Enters plant name ("Rajasthan Solar Park") + capacity (500 MW)
4. Adds generator units:
   - Inverter 1: 200 MW, Min 20%, Ramp 5 MW/min
   - Inverter 2: 300 MW, Min 20%, Ramp 8 MW/min
5. Uploads CSV (solar_farm_data.csv) → System validates
6. Clicks "Initialize Forecast" → Redirects to Forecasts tab
7. Views 24h forecast chart with confidence bands
8. Selects 7-day horizon → Chart updates
9. Reviews recommendations in Optimize tab
10. Exports PDF executive summary
```

### Secondary Flow: SCADA Live Integration
```
1. Admin goes to Settings → SCADA Connectors
2. Clicks "Add SCADA Source"
3. Enters OPC UA endpoint: opc.tcp://10.0.1.50:4840
4. Selects data tags: ActivePower, Frequency, Voltage
5. Tests connection → Green checkmark
6. Sets poll interval: 5 minutes
7. Saves configuration
8. System starts background polling
9. Forecasts tab shows "LIVE" badge
10. Graph auto-updates every 15 minutes with new data
```

---

## Roadmap & Milestones

### Phase 1: MVP (Months 1-3)
**Goal**: Single-plant forecasting with XGBoost + basic UI

| Week | Deliverable | Owner |
|------|-------------|-------|
| 1-2 | Backend API scaffold (FastAPI + XGBoost model loader) | Backend Team |
| 3-4 | Frontend dashboard + forecast visualization (Next.js) | Frontend Team |
| 5-6 | CSV upload + validation + generator config | Full Stack |
| 7-8 | Weather API integration (OpenWeatherMap) | Backend Team |
| 9-10 | Dynamic recommendations engine | ML Team |
| 11-12 | PDF/Excel export + QA testing | Full Stack |

**Milestone**: Beta launch with 3 pilot customers (1 India, 1 Switzerland, 1 internal)

### Phase 2: Scale (Months 4-6)
**Goal**: Multi-plant comparison + SCADA integration

| Feature | Priority | Estimated Effort |
|---------|----------|------------------|
| SCADA real-time connector (OPC UA) | P0 | 3 weeks |
| Multi-plant comparison dashboard | P0 | 2 weeks |
| Historical accuracy tracking | P1 | 2 weeks |
| Alert/notification system (email) | P1 | 1 week |
| API for third-party integrations | P2 | 2 weeks |
| Role-based access control (RBAC) | P2 | 1 week |

**Milestone**: Production launch, onboard 15 utility companies

### Phase 3: Advanced (Months 7-12)
**Goal**: Anomaly detection + carbon tracking

| Feature | Priority | Estimated Effort |
|---------|----------|------------------|
| Anomaly detection with ML alerts | P1 | 4 weeks |
| Carbon footprint tracking | P1 | 3 weeks |
| What-if scenario analysis | P2 | 3 weeks |
| Mobile app (React Native) | P2 | 6 weeks |
| Advanced analytics (Prophet, LSTM) | P3 | 4 weeks |

**Milestone**: Market leader in India renewable forecasting

---

## Success Criteria & KPIs

### Technical KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Forecast Accuracy (MAPE)** | <8% | Weekly validation against actual data |
| **Thermal/Nuclear MAPE** | ±5% | Plant-type specific tracking |
| **Solar/Wind MAPE** | ±12% | Seasonal analysis (monsoon vs clear sky) |
| **P95 API Latency** | <5s | Prometheus metrics |
| **Uptime** | 99.5% | Pingdom/Uptime Robot |
| **Chart Render Time** | <3s for 8760 points | Lighthouse CI |

### Business KPIs
| Metric | Target (Year 1) | Measurement |
|--------|-----------------|-------------|
| **Active Customers** | 15 utility companies | Subscription tracking |
| **Revenue (ARR)** | CHF 500K | Billing system |
| **Cost Savings Delivered** | CHF 2.5M | Customer success surveys |
| **User Adoption Rate** | 70% of pilots convert | Sales pipeline |
| **NPS Score** | >40 | Quarterly surveys |

### User Satisfaction
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time Saved vs Manual** | 80% reduction | User interviews |
| **Forecast Trust Score** | 4.2/5.0 | In-app rating |
| **Feature Adoption** | 60% use recommendations | Product analytics |

---

## Risk Analysis & Mitigation

### Technical Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| XGBoost model drift (accuracy degrades) | Medium | High | Automated retraining pipeline (weekly), A/B testing |
| SCADA integration failures (protocol incompatibility) | High | Medium | Support multiple protocols (OPC UA, IEC 61850, Modbus), fallback to CSV |
| Scalability bottlenecks (100k+ forecasts/day) | Low | High | Horizontal scaling, Redis caching, database partitioning |
| Weather API downtime | Medium | Medium | 7-day cache, fallback to historical averages |

### Business Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Slow pilot adoption (utilities resist change) | Medium | High | Free 3-month trial, on-site implementation support |
| Regulatory changes (CERC/FOR new rules) | Low | Medium | Modular architecture, compliance expert on retainer |
| Competitive entry (Siemens, GE launch similar) | Medium | High | First-mover advantage, focus on emerging markets (India) |

### Compliance Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| GDPR violations (data breach) | Low | Critical | Penetration testing, SOC 2 certification, insurance |
| Data localization non-compliance (India) | Low | High | Multi-region deployment, legal review |

---

## Implementation & Onboarding Strategy

### Overview
To ensure successful adoption in the Indian market (primary focus for MVP), Powercast AI will employ a **hybrid implementation model** that balances scalability with hands-on customer success.

### SCADA Integration Approach

**Phase 1: MVP (First 5-10 Customers) - Hands-On**
- **Powercast AI team** handles all SCADA integrations
- On-site visits to customer facilities (2-3 days per plant)
- Direct collaboration with customer IT/OT teams
- **Objectives**:
  - Understand common SCADA configurations in Indian utilities
  - Build integration templates for popular systems (ABB, Siemens, GE)
  - Document edge cases and troubleshooting guides
  - Create video tutorials and setup guides

**Phase 2: Scale (Post-MVP) - Hybrid Model**
- **Self-Service Option** (₹0 implementation fee):
  - Comprehensive documentation portal
  - Video tutorials (Hindi + English)
  - Pre-built connectors for common SCADA systems
  - Community forum for peer support
  - **Target**: Technical customers with in-house IT/OT teams
  
- **Assisted Setup** (₹50,000 one-time fee):
  - 2-day on-site implementation by Powercast AI engineer
  - SCADA connection configuration + data mapping
  - Operator training (4 hours)
  - 30-day post-launch support
  - **Target**: State utilities, large industrial plants
  
- **Managed Service** (₹2.5 lakh/year add-on):
  - Dedicated integration engineer
  - Quarterly health checks
  - Priority support (4-hour SLA)
  - Custom integration with legacy systems
  - **Target**: Enterprise customers, multi-plant portfolios

### Customer Onboarding Journey

**Week 1: Kickoff**
- Sales handoff to Customer Success
- Technical requirements gathering call
- SCADA system assessment (OPC UA/IEC 61850 compatibility check)
- Credentials exchange (secure portal)

**Week 2-3: Integration**
- **Self-Service**: Customer follows guide, support via Slack/email
- **Assisted Setup**: On-site visit, live configuration
- Data validation (historical CSV upload + live SCADA test)
- Weather API location configuration

**Week 4: Training & Go-Live**
- User training session (grid operators, plant managers)
- Generate first forecast (24h, 7d horizons)
- Review optimization recommendations
- Establish success metrics baseline

**Week 5-8: Adoption**
- Weekly check-ins (Customer Success)
- Feature adoption tracking (which tabs used?)
- Feedback collection for product improvements

### Training & Support

**Self-Service Resources**:
- **Documentation Hub**: Step-by-step guides, FAQs, API reference
- **Video Library**: 
  - "Getting Started" (10 min)
  - "SCADA Integration for OPC UA" (20 min)
  - "Reading Forecast Charts" (8 min)
  - "Exporting Reports" (5 min)
- **Webinars**: Monthly live Q&A sessions (Hindi + English)

**Direct Support Channels**:
- **Email**: support@powercastai.com (24-hour response SLA)
- **WhatsApp Business**: +91-XXX-XXXX (for critical issues, India only)
- **Slack Channel**: Shared workspace for pilot customers
- **Phone**: +91-XXX-XXXX (Mon-Fri, 9 AM - 6 PM IST)

### Success Metrics for Onboarding

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to First Forecast** | <14 days from contract signing | Onboarding tracker |
| **SCADA Integration Success Rate** | >85% (no escalation needed) | Support tickets |
| **Training Attendance** | 80% of licensed users | Webinar registrations |
| **Feature Adoption** | 60% use 3+ tabs within 30 days | Product analytics |
| **Customer Satisfaction (CSAT)** | >4.0/5.0 post-onboarding | Survey |

---

## Pricing Model (India-Focused MVP)

### Subscription Tiers

**Starter (₹50,000/month/plant)**
- 1 power plant (any type: Solar/Hydro/Wind/Thermal/Nuclear)
- Unlimited forecasts (hours/days/weeks horizons)
- CSV upload + manual refresh
- Basic recommendations (static)
- Standard support (24-hour email response)
- **Self-service SCADA integration** (documentation only)
- Export to Excel
- **Target**: Small independent power producers, industrial captive plants

**Professional (₹75,000/month/plant)**
- Everything in Starter, plus:
- **Real-time SCADA integration** (OPC UA/IEC 61850)
- Weather API integration (OpenWeatherMap)
- Dynamic recommendations (based on actual forecast data)
- PDF executive reports
- Priority support (4-hour response SLA)
- **One-time ₹50,000 assisted setup** (included in first month)
- **Target**: State utilities (SLDC level), large renewable farms

**Enterprise (₹2.5 lakh/year base + ₹60,000/plant/year)**
- Everything in Professional, plus:
- Unlimited plants (portfolio management)
- Multi-plant comparison dashboard (Phase 2)
- Custom integrations (legacy SCADA, proprietary protocols)
- Dedicated Customer Success Manager
- Quarterly Business Reviews (QBRs)
- Managed service (health checks, upgrades)
- White-label option
- **On-site implementation included**
- **Target**: National utilities (POSOCO, PowerGrid), large industrial groups

### Add-Ons (All Tiers)

| Add-On | Price | Description |
|--------|-------|-------------|
| **Historical Accuracy Tracking** | ₹10,000/month | Compare forecasts vs actual data, MAPE reports |
| **Alert & Notifications** | ₹5,000/month | Email/SMS alerts for anomalies, maintenance windows |
| **API Access** | ₹15,000/month | REST API for third-party integrations, 10,000 calls/month |
| **Additional Plants** (Starter/Pro) | ₹40,000/month | Discounted rate for 2nd+ plant |
| **On-site Training** | ₹25,000/session | Half-day workshop (up to 10 users) |

### Payment Terms

- **Monthly billing** (Starter, Professional)
- **Annual pre-payment** (Enterprise - 10% discount)
- **Free trial**: 30 days (limited to 1 plant, manual CSV only)
- **Pilot program**: 3 months at 50% discount (first 10 customers)

### Revenue Projections (Year 1)

**Conservative Scenario** (10 customers):
- 5 × Professional (₹75K × 12) = ₹45 lakh
- 3 × Starter (₹50K × 12) = ₹18 lakh
- 2 × Enterprise (₹2.5L base + ₹3.6L/6 plants) = ₹12.2 lakh
- **Total ARR**: ₹75.2 lakh (~CHF 90K)

**Target Scenario** (25 customers):
- 10 × Professional = ₹90 lakh
- 8 × Starter = ₹48 lakh
- 7 × Enterprise = ₹42.7 lakh
- **Total ARR**: ₹180.7 lakh (~CHF 215K)

---

## Open Questions & Assumptions

### Assumptions
1. ✅ Utility companies have CSV historical data (15-min intervals, 6+ months)
2. ✅ SCADA systems support OPC UA or IEC 61850 (90% market coverage)
3. ✅ Users have stable internet (3G+ for dashboard access)
4. ✅ Weather API costs scale linearly with plant count
5. ⚠️ Renewable forecasting accuracy will improve 15% with weather integration (to be validated)

### Open Questions (Require Stakeholder Input)
1. **Localization**:
   - UI translation to Hindi/German?
   - Support local currencies (₹ and CHF in same deployment)?
   - Regional date/time formats?
2. **Data Ownership**:
   - Can we use anonymized data to improve model?
   - Customer consent for benchmarking reports?
   - Data retention policy (how long to keep historical forecasts)?
3. **Regulatory Compliance**:
   - Do we need CEA/CERC certification for India market?
   - Energy Audit compliance requirements?
4. **Competitive Positioning**:
   - Pricing comparison with Siemens EnergyIP, GE Digital?
   - Key differentiators to emphasize in sales?

---

## Appendices

### A. Glossary
| Term | Definition |
|------|------------|
| **MAPE** | Mean Absolute Percentage Error - forecast accuracy metric |
| **SCADA** | Supervisory Control and Data Acquisition - industrial control system |
| **OPC UA** | OPC Unified Architecture - industrial communication protocol |
| **IEC 61850** | International standard for power utility automation |
| **POSOCO** | Power System Operation Corporation - India's national grid operator |
| **SLDC** | State Load Despatch Centre - regional grid control |
| **CEA** | Central Electricity Authority - regulatory body (India) |
| **ENTSO-E** | European Network of TSOs for Electricity |
| **GHI/DNI/DHI** | Global/Direct/Diffuse Horizontal Irradiance (solar metrics) |

### B. References
1. [Indian Grid Code](https://cercind.gov.in/regulations/IEGC.pdf) - CERC Indian Electricity Grid Code
2. [POSOCO Real-Time Data](https://posoco.in/en/transmission-pricing/poc-data/) - National grid data portal
3. [OpenWeatherMap Solar API](https://openweathermap.org/api/solar-irradiance) - Weather integration
4. [XGBoost Documentation](https://xgboost.readthedocs.io/) - ML model reference
5. [Swissgrid Transparency](https://www.swissgrid.ch/en/home/operation/grid-data.html) - Swiss grid data

### C. Change Log
| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 2.1 | 2026-01-26 | Added Implementation & Onboarding Strategy section, India-focused pricing model (₹50K-₹75K/month tiers), SCADA integration approach (hybrid: self-service + assisted setup) | Senior PM |
| 2.0 | 2026-01-26 | Complete PRD rewrite based on actual codebase + user requirements | Senior PM |
| 1.0 | 2026-01-16 | Initial draft (deprecated - contained errors) | Previous PM |

---

**Document Status**: ✅ **APPROVED FOR DEVELOPMENT**  
**Next Review**: 2026-02-26 (Monthly stakeholder sync)
