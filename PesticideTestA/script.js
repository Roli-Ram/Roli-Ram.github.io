const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const stopBtn = document.getElementById('stopBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');
const redBox2 = document.getElementById('redBox2');
const analyzingOverlay = document.getElementById('analyzingOverlay');

let stream;
let interval;
let logRGBValues = [];

let redBoxPositions = {
    redBox1: { left: 0, top: 0 },
    redBox2: { left: 0, top: 0 },
};

async function startCamera() {
    video.setAttribute('playsinline', true);
    video.setAttribute('webkit-playsinline', true);

    try {
        const constraints = {
            video: { facingMode: 'environment' }
        };
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("瀏覽器不支持 getUserMedia");
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
        };
        analyzeBtn.disabled = false;
        stopBtn.disabled = true;
    } catch (err) {
        console.error("無法啟動攝像頭: ", err);
        result.innerHTML = `錯誤：無法啟動攝像頭。請檢查瀏覽器權限設置或設備支持性。${err.message}`;
        analyzeBtn.disabled = true;
    }
}

function makeDraggable(box) {
    let offsetX = 0, offsetY = 0, isDragging = false;

    function startDragging(e) {
        isDragging = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const parentRect = box.offsetParent.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();

        offsetX = clientX - boxRect.left;
        offsetY = clientY - boxRect.top;

        e.preventDefault();
        e.stopPropagation();
        document.body.style.cursor = 'grabbing';
    }

    function moveDragging(e) {
        if (!isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const parent = box.offsetParent;
        const camera = document.getElementById('camera');
        const parentRect = parent.getBoundingClientRect();
        const cameraRect = camera.getBoundingClientRect();

        const cameraOffsetLeft = cameraRect.left - parentRect.left;
        const cameraOffsetTop = cameraRect.top - parentRect.top;

        const boxWidth = box.offsetWidth;
        const boxHeight = box.offsetHeight;

        const rawLeft = clientX - parentRect.left - offsetX;
        const rawTop = clientY - parentRect.top - offsetY;

        const minLeft = cameraOffsetLeft;
        const maxLeft = cameraOffsetLeft + camera.offsetWidth - boxWidth;
        const minTop = cameraOffsetTop;
        const maxTop = cameraOffsetTop + camera.offsetHeight - boxHeight;

        const newLeft = Math.max(minLeft, Math.min(rawLeft, maxLeft));
        const newTop = Math.max(minTop, Math.min(rawTop, maxTop));

        box.style.left = `${newLeft}px`;
        box.style.top = `${newTop}px`;

        redBoxPositions[box.id] = { left: newLeft, top: newTop };
    }

    function stopDragging() {
        isDragging = false;
        document.body.style.cursor = 'default';
    }

    box.addEventListener('mousedown', startDragging);
    box.addEventListener('touchstart', startDragging);
    document.addEventListener('mousemove', moveDragging);
    document.addEventListener('touchmove', moveDragging, { passive: false });
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);
}

function getAverageColor(box) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const videoRect = video.getBoundingClientRect();
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    const boxLeft = redBoxPositions[box.id].left;
    const boxTop = redBoxPositions[box.id].top;
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    const boxX = boxLeft * scaleX;
    const boxY = boxTop * scaleY;
    const boxW = boxWidth * scaleX;
    const boxH = boxHeight * scaleY;

    const safeX = Math.max(0, Math.min(boxX, canvas.width - boxW));
    const safeY = Math.max(0, Math.min(boxY, canvas.height - boxH));

    const imageData = ctx.getImageData(safeX, safeY, boxW, boxH).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        count++;
    }

    return { r: r / count, g: g / count, b: b / count };
}

function removeOutliers(values, count = 3) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.slice(count, sorted.length - count);
}

function calculateQuartiles(values) {
    values = values.filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return { q1: "N/A", q2: "N/A" };

    const trimmed = removeOutliers(values, 3);
    if (trimmed.length === 0) return { q1: "N/A", q2: "N/A" };

    const median = arr => {
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
    };

    const q2Raw = median(trimmed);
    const lowerHalf = trimmed.slice(0, Math.floor(trimmed.length / 2));
    const q1Raw = median(lowerHalf);

    return {
        q1: q1Raw.toFixed(5),
        q2: q2Raw.toFixed(5)
    };
}

