const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const result = document.getElementById('result');

// 紅框元素
const redBox1 = document.getElementById('redBox1');
const redBox2 = document.getElementById('redBox2');

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
    
    // 設定 canvas 大小為攝像頭畫面的解析度
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // 將攝像頭畫面繪製到 canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 取得視頻框的邊界和紅框的邊界
    const videoRect = video.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();

    // 計算視頻的縮放比例（因為視頻的解析度和顯示大小可能不同）
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    // 計算紅框在視頻上的座標與大小
    const boxX = (boxRect.left - videoRect.left) * scaleX;
    const boxY = (boxRect.top - videoRect.top) * scaleY;
    const boxWidth = boxRect.width * scaleX;
    const boxHeight = boxRect.height * scaleY;

    // 取得紅框內的像素數據
    const imageData = ctx.getImageData(boxX, boxY, boxWidth, boxHeight).data;

    // 計算紅框內的 RGB 平均值
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];     // Red
        g += imageData[i + 1]; // Green
        b += imageData[i + 2]; // Blue
        count++;
    }

    // 回傳紅框內的平均 RGB 顏色
    return { r: r / count, g: g / count, b: b / count };
}

// 每 10 秒取一次值，持續 3 分鐘
analyzeBtn.addEventListener('click', function() {
    const logRGBValues = [];
    let intervalCount = 0;
    const interval = setInterval(() => {
        // 分別取得每個紅框的平均 RGB
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);
        
        // 計算濃度
        const o3D = ((color2.b - color1.b) / color1.b) * 100;

        // 記錄每次取得的 RGB 值
        logRGBValues.push({
            time: intervalCount * 10, // 當前時間 (秒)
            color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
            color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) },
            inhibitionRate: o3D.toFixed(2) // 酵素抑制率
        });

        // 更新結果顯示
        result.innerHTML = `
            時間: ${intervalCount * 10} 秒<br>
            標準品 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            樣品 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
            酵素抑制率: ${o3D.toFixed(2)} %<br>
        `;

        intervalCount++;

        // 當 3 分鐘（180 秒）結束時停止
        if (intervalCount >= 18) {
            clearInterval(interval);
            console.log('RGB Values Log:', logRGBValues); // 在 console 中列出所有記錄的 RGB 值
        }
    }, 10000); // 每 10 秒取一次值
});
