
function getDeviceBrandModel() {
    const ua = navigator.userAgent;

    if (/android/i.test(ua)) {
        const modelMatch = ua.match(/Android.*?;\s*(.+?)\s*Build/);
        const model = modelMatch ? modelMatch[1].trim() : "Android";
        const brandMatch = ua.match(/\((.*?)\)/);
        const brand = brandMatch ? brandMatch[1].split(";")[0].trim() : "Android";

        return `${brand}_${model}`.replace(/\s+/g, "_");
    } else if (/iphone/i.test(ua)) {
        return "Apple_iPhone";
    } else if (/ipad/i.test(ua)) {
        return "Apple_iPad";
    } else {
        return "Unknown_Device";
    }
}


// script.js 整合更新版
const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const stopBtn = document.getElementById('stopBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');
const redBox2 = document.getElementById('redBox2');

let stream;
let interval;
let logRGBValues = [];

let blueChart;

function initChart() {
    const ctx = document.getElementById('blueChart').getContext('2d');
    blueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '空白組 B',
                    data: [],
                    borderColor: 'blue',
                    borderWidth: 2,
                    fill: false
                },
                {
                    label: '樣品組 B',
                    data: [],
                    borderColor: 'purple',
                    borderWidth: 2,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                x: { title: { display: true, text: '時間 (秒)' } },
                y: { title: { display: true, text: 'B 通道值' }, min: 0, max: 255 }
            }
        }
    });
}

function updateChart(time, b1, b2) {
    blueChart.data.labels.push(time);
    blueChart.data.datasets[0].data.push(b1);
    blueChart.data.datasets[1].data.push(b2);
    blueChart.update();
}


// 儲存框位置
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
        offsetX = clientX - box.getBoundingClientRect().left;
        offsetY = clientY - box.getBoundingClientRect().top;
        document.body.style.cursor = 'grabbing';
    }

    function moveDragging(e) {
        if (!isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const containerRect = document.querySelector('.container').getBoundingClientRect();
        const left = clientX - containerRect.left - offsetX;
        const top = clientY - containerRect.top - offsetY;

        box.style.left = `${left}px`;
        box.style.top = `${top}px`;

        // 更新位置
        redBoxPositions[box.id] = { left, top };
    }

    function stopDragging() {
        isDragging = false;
        document.body.style.cursor = 'default';
    }

    // 框的拖動事件監聽
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
    const containerRect = document.querySelector('.container').getBoundingClientRect();

    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    const boxLeft = redBoxPositions[box.id].left;
    const boxTop = redBoxPositions[box.id].top;
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    const boxX = (boxLeft + containerRect.left - videoRect.left) * scaleX;
    const boxY = (boxTop + containerRect.top - videoRect.top) * scaleY;

    const imageData = ctx.getImageData(boxX, boxY, boxWidth * scaleX, boxHeight * scaleY).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        count++;
    }

    return { r: r / count, g: g / count, b: b / count };
}

function downloadExcel(logRGBValues) {
    const wb = XLSX.utils.book_new();
    const wsData = [["Time (s)", "Blank R", "Blank G", "Blank B", "Sample R", "Sample G", "Sample B"]];

    logRGBValues.forEach(entry => {
        wsData.push([
            entry.time,
            entry.color1.r, entry.color1.g, entry.color1.b,
            entry.color2.r, entry.color2.g, entry.color2.b
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "RGB Data");
        const deviceInfo = getDeviceBrandModel();
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const filename = `${deviceInfo}_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
}

analyzeBtn.addEventListener('click', async function () {
    if (!blueChart) initChart();
    logRGBValues = [];
    let intervalCount = 0;

    stopBtn.disabled = false;
    analyzeBtn.disabled = true;

        if (!blueChart) initChart();

    function record() {
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);

        logRGBValues.push({
            time: intervalCount * 2,
            color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
            color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) }
        });

        
        updateChart(intervalCount * 2, color1.b, color2.b);
        result.innerHTML = `
            時間: ${intervalCount * 2} 秒<br>
            空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        `;

        intervalCount++;
        if (intervalCount > 90) {
            clearInterval(interval);
            result.innerHTML += `<h3>取樣結果 (每2秒):</h3>`;
            downloadExcel(logRGBValues);
            analyzeBtn.disabled = false;
            stopBtn.disabled = true;
            toggleTorch(false);
        }
    }

    record(); // 立即記錄 0 秒
    interval = setInterval(record, 2000);
});

stopBtn.addEventListener('click', function () {
    clearInterval(interval);
    result.innerHTML += `<h3>取樣已提前結束</h3>`;
    downloadExcel(logRGBValues);
    analyzeBtn.disabled = false;
    stopBtn.disabled = true;
    toggleTorch(false);
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

document.getElementById('startBtn').addEventListener('click', async () => {
    await startCamera();
});

function calculateQuartiles(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return { q1: "N/A", q2: "N/A" };
    }

    values.sort((a, b) => a - b);
    const q1 = values[Math.floor((values.length - 1) * 0.25)];
    const q2 = values[Math.floor((values.length - 1) * 0.5)];

    return {
        q1: q1 !== undefined ? q1.toFixed(3) : "N/A",
        q2: q2 !== undefined ? q2.toFixed(3) : "N/A"
    };
}

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

function showQuartiles() {
    const validData = logRGBValues.filter(entry => entry.slope && entry.slope.b1 !== undefined && entry.slope.b2 !== undefined);
    const b1Values = validData.map(entry => parseFloat(entry.slope.b1));
    const b2Values = validData.map(entry => parseFloat(entry.slope.b2));
    const b1Stats = calculateQuartiles(b1Values);
    const b2Stats = calculateQuartiles(b2Values);
    const percentReduction = calculatePercentageReduction(b1Stats, b2Stats);
    const percentResult = percentReduction.average;
    localStorage.setItem("rate", percentResult);
    location.href = "Results.html";
}

const torchBtn = document.getElementById('torchBtn');
torchBtn.addEventListener('click', function () {
    try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
            const currentState = torchBtn.dataset.state === "on";
            track.applyConstraints({
                advanced: [{ torch: !currentState }]
            });
            torchBtn.dataset.state = currentState ? "off" : "on";
            torchBtn.textContent = currentState ? "開啟手電筒" : "關閉手電筒";
        }
    } catch (err) {
        console.error("無法控制手電筒: ", err);
    }
});
