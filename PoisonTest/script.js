const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const stopBtn = document.getElementById('stopBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');
const redBox2 = document.getElementById('redBox2');

let stream;
let interval;
let logRGBValues = [];

async function startCamera() {
    // 確保在 Safari 或 iOS 設定 playsinline
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
            adjustRedBoxPosition(); // 啟動時調整紅框位置
        };
        analyzeBtn.disabled = false;
        stopBtn.disabled = true;
    } catch (err) {
        console.error("無法啟動攝像頭: ", err);
        result.innerHTML = `錯誤：無法啟動攝像頭。請檢查瀏覽器權限設置或設備支持性。${err.message}`;
        analyzeBtn.disabled = true;
    }
}

function adjustRedBoxPosition() {
    const videoRect = video.getBoundingClientRect();
    const containerRect = document.querySelector('.container').getBoundingClientRect();

    [redBox1, redBox2, redBox3].forEach((box, index) => {
        const leftOffsets = [30, 50, 70]; // 紅框水平位置的百分比
        const boxWidth = box.offsetWidth;
        const boxHeight = box.offsetHeight;

        box.style.left = `${videoRect.left + videoRect.width * (leftOffsets[index] / 100) - containerRect.left - boxWidth / 2}px`;
        box.style.top = `${videoRect.top + videoRect.height / 2 - containerRect.top - boxHeight / 2}px`;
    });
}

video.addEventListener('loadedmetadata', adjustRedBoxPosition);
window.addEventListener('resize', adjustRedBoxPosition);

// 原有其他程式碼保持不變

async function toggleTorch(on) {
    try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
            await track.applyConstraints({
                advanced: [{ torch: on }]
            });
        }
    } catch (err) {
        console.error("無法控制手電筒: ", err);
    }
}

function getAverageColor(box) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const videoRect = video.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();

    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    const boxX = (boxRect.left - videoRect.left) * scaleX;
    const boxY = (boxRect.top - videoRect.top) * scaleY;
    const boxWidth = boxRect.width * scaleX;
    const boxHeight = boxRect.height * scaleY;

    const imageData = ctx.getImageData(boxX, boxY, boxWidth, boxHeight).data;

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
    XLSX.writeFile(wb, "rgb_results.xlsx");
}

analyzeBtn.addEventListener('click', async function () {
    logRGBValues = [];
    let intervalCount = 0;

    stopBtn.disabled = false;
    analyzeBtn.disabled = true;

    redBox1.classList.add('fixed');
    redBox2.classList.add('fixed');
    await toggleTorch(true);

    interval = setInterval(() => {
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);

        logRGBValues.push({
            time: intervalCount * 10,
            color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
            color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) }
        });

        result.innerHTML = `
            時間: ${intervalCount * 10} 秒<br>
            空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        `;

        intervalCount++;
        if (intervalCount >= 361) {
            clearInterval(interval);
            result.innerHTML += `<h3>取樣結果 (每10秒):</h3>`;
            downloadExcel(logRGBValues);
            analyzeBtn.disabled = false;
            stopBtn.disabled = true;
            toggleTorch(false);
        }
    }, 10000);
});

stopBtn.addEventListener('click', function () {
    clearInterval(interval);
    result.innerHTML += `<h3>取樣已提前結束</h3>`;
    downloadExcel(logRGBValues);
    analyzeBtn.disabled = false;
    stopBtn.disabled = true;
    toggleTorch(false);
});

startCamera();

document.getElementById('startBtn').addEventListener('click', async () => {
    await startCamera();
});
