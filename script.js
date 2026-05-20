/* ==========================================================================
   NOC DASHBOARD - CORE INTERACTIVE API ENGINE
   ========================================================================== */

// 1. Session Security Guard Check
if (localStorage.getItem("noc-logged-in") !== "true") {
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  
  // --------------------------------------------------------------------------
  // A. SYSTEM STATE & SELECTORS
  // --------------------------------------------------------------------------
  let devices = [];
  let incidents = [];
  let activeDeviceId = null;
  let currentSortColumn = "name";
  let currentSortDirection = "asc";
  let deviceSearchQuery = "";
  
  // Chart Dataset (Generated dynamically or drifted for high fidelity visual)
  const sampleCount = 42;
  const chartData = {
    ping: Array.from({ length: sampleCount }, (_, idx) => 10 + Math.sin(idx / 2) * 3 + Math.random() * 2),
    uptime: Array.from({ length: sampleCount }, (_, idx) => 99.8 + Math.cos(idx / 5) * 0.1),
    downtime: Array.from({ length: sampleCount }, (_, idx) => 0.2 + Math.sin(idx / 3) * 0.05)
  };
  
  const seriesVisibility = { ping: true, uptime: true, downtime: true };

  // DOM Elements
  const timeEl = document.querySelector("#currentTime");
  const lastUpdateEl = document.querySelector("#lastUpdate");
  
  const profileBtn = document.querySelector("#profileBtn");
  const profileDropdown = document.querySelector("#profileDropdown");
  const logoutBtn = document.querySelector("#logoutBtn");
  
  const themeBtn = document.querySelector("#themeBtn");
  const themeDropdown = document.querySelector("#themeDropdown");
  const themeOptions = document.querySelectorAll(".theme-opt");
  
  // Summary Cards
  const totalDevicesEl = document.querySelector("#totalDevicesCount");
  const onlineDevicesEl = document.querySelector("#onlineDevices");
  const offlineDevicesEl = document.querySelector("#offlineDevices");
  const averagePingEl = document.querySelector("#averagePing");

  // Tables
  const deviceSearchInput = document.querySelector("#deviceSearch");
  const deviceTableBody = document.querySelector("#deviceTableBody");
  const tableWarningCount = document.querySelector("#tableWarningCount");
  const tableHeaders = document.querySelectorAll("th.sortable");

  // Sidebar Menu Toggles
  const navItems = {
    dashboard: document.querySelector("#nav-dashboard"),
    devices: document.querySelector("#nav-devices"),
    alerts: document.querySelector("#nav-alerts"),
    logs: document.querySelector("#nav-logs"),
    stats: document.querySelector("#nav-stats"),
    settings: document.querySelector("#nav-settings")
  };
  
  const viewSections = {
    dashboard: document.querySelector("#view-dashboard"),
    devices: document.querySelector("#view-devices"),
    alerts: document.querySelector("#view-alerts"),
    logs: document.querySelector("#view-logs"),
    stats: document.querySelector("#view-stats"),
    settings: document.querySelector("#view-settings")
  };

  // Alert Panel
  const alertFeed = document.querySelector("#alertFeed");
  const navAlertBadge = document.querySelector("#navAlertBadge");

  // Chart Canvas
  const canvas = document.querySelector("#realtimeChart");
  const ctx = canvas.getContext("2d");
  const chartTooltip = document.querySelector("#chartTooltip");
  const legendItems = document.querySelectorAll(".legend-item");

  // Drawer
  const detailsDrawer = document.querySelector("#detailsDrawer");
  const drawerOverlay = document.querySelector("#drawerOverlay");
  const closeDrawerBtn = document.querySelector("#closeDrawerBtn");
  const drawerDeviceName = document.querySelector("#drawerDeviceName");
  const drawerDeviceStatus = document.querySelector("#drawerDeviceStatus");
  const drawerDeviceIP = document.querySelector("#drawerDeviceIP");
  const drawerCPUValue = document.querySelector("#drawerCPUValue");
  const drawerCPUFill = document.querySelector("#drawerCPUFill");
  const drawerMemValue = document.querySelector("#drawerMemValue");
  const drawerMemFill = document.querySelector("#drawerMemFill");
  const drawerBandwidthTX = document.querySelector("#drawerBandwidthTX");
  const drawerBandwidthRX = document.querySelector("#drawerBandwidthRX");
  const drawerLogsList = document.querySelector("#drawerLogsList");

  // Modal Add Device
  const addDeviceModalOverlay = document.querySelector("#addDeviceModalOverlay");
  const openAddDeviceModalBtn = document.querySelector("#openAddDeviceModalBtn");
  const subOpenAddDeviceBtn = document.querySelector("#subOpenAddDeviceBtn");
  const closeModalBtn = document.querySelector("#closeModalBtn");
  const cancelFormBtn = document.querySelector("#cancelFormBtn");
  const addDeviceForm = document.querySelector("#addDeviceForm");

  // --------------------------------------------------------------------------
  // B. THEME & PROFILE SYSTEM
  // --------------------------------------------------------------------------
  const savedTheme = localStorage.getItem("noc-theme") || "space";
  applyTheme(savedTheme);

  themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle("show");
    profileDropdown.classList.remove("show");
  });

  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("show");
    themeDropdown.classList.remove("show");
  });

  document.addEventListener("click", () => {
    themeDropdown.classList.remove("show");
    profileDropdown.classList.remove("show");
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("noc-logged-in");
    window.location.href = "login.html";
  });

  function applyTheme(themeName) {
    themeOptions.forEach(opt => {
      opt.classList.toggle("active", opt.getAttribute("data-theme") === themeName);
    });
    document.body.className = "";
    document.body.classList.add(`theme-${themeName}`);
    localStorage.setItem("noc-theme", themeName);
    setTimeout(drawChart, 50);
  }

  themeOptions.forEach(opt => {
    opt.addEventListener("click", (e) => {
      applyTheme(e.target.getAttribute("data-theme"));
    });
  });

  // --------------------------------------------------------------------------
  // C. TAB SWITCHING ROUTING SYSTEM
  // --------------------------------------------------------------------------
  let currentActiveTab = "dashboard";

  function switchTab(tabId) {
    if (!viewSections[tabId]) return;
    currentActiveTab = tabId;

    // Switch nav-item highlighted
    Object.keys(navItems).forEach(key => {
      if (navItems[key]) {
        navItems[key].classList.toggle("active", key === tabId);
      }
    });

    // Toggle view visibility
    Object.keys(viewSections).forEach(key => {
      if (viewSections[key]) {
        viewSections[key].classList.toggle("hidden", key !== tabId);
      }
    });

    // Trigger API refreshes according to chosen tab
    if (tabId === "dashboard") {
      fetchDashboardData();
    } else if (tabId === "devices") {
      fetchManagementDevices();
    } else if (tabId === "alerts") {
      fetchAlertsHistory();
    } else if (tabId === "logs") {
      fetchSyslogs();
    } else if (tabId === "stats") {
      fetchStatisticsTab();
    } else if (tabId === "settings") {
      fetchSettingsTab();
    }
  }

  // Bind Sidebar Nav clicks
  Object.keys(navItems).forEach(key => {
    if (navItems[key]) {
      navItems[key].addEventListener("click", (e) => {
        e.preventDefault();
        switchTab(key);
      });
    }
  });

  // --------------------------------------------------------------------------
  // D. REAL DYNAMIC FETCH & RENDER - DASHBOARD & GLOBAL
  // --------------------------------------------------------------------------

  // Clock Update
  function updateClock() {
    timeEl.textContent = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Primary API Caller for Dashboard State
  async function fetchDashboardData() {
    try {
      // 1. Fetch devices list
      const devRes = await fetch("/api/devices");
      devices = await devRes.json();
      
      // Calculate dynamic simulated fields (CPU, RAM, Bandwidth) for active session state
      // (This matches the premium real-time visualization while storing actual state in MySQL)
      devices = devices.map(d => {
        const isOnline = d.status === "Online";
        const isWarning = d.status === "Warning";
        
        let pingVal = d.status === "Offline" ? null : 8;
        if (isWarning) pingVal = 85;
        
        return {
          id: d.id,
          name: d.device_name,
          ip: d.ip_address,
          type: d.device_type,
          location: d.location || "Default Rack",
          status: d.status,
          ping: pingVal,
          cpu: isOnline ? Math.round(15 + Math.random() * 20) : (isWarning ? Math.round(70 + Math.random() * 15) : 0),
          mem: isOnline ? Math.round(35 + Math.random() * 15) : (isWarning ? Math.round(80 + Math.random() * 12) : 0),
          rx: isOnline ? 40 + Math.random() * 50 : (isWarning ? 350 + Math.random() * 150 : 0),
          tx: isOnline ? 45 + Math.random() * 60 : (isWarning ? 390 + Math.random() * 160 : 0),
          log: d.status === "Offline" ? ["Heartbeat timeout detected", "LAN unreachable"] : ["Node Provisioned Successfully."]
        };
      });

      // 2. Fetch statistics summary
      const statsRes = await fetch("/api/stats");
      const stats = await statsRes.json();

      totalDevicesEl.textContent = stats.totalDevices;
      onlineDevicesEl.textContent = stats.onlineDevices;
      offlineDevicesEl.textContent = stats.offlineDevices;
      averagePingEl.textContent = stats.averagePing > 0 ? `${stats.averagePing}ms` : `--`;

      // 3. Render Table
      renderDeviceTable();

      // 4. Fetch Alarms Feed
      const alertsRes = await fetch("/api/alerts");
      incidents = await alertsRes.json();
      renderAlertFeed();

      // 5. Update open metrics drawer
      if (activeDeviceId !== null) {
        const activeDev = devices.find(d => d.id === activeDeviceId);
        if (activeDev) {
          updateDrawerLiveMetrics(activeDev);
        }
      }

      lastUpdateEl.textContent = "Last update: now";
    } catch (err) {
      console.error("Error fetching dashboard details:", err);
      lastUpdateEl.textContent = "Offline Mode";
    }
  }

  // Search filter
  deviceSearchInput.addEventListener("input", (e) => {
    deviceSearchQuery = e.target.value.toLowerCase().trim();
    renderDeviceTable();
  });

  // Headers Sort
  tableHeaders.forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-sort");
      if (currentSortColumn === col) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortColumn = col;
        currentSortDirection = "asc";
      }
      tableHeaders.forEach(h => {
        const span = h.querySelector("span");
        span.textContent = h === th ? (currentSortDirection === "asc" ? "▲" : "▼") : "⇅";
      });
      renderDeviceTable();
    });
  });

  // Table Renderer
  function renderDeviceTable() {
    deviceTableBody.innerHTML = "";
    
    let filtered = devices.filter(dev => {
      return dev.name.toLowerCase().includes(deviceSearchQuery) || 
             dev.ip.includes(deviceSearchQuery) ||
             dev.status.toLowerCase().includes(deviceSearchQuery) ||
             dev.type.toLowerCase().includes(deviceSearchQuery);
    });

    filtered.sort((a, b) => {
      let valA = a[currentSortColumn];
      let valB = b[currentSortColumn];

      if (currentSortColumn === "ping") {
        valA = valA === null ? 9999 : valA;
        valB = valB === null ? 9999 : valB;
      }

      if (typeof valA === "string") {
        return currentSortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return currentSortDirection === "asc" ? valA - valB : valB - valA;
      }
    });

    if (filtered.length === 0) {
      deviceTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--muted); padding: 24px;">ไม่พบลายชื่อโหนดอุปกรณ์ในระบบ</td></tr>`;
      return;
    }

    filtered.forEach(dev => {
      const tr = document.createElement("tr");
      if (activeDeviceId === dev.id) tr.classList.add("row-active");
      
      let pingText = "Timeout";
      let pingClass = "text-offline";
      if (dev.status === "Online") {
        pingText = dev.ping ? `${dev.ping}ms` : `Online`;
        pingClass = "text-online";
      } else if (dev.status === "Warning") {
        pingText = dev.ping ? `${dev.ping}ms` : `High Load`;
        pingClass = "text-warning";
      }

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: var(--text);">${dev.name}</div>
          <div style="font-size: 11px; color: var(--muted);">${dev.type} &bull; <span style="color: var(--cyan); font-weight: 600;">${dev.location}</span></div>
        </td>
        <td><code style="font-size: 13px;">${dev.ip}</code></td>
        <td><span class="status-pill ${dev.status.toLowerCase()}">${dev.status}</span></td>
        <td><span class="ping-value ${pingClass}">${pingText}</span></td>
      `;

      tr.addEventListener("click", () => {
        openDeviceDrawer(dev.id);
      });

      deviceTableBody.appendChild(tr);
    });

    const warningNodes = devices.filter(d => d.status === "Warning").length;
    const offlineNodes = devices.filter(d => d.status === "Offline").length;
    tableWarningCount.textContent = `${offlineNodes} Outages / ${warningNodes} Warnings`;
    tableWarningCount.className = `status-pill ${offlineNodes > 0 ? "offline" : (warningNodes > 0 ? "warning" : "online")}`;
  }

  // Alarms Feed Renderer
  function renderAlertFeed() {
    alertFeed.innerHTML = "";
    const active = incidents.filter(i => i.alert_type !== "resolved");
    navAlertBadge.textContent = active.length;
    navAlertBadge.style.display = active.length === 0 ? "none" : "block";

    if (active.length === 0) {
      alertFeed.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--muted); font-size: 13px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 32px; height: 32px; margin-bottom: 8px; color: var(--green);">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/>
          </svg>
          <div>All systems healthy. No active alarms.</div>
        </div>
      `;
      return;
    }

    active.forEach(inc => {
      const div = document.createElement("div");
      div.className = `alert ${inc.alert_type === "critical" ? "critical" : "warning"}`;
      div.setAttribute("data-id", inc.id);

      const timeVal = new Date(inc.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      div.innerHTML = `
        <div class="alert-header">
          <strong>${inc.device_name} ${inc.alert_type.toUpperCase()}</strong>
          <span class="alert-time">${timeVal}</span>
        </div>
        <p class="alert-msg">${inc.message} (IP: ${inc.ip_address})</p>
        <div class="alert-actions">
          <button class="alert-btn ack-btn" type="button">Acknowledge</button>
          <button class="alert-btn resolve-btn" type="button">Resolve Inc.</button>
        </div>
      `;

      div.querySelector(".ack-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        await ackIncident(inc.id);
      });

      div.querySelector(".resolve-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        div.classList.add("slide-out");
        setTimeout(async () => {
          await resolveIncident(inc.id);
        }, 400);
      });

      alertFeed.appendChild(div);
    });
  }

  async function ackIncident(id) {
    try {
      const res = await fetch(`/api/alerts/${id}/ack`, { method: "POST" });
      const data = await res.json();
      if (data.success) fetchDashboardData();
    } catch (e) { console.error(e); }
  }

  async function resolveIncident(id) {
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, { method: "POST" });
      const data = await res.json();
      if (data.success) fetchDashboardData();
    } catch (e) { console.error(e); }
  }

  // Drawer Controls
  function openDeviceDrawer(deviceId) {
    activeDeviceId = deviceId;
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;

    drawerDeviceName.textContent = dev.name;
    drawerDeviceIP.textContent = dev.ip;
    drawerDeviceStatus.className = `status-pill ${dev.status.toLowerCase()}`;
    drawerDeviceStatus.textContent = dev.status;
    document.querySelector("#drawerDeviceLocation span").textContent = dev.location;

    updateDrawerLiveMetrics(dev);

    // Draw device local incident logs
    drawerLogsList.innerHTML = "";
    dev.log.forEach(l => {
      const li = document.createElement("li");
      li.textContent = l;
      li.className = l.toLowerCase().includes("timeout") || l.toLowerCase().includes("fail") ? "critical" : "ok";
      drawerLogsList.appendChild(li);
    });

    detailsDrawer.classList.add("active");
    drawerOverlay.classList.add("active");
    renderDeviceTable();
  }

  function closeDeviceDrawer() {
    activeDeviceId = null;
    detailsDrawer.classList.remove("active");
    drawerOverlay.classList.remove("active");
    renderDeviceTable();
  }
  closeDrawerBtn.addEventListener("click", closeDeviceDrawer);
  drawerOverlay.addEventListener("click", closeDeviceDrawer);

  function updateDrawerLiveMetrics(dev) {
    drawerCPUValue.textContent = `${dev.cpu}%`;
    drawerCPUFill.style.width = `${dev.cpu}%`;
    drawerMemValue.textContent = `${dev.mem}%`;
    drawerMemFill.style.width = `${dev.mem}%`;
    drawerBandwidthRX.textContent = `${dev.rx.toFixed(1)} Mbps`;
    drawerBandwidthTX.textContent = `${dev.tx.toFixed(1)} Mbps`;
  }

  // Add Device Modal Config
  openAddDeviceModalBtn.addEventListener("click", () => addDeviceModalOverlay.classList.add("active"));
  subOpenAddDeviceBtn.addEventListener("click", () => addDeviceModalOverlay.classList.add("active"));
  
  function closeModal() {
    addDeviceModalOverlay.classList.remove("active");
    addDeviceForm.reset();
  }
  closeModalBtn.addEventListener("click", closeModal);
  cancelFormBtn.addEventListener("click", closeModal);
  addDeviceModalOverlay.addEventListener("click", (e) => {
    if (e.target === addDeviceModalOverlay) closeModal();
  });

  addDeviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.querySelector("#newDeviceName").value.trim();
    const ip = document.querySelector("#newDeviceIP").value.trim();
    const type = document.querySelector("#newDeviceType").value;
    const location = document.querySelector("#newDeviceLocation").value.trim() || "Default Rack";

    try {
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: name, ip_address: ip, device_type: type, location })
      });
      const result = await response.json();
      if (result.success) {
        closeModal();
        if (currentActiveTab === "dashboard") fetchDashboardData();
        else if (currentActiveTab === "devices") fetchManagementDevices();
      } else {
        alert("เพิ่มอุปกรณ์ล้มเหลว: " + result.error);
      }
    } catch (err) {
      alert("Error contacting backend api: " + err.message);
    }
  });

  // --------------------------------------------------------------------------
  // E. VIEW SECTION 2: MANAGEMENT DEVICES LIST
  // --------------------------------------------------------------------------
  const managementTableBody = document.querySelector("#managementTableBody");

  async function fetchManagementDevices() {
    managementTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">กำลังดาวน์โหลดรายการอุปกรณ์...</td></tr>`;
    try {
      const res = await fetch("/api/devices");
      const list = await res.json();
      managementTableBody.innerHTML = "";

      if (list.length === 0) {
        managementTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">ไม่พบรายการโหนดในระบบ คุณสามารถสร้างอุปกรณ์เพิ่มได้โดยใช้ปุ่ม Add Node</td></tr>`;
        return;
      }

      list.forEach(dev => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${dev.device_name}</strong></td>
          <td><span style="font-size: 12px; color: var(--muted);">${dev.device_type}</span></td>
          <td><code>${dev.ip_address}</code></td>
          <td>${dev.location || "NOC Rack"}</td>
          <td><span class="status-pill ${dev.status.toLowerCase()}">${dev.status}</span></td>
          <td style="text-align: right;">
            <button class="delete-btn" style="padding: 6px 12px; font-size: 11px;" data-id="${dev.id}">Delete</button>
          </td>
        `;

        tr.querySelector(".delete-btn").addEventListener("click", async () => {
          if (confirm(`คุณแน่ใจหรือไม่ที่จะลบโหนดอุปกรณ์ "${dev.device_name}" ออกจากระบบ?`)) {
            await deleteDeviceNode(dev.id);
          }
        });

        managementTableBody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
      managementTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--red); padding: 24px;">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</td></tr>`;
    }
  }

  async function deleteDeviceNode(id) {
    try {
      const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchManagementDevices();
      }
    } catch (e) { console.error(e); }
  }

  // --------------------------------------------------------------------------
  // F. VIEW SECTION 3: INCIDENT ALERTS INCIDENT HISTORY
  // --------------------------------------------------------------------------
  const alertsHistoryTableBody = document.querySelector("#alertsHistoryTableBody");

  async function fetchAlertsHistory() {
    alertsHistoryTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">กำลังโหลดประวัติเหตุการณ์ล้มเหลว...</td></tr>`;
    try {
      const res = await fetch("/api/alerts");
      const list = await res.json();
      alertsHistoryTableBody.innerHTML = "";

      if (list.length === 0) {
        alertsHistoryTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--green); padding: 24px; font-weight: 600;">🎉 ยอดเยี่ยม! เครือข่ายทั้งหมดปกติดี ไม่มีสัญญาณเตือนคงค้าง</td></tr>`;
        return;
      }

      list.forEach(alert => {
        const tr = document.createElement("tr");
        const dateStr = new Date(alert.created_at).toLocaleString("th-TH");
        
        tr.innerHTML = `
          <td><strong>${alert.device_name}</strong></td>
          <td><code>${alert.ip_address}</code></td>
          <td>${alert.message}</td>
          <td><span class="status-pill ${alert.alert_type === 'critical' ? 'offline' : 'warning'}">${alert.alert_type.toUpperCase()}</span></td>
          <td><small>${dateStr}</small></td>
          <td style="text-align: right;">
            <button style="padding: 6px 12px; font-size: 11px;" class="resolve-row-btn" data-id="${alert.id}">Resolve</button>
          </td>
        `;

        tr.querySelector(".resolve-row-btn").addEventListener("click", async () => {
          await resolveIncident(alert.id);
          fetchAlertsHistory();
        });

        alertsHistoryTableBody.appendChild(tr);
      });
    } catch (e) { console.error(e); }
  }

  // --------------------------------------------------------------------------
  // G. VIEW SECTION 4: TELEMETRY SYSLOGS (monitoring_logs)
  // --------------------------------------------------------------------------
  const syslogsTableBody = document.querySelector("#syslogsTableBody");

  async function fetchSyslogs() {
    syslogsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">กำลังดึงประวัติ SysLogs จาก MySQL...</td></tr>`;
    try {
      const res = await fetch("/api/logs?limit=40");
      const logs = await res.json();
      syslogsTableBody.innerHTML = "";

      if (logs.length === 0) {
        syslogsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">ไม่พบประวัติการ Ping บันทึกในระบบหลังบ้าน</td></tr>`;
        return;
      }

      logs.forEach(log => {
        const tr = document.createElement("tr");
        const pingDisplay = log.ping_ms !== null ? `${log.ping_ms}ms` : "Timeout 🔴";
        const dateStr = new Date(log.checked_at).toLocaleString("th-TH");
        
        tr.innerHTML = `
          <td><strong>${log.device_name}</strong></td>
          <td><small>${log.device_type}</small></td>
          <td><code>${log.ip_address}</code></td>
          <td><span style="font-weight: 700;">${pingDisplay}</span></td>
          <td><span class="status-pill ${log.status}">${log.status.toUpperCase()}</span></td>
          <td><small style="color: var(--muted);">${dateStr}</small></td>
        `;
        syslogsTableBody.appendChild(tr);
      });
    } catch (e) { console.error(e); }
  }

  // --------------------------------------------------------------------------
  // H. VIEW SECTION 5: STATISTICS (PERFORMANCE INSIGHTS)
  // --------------------------------------------------------------------------
  const uptimeStatVal = document.querySelector("#uptimeStatVal");
  const downtimeStatVal = document.querySelector("#downtimeStatVal");
  const avgPingStatVal = document.querySelector("#avgPingStatVal");
  const statsTableBody = document.querySelector("#statsTableBody");

  async function fetchStatisticsTab() {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();

      uptimeStatVal.textContent = `${data.uptimePercentage}%`;
      downtimeStatVal.textContent = `${data.downtimePercentage}%`;
      avgPingStatVal.textContent = data.averagePing > 0 ? `${data.averagePing}ms` : `--`;

      // Render nodes breakdown statistics table
      statsTableBody.innerHTML = "";
      const devRes = await fetch("/api/devices");
      const list = await devRes.json();

      if (list.length === 0) {
        statsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--muted);">ไม่มีรายการข้อมูลเพียงพอที่จะพล็อตสถิติ</td></tr>`;
        return;
      }

      list.forEach(dev => {
        const tr = document.createElement("tr");
        // Simulated average for representation
        const mockAvg = dev.status === "Online" ? Math.round(3 + Math.random() * 10) : (dev.status === "Warning" ? Math.round(65 + Math.random() * 20) : 0);
        const mockInc = dev.status === "Online" ? 0 : (dev.status === "Warning" ? 2 : 4);
        
        tr.innerHTML = `
          <td><strong>${dev.device_name}</strong></td>
          <td><code>${dev.ip_address}</code></td>
          <td><span style="font-weight: 700;">${mockAvg > 0 ? mockAvg + 'ms' : 'Offline'}</span></td>
          <td><span style="color: ${mockInc > 0 ? 'var(--red)' : 'var(--muted)'};">${mockInc} ครั้ง</span></td>
          <td><span class="status-pill ${dev.status.toLowerCase()}">${dev.status}</span></td>
        `;
        statsTableBody.appendChild(tr);
      });
    } catch (e) { console.error(e); }
  }

  // --------------------------------------------------------------------------
  // I. VIEW SECTION 6: SETTINGS & SUBNET SCANNER (DEVICE DISCOVERY)
  // --------------------------------------------------------------------------
  const lineTokenInput = document.querySelector("#lineTokenInput");
  const lineSettingsForm = document.querySelector("#lineSettingsForm");
  const testLineNotifyBtn = document.querySelector("#testLineNotifyBtn");

  const discoverySubnetInput = document.querySelector("#discoverySubnetInput");
  const startDiscoveryScanBtn = document.querySelector("#startDiscoveryScanBtn");
  const discoveryScanIntro = document.querySelector("#discoveryScanIntro");
  const discoveryResultWrap = document.querySelector("#discoveryResultWrap");
  const discoveryResultTableBody = document.querySelector("#discoveryResultTableBody");

  async function fetchSettingsTab() {
    try {
      // Get current token
      const res = await fetch("/api/settings/line");
      const data = await res.json();
      lineTokenInput.value = data.token || "";
    } catch (e) { console.error(e); }
  }

  lineSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = lineTokenInput.value.trim();
    try {
      const res = await fetch("/api/settings/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        alert("บันทึก LINE Notify Token เรียบร้อยแล้ว!");
      }
    } catch (err) { alert(err.message); }
  });

  testLineNotifyBtn.addEventListener("click", async () => {
    const token = lineTokenInput.value.trim();
    testLineNotifyBtn.disabled = true;
    testLineNotifyBtn.textContent = "กำลังส่ง...";
    
    try {
      const res = await fetch("/api/settings/test-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        alert("ส่งการแจ้งเตือนทดสอบเข้า LINE เรียบร้อยแล้ว! กรุณาตรวจสอบห้องแชท LINE ของคุณ");
      } else {
        alert("ส่งล้มเหลว: " + data.message);
      }
    } catch (err) {
      alert("Error sending: " + err.message);
    } finally {
      testLineNotifyBtn.disabled = false;
      testLineNotifyBtn.textContent = "Test Send 🚀";
    }
  });

  // Device Subnet IP Scan Action
  startDiscoveryScanBtn.addEventListener("click", async () => {
    const subnet = discoverySubnetInput.value.trim();
    if (!subnet) {
      alert("กรุณากรอกช่วง Subnet (เช่น 192.168.1)");
      return;
    }

    startDiscoveryScanBtn.disabled = true;
    const svgIcon = startDiscoveryScanBtn.querySelector("svg");
    svgIcon.classList.add("active");
    startDiscoveryScanBtn.querySelector("span").textContent = "Scanning...";
    
    discoveryScanIntro.textContent = "🔍 ระบบกำลังส่ง concurrent pings 254 โฮสต์ และดึงข้อมูลตาราง ARP ของ Windows เพื่อค้นหาอุปกรณ์... โปรดรอสักครู่ (ใช้เวลาประมาณ 10-15 วินาที)";
    discoveryScanIntro.classList.remove("hidden");
    discoveryResultWrap.classList.add("hidden");
    discoveryResultTableBody.innerHTML = "";

    try {
      const res = await fetch("/api/discovery/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subnet })
      });
      
      const discovered = await res.json();
      
      if (discovered.length === 0) {
        discoveryScanIntro.textContent = "❌ ไม่พบอุปกรณ์ใดๆ ในช่วง subnet นี้ที่เปิดอยู่ กรุณาเช็คการเชื่อมต่อเครือข่าย";
        return;
      }

      discoveryScanIntro.classList.add("hidden");
      discoveryResultWrap.classList.remove("hidden");
      
      discovered.forEach(dev => {
        const tr = document.createElement("tr");
        
        tr.innerHTML = `
          <td><strong style="color: var(--cyan);">${dev.ip}</strong></td>
          <td><code>${dev.mac}</code></td>
          <td><span style="font-weight: 600;">${dev.hostname}</span></td>
          <td style="text-align: right;">
            <button class="add-node-btn" style="padding: 6px 12px; font-size: 11px;">Add to Monitor</button>
          </td>
        `;

        tr.querySelector(".add-node-btn").addEventListener("click", () => {
          // Fill values in provision device modal
          document.querySelector("#newDeviceName").value = dev.hostname === "Unknown Host" ? `Node-${dev.ip.split('.').pop()}` : dev.hostname;
          document.querySelector("#newDeviceIP").value = dev.ip;
          
          // Show Modal
          addDeviceModalOverlay.classList.add("active");
        });

        discoveryResultTableBody.appendChild(tr);
      });

    } catch (err) {
      console.error(err);
      discoveryScanIntro.textContent = "💥 เกิดข้อผิดพลาดในการสแกนเครือข่าย: " + err.message;
    } finally {
      startDiscoveryScanBtn.disabled = false;
      svgIcon.classList.remove("active");
      startDiscoveryScanBtn.querySelector("span").textContent = "Scan Subnet .0/24";
    }
  });

  // --------------------------------------------------------------------------
  // J. ADVANCED CANVAS CHART RENDERING (DASHBOARD GRAPH)
  // --------------------------------------------------------------------------

  // Legend checkbox toggle bindings
  legendItems.forEach(item => {
    item.addEventListener("click", () => {
      const series = item.getAttribute("data-series");
      const active = item.getAttribute("aria-checked") === "true";
      seriesVisibility[series] = !active;
      item.setAttribute("aria-checked", !active ? "true" : "false");
      drawChart();
    });
  });

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawChart();
  }

  function drawGrid(width, height, padding) {
    const isAurora = document.body.classList.contains("theme-aurora");
    ctx.strokeStyle = isAurora ? "rgba(100, 116, 139, 0.08)" : "rgba(143, 161, 179, 0.06)";
    ctx.lineWidth = 1;
    ctx.font = "500 11px Inter, system-ui, sans-serif";
    ctx.fillStyle = isAurora ? "rgba(100, 116, 139, 0.6)" : "rgba(143, 161, 179, 0.45)";

    const chartHeight = height - padding.top - padding.bottom;
    const chartWidth = width - padding.left - padding.right;

    for (let index = 0; index <= 4; index += 1) {
      const y = padding.top + (chartHeight / 4) * index;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${100 - index * 25}%`, 10, y + 4);
    }

    const stepCount = 6;
    for (let i = 0; i <= stepCount; i++) {
      const x = padding.left + (chartWidth / stepCount) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      
      const timeVal = (stepCount - i) * 10;
      if (timeVal > 0) {
        ctx.fillText(`${timeVal}s ago`, x - 18, height - 8);
      } else {
        ctx.fillText("now", x - 10, height - 8);
      }
    }
  }

  function drawSmoothCurve(series, color, maxValue, padding, width, height, fillGradient) {
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const step = chartWidth / (sampleCount - 1);
    
    let points = [];
    series.forEach((value, index) => {
      const x = padding.left + index * step;
      const y = padding.top + chartHeight - (Math.min(value, maxValue) / maxValue) * chartHeight;
      points.push({ x, y });
    });

    if (points.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (fillGradient) {
      ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
      ctx.lineTo(points[0].x, padding.top + chartHeight);
      ctx.closePath();
      
      const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      grad.addColorStop(0, fillGradient);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  function drawChart() {
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const padding = { top: 22, right: 24, bottom: 28, left: 44 };

    ctx.clearRect(0, 0, width, height);
    drawGrid(width, height, padding);

    const uptimeColor = getCSSVariable("--green");
    const pingColor = getCSSVariable("--cyan");
    const downtimeColor = getCSSVariable("--red");

    if (seriesVisibility.uptime) {
      drawSmoothCurve(chartData.uptime, uptimeColor, 100, padding, width, height, "rgba(50, 213, 131, 0.1)");
    }
    if (seriesVisibility.ping) {
      drawSmoothCurve(chartData.ping, pingColor, 100, padding, width, height, "rgba(76, 201, 240, 0.1)");
    }
    if (seriesVisibility.downtime) {
      drawSmoothCurve(chartData.downtime, downtimeColor, 100, padding, width, height, "rgba(255, 93, 93, 0.1)");
    }
  }

  function getCSSVariable(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  let hoverIndex = -1;
  if (canvas) {
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const padding = { top: 22, right: 24, bottom: 28, left: 44 };
      const chartWidth = rect.width - padding.left - padding.right;
      const chartHeight = rect.height - padding.top - padding.bottom;
      const step = chartWidth / (sampleCount - 1);
      
      const index = Math.round((mouseX - padding.left) / step);
      
      if (index >= 0 && index < sampleCount && mouseX >= padding.left && mouseX <= rect.width - padding.right) {
        hoverIndex = index;
        drawChart();
        
        const x = padding.left + index * step;
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = getCSSVariable("--muted");
        ctx.lineWidth = 1;
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, rect.height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ["uptime", "ping", "downtime"].forEach(series => {
          if (!seriesVisibility[series]) return;
          const val = chartData[series][index];
          const y = padding.top + chartHeight - (Math.min(val, 100) / 100) * chartHeight;
          
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = getCSSVariable(`--${series === "uptime" ? "green" : (series === "ping" ? "cyan" : "red")}`);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        const secondsAgo = (sampleCount - 1 - index) * 1.6;
        let timeString = secondsAgo === 0 ? "Realtime" : `${secondsAgo.toFixed(1)}s ago`;
        
        let tooltipContent = `<div class="tooltip-time">${timeString}</div>`;
        if (seriesVisibility.uptime) {
          tooltipContent += `
            <div class="tooltip-row uptime">
              <span>Uptime</span>
              <span>${chartData.uptime[index].toFixed(2)}%</span>
            </div>`;
        }
        if (seriesVisibility.ping) {
          tooltipContent += `
            <div class="tooltip-row ping">
              <span>Latency</span>
              <span>${Math.round(chartData.ping[index])}ms</span>
            </div>`;
        }
        if (seriesVisibility.downtime) {
          tooltipContent += `
            <div class="tooltip-row downtime">
              <span>Alarms</span>
              <span>${chartData.downtime[index].toFixed(3)}%</span>
            </div>`;
        }

        chartTooltip.innerHTML = tooltipContent;
        chartTooltip.classList.remove("hidden");
        
        const tooltipRect = chartTooltip.getBoundingClientRect();
        let left = x + 15;
        if (left + tooltipRect.width > rect.width) {
          left = x - tooltipRect.width - 15;
        }
        chartTooltip.style.left = `${left}px`;
        chartTooltip.style.top = `${mouseY - 40}px`;
      } else {
        hideTooltip();
      }
    });

    canvas.addEventListener("mouseleave", hideTooltip);
  }

  function hideTooltip() {
    if (hoverIndex !== -1) {
      hoverIndex = -1;
      drawChart();
    }
    chartTooltip.classList.add("hidden");
  }

  // --------------------------------------------------------------------------
  // K. RUNTIME SIMULATOR FOR SPARK CHART & POLLING SYNC (Every 5 seconds)
  // --------------------------------------------------------------------------
  function nextValue(series, base, swing, floor = 0, max = 100) {
    const previous = series[series.length - 1] || base;
    const drift = (Math.random() - 0.5) * swing;
    return Math.max(floor, Math.min(max, previous * 0.8 + (base + drift) * 0.2));
  }

  function runTelemetryDrift() {
    // Push new simulated historical series metrics
    chartData.ping.push(nextValue(chartData.ping, 12, 5, 2, 45));
    chartData.uptime.push(Math.min(100, nextValue(chartData.uptime, 99.8, 0.05, 99, 100)));
    chartData.downtime.push(nextValue(chartData.downtime, 0.2, 0.1, 0, 5));

    Object.values(chartData).forEach(series => {
      while (series.length > sampleCount) series.shift();
    });

    drawChart();
  }

  // --------------------------------------------------------------------------
  // L. BOOTSTRAP INITIALIZATION
  // --------------------------------------------------------------------------
  
  // Set window resizers
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Sync Default View Tab Data
  fetchDashboardData();

  // Polling clock (every 5 seconds)
  let lastUpdateTimeSecs = 0;
  setInterval(() => {
    lastUpdateTimeSecs += 1;
    if (lastUpdateTimeSecs >= 5) {
      runTelemetryDrift();
      // Re-trigger API syncs in active tab to pull MySQL changes
      if (currentActiveTab === "dashboard") {
        fetchDashboardData();
      } else if (currentActiveTab === "devices") {
        fetchManagementDevices();
      } else if (currentActiveTab === "alerts") {
        fetchAlertsHistory();
      } else if (currentActiveTab === "logs") {
        fetchSyslogs();
      } else if (currentActiveTab === "stats") {
        fetchStatisticsTab();
      }
      lastUpdateTimeSecs = 0;
    } else {
      if (lastUpdateEl) {
        lastUpdateEl.textContent = `Last update: ${lastUpdateTimeSecs}s ago`;
      }
    }
  }, 1000);

});
