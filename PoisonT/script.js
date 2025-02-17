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
        stopBtn.disabled = true;
    } catch (err) {
        console.error("無法啟動攝像頭: ", err);
        result.innerHTML = `錯誤：無法啟動攝像頭。請檢查瀏覽器權限設置或設備支持性。${err.message}`;
        analyzeBtn.disabled = true;
    }
}

function calculateSlope(data) {
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    let n = data.length;
    
    for (let i = 0; i < n; i++) {
        sumX += data[i].time;
        sumY += data[i].inhibitionRate;
        sumXY += data[i].time * data[i].inhibitionRate;
        sumXX += data[i].time * data[i].time;
    }
    
    let slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
}

function calculateInhibitionRate(blank, sample) {
    return ((blank - sample) / blank) * 100;
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

        redBoxPositions[box.id] = { left, top };
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

analyzeBtn.addEventListener('click', async function () {
    logRGBValues = [];
    let intervalCount = 0;

    stopBtn.disabled = false;
    analyzeBtn.disabled = true;

    interval = setInterval(() => {
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);
        
        let inhibitionRate = calculateInhibitionRate(color1.r, color2.r);

        logRGBValues.push({
            time: intervalCount * 10,
            inhibitionRate: inhibitionRate
        });

        result.innerHTML = `
            時間: ${intervalCount * 10} 秒<br>
            抑制率: ${inhibitionRate.toFixed(2)}%
        `;

        intervalCount++;
        if (intervalCount >= 361) {
            clearInterval(interval);
            let slope = calculateSlope(logRGBValues);
            result.innerHTML += `<h3>斜率: ${slope.toFixed(3)}</h3>`;
            analyzeBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }, 10000);
});

startCamera();
makeDraggable(redBox1);
makeDraggable(redBox2);

document.getElementById('startBtn').addEventListener('click', async () => {
    await startCamera();
});
