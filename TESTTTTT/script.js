
window.addEventListener('DOMContentLoaded', () => {
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

}



analyzeBtn.addEventListener('click', async function () {
    logRGBValues = [];
    let intervalCount = 0;

    stopBtn.disabled = false;
    analyzeBtn.disabled = true;

    await toggleTorch(true);

    interval = setInterval(() => {
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);

        

const prev = logRGBValues[logRGBValues.length - 1];
if (prev) {
    const slope = {
        b1: (parseFloat(prev.color1.b) - color1.b).toFixed(3),
        b2: (parseFloat(prev.color2.b) - color2.b).toFixed(3)
    };

    logRGBValues.push({
        time: intervalCount * 2,
        color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
        color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) },
        slope
    });
}



        result.innerHTML = `
            時間: ${intervalCount * 2} 秒<br>
            空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        `;

        intervalCount++;
        if (intervalCount >= 91) {
            clearInterval(interval);
            result.innerHTML += `<h3>取樣結果 (每2秒):</h3>`;            analyzeBtn.disabled = false;
            stopBtn.disabled = true;
            toggleTorch(false);
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

document.getElementById('startBtn').addEventListener('click', async () => {
    await startCamera();
});


function calculateQuartiles(values) {
    values.sort((a, b) => a - b);
    const q1 = values[Math.floor((values.length - 1) * 0.25)];
    const q2 = values[Math.floor((values.length - 1) * 0.5)];
    return { q1: q1.toFixed(3), q2: q2.toFixed(3) };
}



function showQuartiles() {
    const b1Values = logRGBValues.map(entry => parseFloat(entry.slope.b1));
    const b2Values = logRGBValues.map(entry => parseFloat(entry.slope.b2));
    const b1Stats = calculateQuartiles(b1Values);
    const b2Stats = calculateQuartiles(b2Values);
    const percentReduction = calculatePercentageReduction(b1Stats, b2Stats);

    result.innerHTML += `
        <br><strong>空白組藍色變化：</strong><br>
        Q1: ${b1Stats.q1}<br>
        Q2 (中位數): ${b1Stats.q2}<br>
        <strong>樣品組藍色變化：</strong><br>
        Q1: ${b2Stats.q1}<br>
        Q2 (中位數): ${b2Stats.q2}<br>
        <strong>抑制率：</strong><br>
        1 - (樣品Q1 / 空白Q1) = ${percentReduction.q1Percent}<br>
        1 - (樣品Q2 / 空白Q2) = ${percentReduction.q2Percent}<br>
        <strong>平均抑制率：</strong> ${percentReduction.average}<br>
    `;
}



function calculatePercentageReduction(b1Stats, b2Stats) {
    function safePercent(qB1, qB2) {
        const n1 = parseFloat(qB1);
        const n2 = parseFloat(qB2);
        if (n1 === 0) return null;
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

});
