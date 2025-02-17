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
    } catch (err) {
        console.error("無法啟動攝像頭: ", err);
        result.innerHTML = `錯誤：無法啟動攝像頭。請檢查瀏覽器權限設置或設備支持性。${err.message}`;
        analyzeBtn.disabled = true;
    }
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

function calculateSlope(data) {
    let n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += data[i].time;
        sumY += data[i].value;
        sumXY += data[i].time * data[i].value;
        sumX2 += data[i].time * data[i].time;
    }

    let slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
}

function calculateInhibition(blankBlue, sampleBlue) {
    return ((blankBlue - sampleBlue) / blankBlue) * 100;
}

analyzeBtn.addEventListener('click', async function () {
    logRGBValues = [];
    let intervalCount = 0;

    analyzeBtn.disabled = true;

    interval = setInterval(() => {
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);

        logRGBValues.push({
            time: intervalCount * 10,
            blankBlue: color1.b,
            sampleBlue: color2.b
        });

        const inhibitionRate = calculateInhibition(color1.b, color2.b);
        result.innerHTML = `
            時間: ${intervalCount * 10} 秒<br>
            空白組 B: ${color1.b.toFixed(3)}<br>
            樣品組 B: ${color2.b.toFixed(3)}<br>
            抑制率: ${inhibitionRate.toFixed(2)} %<br>
        `;

        intervalCount++;
        if (intervalCount >= 30) { // 300 秒 / 10 秒
            clearInterval(interval);
            analyzeBtn.disabled = false;
        }
    }, 10000);
});

startCamera();
