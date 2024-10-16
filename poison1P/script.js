const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');  // 紅框元素

let stream;  // 保存攝像頭流
const totalTests = 10;  // 設定連續測試次數，可以修改次數
let testCount = 0;  // 當前測試次數
let sumR = 0, sumG = 0, sumB = 0;  // 累積RGB值

// 啟動攝像頭並嘗試啟用手電筒
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
        console.log("攝像頭已成功啟動");
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
            console.warn("此設備不支持手電筒功能。");  // 設備不支持手電筒時僅警告，繼續檢測
        }
    } catch (err) {
        console.error("無法控制手電筒: ", err);
        alert("無法控制手電筒，繼續進行檢測。");  // 提示無法控制手電筒，繼續檢測
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

// 執行單次測試
async function runSingleTest() {
    const color1 = getAverageColor(redBox1);

    // 累計每次的 RGB 值
    sumR += color1.r;
    sumG += color1.g;
    sumB += color1.b;

    testCount++;

    // 判斷是否達到測試次數
    if (testCount >= totalTests) {
        // 計算平均值
        const avgR = sumR / totalTests;
        const avgG = sumG / totalTests;
        const avgB = sumB / totalTests;

        result.innerHTML = `
            測試次數: ${totalTests}<br>
            平均 RGB: (${avgR.toFixed(3)}, ${avgG.toFixed(3)}, ${avgB.toFixed(3)})<br>
        `;

        // 重置變量
        testCount = 0;
        sumR = 0;
        sumG = 0;
        sumB = 0;

        // 測試結束後關閉手電筒
        await toggleTorch(false);
    } else {
        // 如果還沒有完成所有測試，繼續進行下一次測試
        setTimeout(runSingleTest, 1000);  // 設置1秒延遲後進行下一次測試
    }
}

// 分析按鈕點擊事件，開始連續測試
analyzeBtn.addEventListener('click', async function () {
    // 固定紅框位置
    redBox1.classList.add('fixed');

    // 開啟手電筒
    await toggleTorch(true);

    // 初始化變數
    testCount = 0;
    sumR = 0;
    sumG = 0;
    sumB = 0;

    // 開始第一次測試
    runSingleTest();
});
