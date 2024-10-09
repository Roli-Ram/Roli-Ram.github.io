const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');
const redBox2 = document.getElementById('redBox2');  // 第二個紅框

let stream;

// 啟動攝像頭
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' } // 優先使用後置攝像頭
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

// 開啟手電筒
async function toggleTorch(on) {
    try {
        const track = stream.getVideoTracks()[0]; // 獲取後置攝像頭的視頻 track
        const capabilities = track.getCapabilities();

        if (capabilities.torch) { // 檢查設備是否支持手電筒
            await track.applyConstraints({
                advanced: [{ torch: on }] // 開啟或關閉手電筒
            });
        } else {
            console.warn("此設備不支持手電筒功能。");
        }
    } catch (err) {
        console.error("無法控制手電筒: ", err);
        alert("無法控制手電筒，繼續進行檢測。");
    }
}

// 初始化攝像頭
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

// 計算藍色抑制率
function calculateInhibitionRate(controlColor, treatmentColor) {
    const controlBlue = 255 - controlColor.b;  // 使用對照組的藍色通道值
    const treatmentBlue = 255 - treatmentColor.b;  // 使用處理組的藍色通道值

    const inhibitionRate = ((controlBlue - treatmentBlue) / controlBlue) * 100;
    return inhibitionRate.toFixed(2);  // 保留兩位小數
}

// 分析按鈕點擊事件
analyzeBtn.addEventListener('click', async function () {
    // 固定紅框位置
    redBox1.classList.add('fixed');
    redBox2.classList.add('fixed');

    // 開啟手電筒
    await toggleTorch(true);

    // 取樣
    const color1 = getAverageColor(redBox1);  // 樣品1 (處理組)
    const color2 = getAverageColor(redBox2);  // 樣品2 (對照組)

    // 計算藍色抑制率
    const inhibitionRate = calculateInhibitionRate(color2, color1);

    // 顯示結果
    result.innerHTML = `
        樣品1 RGB (處理組): (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
        樣品2 RGB (對照組): (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        抑制率: ${inhibitionRate}%<br>
    `;

    // 關閉手電筒
    await toggleTorch(false);
});
