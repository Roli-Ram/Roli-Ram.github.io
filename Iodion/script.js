const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const stopBtn = document.getElementById('stopBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');
const redBox2 = document.getElementById('redBox2');
const redBox3 = document.getElementById('redBox3');

let stream;
let interval;
let logRGBValues = [];

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
        analyzeBtn.disabled = false;
        stopBtn.disabled = true;
    } catch (err) {
        console.error("無法啟動攝像頭: ", err);
        result.innerHTML = `錯誤：無法啟動攝像頭。${err.message}`;
        analyzeBtn.disabled = true;
    }
}

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
    const wsData = [["Time (s)", "Sample1 R", "Sample1 G", "Sample1 B", "Sample2 R", "Sample2 G", "Sample2 B", "Sample3 R", "Sample3 G", "Sample3 B"]];

    logRGBValues.forEach(entry => {
        wsData.push([
            entry.time,
            entry.color1.r, entry.color1.g, entry.color1.b,
            entry.color2.r, entry.color2.g, entry.color2.b,
            entry.color3.r, entry.color3.g, entry.color3.b
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
    redBox3.classList.add('fixed');

    await toggleTorch(true);

    interval = setInterval(() => {
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);
        const color3 = getAverageColor(redBox3);

        logRGBValues.push({
            time: intervalCount * 300,
            color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
            color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) },
            color3: { r: color3.r.toFixed(3), g: color3.g.toFixed(3), b: color3.b.toFixed(3) }
        });

        result.innerHTML = `
            時間: ${intervalCount * 10} 秒<br>
            空白 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            10 uL RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
            20 uL RGB: (${color3.r.toFixed(3)}, ${color3.g.toFixed(3)}, ${color3.b.toFixed(3)})<br>
        `;

        intervalCount++;
        // **開始每5分鐘取樣一次**
        interval = setInterval(() => {
            const color1 = getAverageColor(redBox1);
            const color2 = getAverageColor(redBox2);
            const color3 = getAverageColor(redBox3);
            logRGBValues.push({
            time: intervalCount * 300, // 每次取樣的時間 (秒)
            color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
            color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) },
            color3: { r: color3.r.toFixed(3), g: color3.g.toFixed(3), b: color3.b.toFixed(3) }
        });

        result.innerHTML = `
            時間: ${intervalCount * 10} 秒<br>
            空白 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            10 uL RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
            20 uL RGB: (${color3.r.toFixed(3)}, ${color3.g.toFixed(3)}, ${color3.b.toFixed(3)})<br>
        `;

        intervalCount++; // 增加時間計數器

        // 如果到達測試時間限制，停止
        if (intervalCount >= 12) { // 12 次表示 1 小時
            clearInterval(interval);
            result.innerHTML += `<h3>取樣結果已完成</h3>`;
            downloadExcel(logRGBValues);
            analyzeBtn.disabled = false;
            stopBtn.disabled = true;
            toggleTorch(false); // 關閉手電筒
        }
    }, 300000); // 每 5 分鐘取樣一次
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
