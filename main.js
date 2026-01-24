// Smooth scroll for internal navigation and simple mobile nav toggle
document.addEventListener("DOMContentLoaded", () => {
  initSmoothScroll();
  initMobileNav();
  initDataChartFromExcel();
});

function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');
  const header = document.querySelector(".pw-header");
  const headerHeight = header ? header.offsetHeight : 0;

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href") || "";
      if (!targetId.startsWith("#") || targetId === "#") return;

      const target = document.querySelector(targetId);
      if (!target) return;

      event.preventDefault();

      const rect = target.getBoundingClientRect();
      const offsetTop = window.pageYOffset + rect.top - headerHeight - 8;

      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
    });
  });
}

function initMobileNav() {
  const body = document.body;
  const toggle = document.querySelector(".pw-nav-toggle");

  if (!toggle) return;

  toggle.addEventListener("click", () => {
    body.classList.toggle("pw-nav-open");
  });
}

// Read dataset_processed.xlsx and render multiple charts with navigation.
// Supports multiple sheets/tables in the Excel file with Prev/Next navigation.
let chartDataArray = [];
let currentChartIndex = 0;
let chartInstance = null;

// Function to update chart display - accessible from event listeners
function updateChartDisplay() {
  const fallbackImage1 = document.getElementById("chartFallbackImage1");
  const fallbackImage2 = document.getElementById("chartFallbackImage2");
  const chartTitle = document.getElementById("chartTitle");
  const chartDescription = document.getElementById("chartDescription");
  const chartIndicator = document.getElementById("chartIndicator");
  const canvas = document.getElementById("costChart");
  const totalCharts = Math.max(chartDataArray.length, 2);
  
  // Update fallback images based on current chart index (always update)
  if (fallbackImage1 && fallbackImage2) {
    // Hide all fallback images first
    fallbackImage1.style.display = "none";
    fallbackImage2.style.display = "none";
    
    // Show appropriate fallback image based on index
    if (currentChartIndex === 0) {
      fallbackImage1.style.display = "block";
    } else if (currentChartIndex === 1) {
      fallbackImage2.style.display = "block";
    } else {
      // For additional charts, cycle through available images
      const imageIndex = currentChartIndex % 2;
      if (imageIndex === 0) {
        fallbackImage1.style.display = "block";
      } else {
        fallbackImage2.style.display = "block";
      }
    }
    
    // Hide canvas if showing fallback images
    if (canvas) {
      canvas.style.display = "none";
    }
  }

  // Update chart data if chart instance exists
  if (chartInstance && chartDataArray.length > 0 && currentChartIndex < chartDataArray.length) {
    const currentData = chartDataArray[currentChartIndex];
    
    // Update chart data
    chartInstance.data.labels = currentData.labels;
    chartInstance.data.datasets[0].data = currentData.values;
    chartInstance.data.datasets[0].label = currentData.labelForDataset;
    chartInstance.update("none"); // Update without animation
    
    // Show canvas and hide fallback images if chart is working
    if (canvas) {
      canvas.style.display = "block";
    }
    if (fallbackImage1) fallbackImage1.style.display = "none";
    if (fallbackImage2) fallbackImage2.style.display = "none";
  }

  // Update title and description
  if (chartTitle) {
    if (chartDataArray.length > 0 && currentChartIndex < chartDataArray.length) {
      chartTitle.textContent = chartDataArray[currentChartIndex].title;
    } else {
      chartTitle.textContent = currentChartIndex === 0 ? "Jumlah Buku per Kategori" : "Rasio Peminjaman";
    }
  }
  
  if (chartDescription) {
    if (chartDataArray.length > 0 && currentChartIndex < chartDataArray.length) {
      chartDescription.textContent = chartDataArray[currentChartIndex].description;
    } else {
      chartDescription.textContent = currentChartIndex === 0 
        ? "Grafik menunjukkan jumlah buku berdasarkan kategori."
        : "Grafik menunjukkan rasio peminjaman buku.";
    }
  }
  
  if (chartIndicator) {
    chartIndicator.textContent = `${currentChartIndex + 1} / ${totalCharts}`;
  }
}