analyzeBtn.addEventListener('click', async function () {
    updateRedBoxPositions();
    
    logRGBValues = [];
    let intervalCount = 180;

    stopBtn.disabled = false;
    analyzeBtn.disabled = true;

    analyzingOverlay.style.display = 'flex'; //  顯示提示條
    //await toggleTorch(true);

    // 立刻顯示
    const color1 = getAverageColor(redBox1);
    const color2 = getAverageColor(redBox2);

    logRGBValues.push({
        time: intervalCount,
        color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
        color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) },
        slope: null
    });

    result.innerHTML = `
        剩餘時間: ${intervalCount} 秒<br>
        空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
        樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
    `;

    intervalCount -= 2;

    interval = setInterval(() => {
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);

        const prev = logRGBValues[logRGBValues.length - 1];
        const slope = {
            b1: (parseFloat(prev.color1.b) - color1.b).toFixed(3),
            b2: (parseFloat(prev.color2.b) - color2.b).toFixed(3)
        };

        logRGBValues.push({
            time: intervalCount,
            color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
            color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) },
            slope
        });

        result.innerHTML = `
            剩餘時間: ${intervalCount} 秒<br>
            空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        `;

        intervalCount -= 2;

        if (intervalCount < 0) {
            clearInterval(interval);
            analyzeBtn.disabled = false;
            stopBtn.disabled = true;
            toggleTorch(false);
            analyzingOverlay.style.display = 'none'; // 分析結束隱藏
            showQuartiles();
        }
    }, 2000);
});

function toggleTorch(on) {
    try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
            track.applyConstraints({
                advanced: [{ torch: on }]
            });
        }
    } catch (err) {
        console.error("無法控制手電筒: ", err);
    }
}

startCamera();
makeDraggable(redBox1);
makeDraggable(redBox2);
//20250514
document.getElementById('startBtn').addEventListener('click', async () => {
    await startCamera();
     // 更新紅框位置
    video.onloadeddata = () => {
        updateRedBoxPositions();

        // 抓取紅框 RGB 值
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);

        // 顯示在 result 區塊
        result.innerHTML = `
            空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        `;
    };
    });    
//20250514
   
function calculatePercentageReduction(b1Stats, b2Stats) {
    function safePercent(qB1, qB2) {
        const n1 = parseFloat(qB1);
        const n2 = parseFloat(qB2);
        if (n1 === 0) return null;
        return (1 - (n2 / n1)) * 100;
    }

    const q1Raw = safePercent(b1Stats.q1, b2Stats.q1);
    const q2Raw = safePercent(b1Stats.q2, b2Stats.q2);
    const avg = (q1Raw != null && q2Raw != null) ? ((q1Raw + q2Raw) / 2).toFixed(2) + "%" : "N/A";

    return {
        q1Percent: q1Raw != null ? q1Raw.toFixed(2) + "%" : "N/A",
        q2Percent: q2Raw != null ? q2Raw.toFixed(2) + "%" : "N/A",
        average: avg
    };
}

function updateRedBoxPositions() {
    const parentRect = video.getBoundingClientRect();

    ['redBox1', 'redBox2'].forEach(id => {
        const box = document.getElementById(id);
        const rect = box.getBoundingClientRect();

        redBoxPositions[id] = {
            left: rect.left - parentRect.left,
            top: rect.top - parentRect.top
        };
    });
}

function showQuartiles() {
    // 過濾有效資料
    const validData = logRGBValues.filter(entry =>
        entry.slope &&
        !isNaN(parseFloat(entry.slope.b1)) &&
        !isNaN(parseFloat(entry.slope.b2))
    );

    // 取變化幅度（無論上升或下降）
    const b1Values = validData.map(entry => Math.abs(parseFloat(entry.slope.b1)));
    const b2Values = validData.map(entry => Math.abs(parseFloat(entry.slope.b2)));

    // 四分位數統計
    const b1Stats = calculateQuartiles(b1Values);
    const b2Stats = calculateQuartiles(b2Values);

    // 計算抑制率
    const percentReduction = calculatePercentageReduction(b1Stats, b2Stats);
    const percentResult = percentReduction.average;

    // 儲存並跳轉
    localStorage.setItem("rate", percentResult);
    location.href = "Results.html";

    uploadExcelToGitHub(logRGBValues);
}

async function uploadExcelToGitHub(dataArray) {
  const token = "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";
  const username = "Roli-Ram";
  const repo = "Roli-Ram.github.io";
  const branch = "main";

  // Step 1: 建立 worksheet
  const worksheet = XLSX.utils.json_to_sheet(dataArray);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "log");

  // Step 2: 轉為 binary string 並轉 base64
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });

  function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
  }

  const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const base64 = btoa(String.fromCharCode(...uint8Array));
  const filename = "log_" + new Date().toISOString().replaceAll(":", "-") + ".xlsx";
  const path = "logs/" + filename;

  // Step 3: 檢查檔案是否已存在以取得 sha
  const url = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;
  let sha;
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json"
      }
    });
    if (res.ok) {
      const json = await res.json();
      sha = json.sha;
    }
  } catch (e) {
    console.warn("🔍 無前檔，將建立新檔");
  }

  // Step 4: 發送 PUT 請求
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json"
    },
    body: JSON.stringify({
      message: "🆕 上傳測試資料 log xlsx",
      content: base64,
      branch,
      ...(sha ? { sha } : {})
    })
  });

  if (!response.ok) {
    console.error("❌ GitHub 上傳失敗：", await response.text());
  } else {
    console.log("✅ 已成功上傳 Excel 到 GitHub");
  }
}