function getDeviceBrandModel() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
        const modelMatch = ua.match(/Android.*?;\s*(.+?)\s*Build/);
        const model = modelMatch ? modelMatch[1].trim() : "Android";
        const brandMatch = ua.match(/\((.*?)\)/);
        const brand = brandMatch ? brandMatch[1].split(";")[0].trim() : "Android";
        return `${brand}_${model}`.replace(/\s+/g, "_");
    } else if (/iphone/i.test(ua)) return "Apple_iPhone";
    else if (/ipad/i.test(ua)) return "Apple_iPad";
    else return "Unknown_Device";
}

const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const stopBtn = document.getElementById('stopBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');
const redBox2 = document.getElementById('redBox2');

let stream, interval, logRGBValues = [], blueChart;

let redBoxPositions = {
    redBox1: { left: 0, top: 0 },
    redBox2: { left: 0, top: 0 },
};

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

function startCamera() {
    video.setAttribute('playsinline', true);
    video.setAttribute('webkit-playsinline', true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
        stream = s;
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
        analyzeBtn.disabled = false;
        stopBtn.disabled = true;
    }).catch(err => {
        result.innerHTML = `錯誤：無法啟動攝像頭。${err.message}`;
        analyzeBtn.disabled = true;
    });
}

function makeDraggable(box) {
    let offsetX = 0, offsetY = 0, isDragging = false;

    function startDragging(e) {
        isDragging = true;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        offsetX = clientX - box.getBoundingClientRect().left;
        offsetY = clientY - box.getBoundingClientRect().top;
        document.body.style.cursor = 'grabbing';
    }

    function moveDragging(e) {
        if (!isDragging) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const containerRect = document.querySelector('.container').getBoundingClientRect();
        const left = Math.max(0, Math.min(containerRect.width - box.offsetWidth, clientX - containerRect.left - offsetX));
        const top = Math.max(0, Math.min(containerRect.height - box.offsetHeight, clientY - containerRect.top - offsetY));

        box.style.left = `${left}px`;
        box.style.top = `${top}px`;

        redBoxPositions[box.id] = { left, top };
    }

    function stopDragging() {
        isDragging = false;
        document.body.style.cursor = 'default';
    }

    box.addEventListener('mousedown', startDragging);
    box.addEventListener('touchstart', startDragging, { passive: false });

    document.addEventListener('mousemove', moveDragging);
    document.addEventListener('touchmove', moveDragging, { passive: false });

    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);
}

document.getElementById('startBtn').addEventListener('click', startCamera);
document.getElementById('torchBtn').addEventListener('click', () => {
    const track = stream.getVideoTracks()[0];
    const state = document.getElementById('torchBtn').dataset.state === "on";
    track.applyConstraints({ advanced: [{ torch: !state }] });
    document.getElementById('torchBtn').dataset.state = state ? "off" : "on";
    document.getElementById('torchBtn').textContent = state ? "開啟手電筒" : "關閉手電筒";
});

startCamera();
makeDraggable(redBox1);
makeDraggable(redBox2);