async function initDataChartFromExcel() {
  const canvas = document.getElementById("costChart");
  const fallback = document.getElementById("dataFallback");
  const chartTitle = document.getElementById("chartTitle");
  const chartDescription = document.getElementById("chartDescription");
  const chartIndicator = document.getElementById("chartIndicator");
  const prevBtn = document.querySelector(".pw-chart-nav-prev");
  const nextBtn = document.querySelector(".pw-chart-nav-next");

  if (!canvas || typeof XLSX === "undefined" || typeof Chart === "undefined") {
    return;
  }

  try {
    const response = await fetch("data/dataset_processed.xlsx");
    if (!response.ok) {
      throw new Error("Tidak dapat memuat file dataset_processed.xlsx");
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    
    // Process all sheets (tables) in the workbook
    chartDataArray = [];
    
    for (let i = 0; i < workbook.SheetNames.length; i++) {
      const sheetName = workbook.SheetNames[i];
      const sheet = workbook.Sheets[sheetName];
      
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!rows || rows.length < 2) {
        continue; // Skip empty sheets
      }

      const headerRow = rows[0];
      const dataRows = rows.slice(1).filter((row) => row && row.length > 1);

      if (dataRows.length === 0) {
        continue;
      }

      // Labels: assume first column
      const labels = dataRows.map((row) => String(row[0] ?? ""));

      // Try to find a numeric column to use as dataset (prefer the second column)
      let valueColumnIndex = 1;
      for (let col = 1; col < headerRow.length; col++) {
        const hasNumeric = dataRows.some((row) => typeof row[col] === "number");
        if (hasNumeric) {
          valueColumnIndex = col;
          break;
        }
      }

      const values = dataRows.map((row) => {
        const value = row[valueColumnIndex];
        return typeof value === "number" ? value : 0;
      });

      const labelForDataset = headerRow[valueColumnIndex] || "Nilai";
      const title = sheetName || `Grafik ${i + 1}`;
      const description = `Data dari tabel "${sheetName}" - ${labelForDataset}`;

      chartDataArray.push({
        title,
        description,
        labels,
        values,
        labelForDataset,
      });
    }

    if (chartDataArray.length === 0) {
      throw new Error("Tidak ada data yang valid untuk dibuat grafik.");
    }

    // Create single chart instance
    const context = canvas.getContext("2d");
    const firstData = chartDataArray[0];

    chartInstance = new Chart(context, {
      type: "bar",
      data: {
        labels: firstData.labels,
        datasets: [
          {
            label: firstData.labelForDataset,
            data: firstData.values,
            borderRadius: 12,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              font: {
                size: 10,
              },
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: {
                size: 10,
              },
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              font: {
                size: 11,
              },
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed.y;
                const currentData = chartDataArray[currentChartIndex];
                return `${currentData.labelForDataset}: ${value}`;
              },
            },
          },
        },
      },
    });

    // Show first chart
    currentChartIndex = 0;
    updateChartDisplay();

    // Show/hide navigation buttons based on number of charts
    // For fallback images, we assume at least 2 charts exist
    const totalCharts = Math.max(chartDataArray.length, 2);
    
    if (totalCharts <= 1) {
      if (prevBtn) prevBtn.style.display = "none";
      if (nextBtn) nextBtn.style.display = "none";
      if (chartIndicator) chartIndicator.style.display = "none";
    } else {
      // Navigation handlers - always enable if we have navigation buttons
      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          currentChartIndex = currentChartIndex > 0 ? currentChartIndex - 1 : totalCharts - 1;
          updateChartDisplay();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          currentChartIndex = currentChartIndex < totalCharts - 1 ? currentChartIndex + 1 : 0;
          updateChartDisplay();
        });
      }
    }

    if (fallback) {
      fallback.style.display = "none";
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Gagal memuat grafik dari dataset_processed.xlsx:", error);
    
    // Even if error, enable navigation for fallback images
    const totalCharts = 2; // Assume 2 charts for fallback images
    currentChartIndex = 0;
    
    // Show/hide navigation buttons
    if (totalCharts <= 1) {
      if (prevBtn) prevBtn.style.display = "none";
      if (nextBtn) nextBtn.style.display = "none";
      if (chartIndicator) chartIndicator.style.display = "none";
    } else {
      // Navigation handlers for fallback images
      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          currentChartIndex = currentChartIndex > 0 ? currentChartIndex - 1 : totalCharts - 1;
          updateChartDisplay();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          currentChartIndex = currentChartIndex < totalCharts - 1 ? currentChartIndex + 1 : 0;
          updateChartDisplay();
        });
      }
    }
    
    // Initialize display with first fallback image
    updateChartDisplay();
  }
}

