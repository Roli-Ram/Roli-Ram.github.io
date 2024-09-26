const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const stopBtn = document.getElementById('stopBtn');
const result = document.getElementById('result');

// 紅框元素
const redBox1 = document.getElementById('redBox1');

let interval;  // 定義 interval 變量
let logRGBValues = [];  // 用來存儲取樣結果

// 啟動攝像頭
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment' // 優先使用後置攝像頭
            } 
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
        };
        analyzeBtn.disabled = false;
        stopBtn.disabled = true;  // 初始化禁用「提前結束」按鈕
    } catch (err) {
        console.error("無法啟動攝像頭: ", err);
        result.innerHTML = `錯誤：無法啟動攝像頭。${err.message}`;
        analyzeBtn.disabled = true;
    }
}

// 初始化
startCamera();

// 計算指定框中的顏色平均值
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

// 生成 Excel 文件並下載
function downloadExcel(logRGBValues) {
    const wb = XLSX.utils.book_new();
    const wsData = [["Time (s)", "Sample R", "Sample G", "Sample B"]];

    logRGBValues.forEach(entry => {
        wsData.push([entry.time, entry.color1.r, entry.color1.g, entry.color1.b]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "RGB Data");
    XLSX.writeFile(wb, "rgb_results.xlsx");
}

// 分析按鈕點擊事件
analyzeBtn.addEventListener('click', function() {
    logRGBValues = [];  // 清空舊的取樣結果
    let intervalCount = 1;

    stopBtn.disabled = false;  // 启用「提前結束」按鈕
    analyzeBtn.disabled = true; // 禁用分析按鈕

    interval = setInterval(() => {
        const color1 = getAverageColor(redBox1);

        logRGBValues.push({
            time: intervalCount * 10, 
            color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
        });

        result.innerHTML = `
            時間: ${intervalCount * 10} 秒<br>
            樣品 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
        `;

        intervalCount++;

        if (intervalCount >= 18) {
            clearInterval(interval);
            result.innerHTML += `<h3>取樣結果 (每10秒):</h3>`;
            downloadExcel(logRGBValues);
            analyzeBtn.disabled = false;  // 分析結束，重新啟用按鈕
            stopBtn.disabled = true; // 停用提前結束按鈕
        }
    }, 10000); // 每 10 秒取一次值
});

// 提前結束按鈕點擊事件
stopBtn.addEventListener('click', function() {
    clearInterval(interval);  // 停止定時器
    result.innerHTML += `<h3>取樣已提前結束</h3>`;
    downloadExcel(logRGBValues);  // 下載當前的結果
    analyzeBtn.disabled = false;  // 重新啟用分析按鈕
    stopBtn.disabled = true;  // 禁用提前結束按鈕
});
