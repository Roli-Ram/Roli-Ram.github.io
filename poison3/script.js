const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const torchBtn = document.getElementById('torchBtn');  // 手電筒按鈕
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');  // 樣品紅框
const redBox2 = document.getElementById('redBox2');  // 對照紅框
const redBox3 = document.getElementById('redBox3');  // 100%紅框

let stream;
let isTorchOn = false;  // 手電筒狀態變數

// 啟動攝像頭
async function startCamera() {
    try {
        // 僅啟用相機流，不強制手動白平衡設置
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }  // 使用後置攝像頭
        });

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        // 檢查白平衡支持
        if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('manual')) {
            await track.applyConstraints({ advanced: [{ whiteBalanceMode: 'manual' }] });
            console.log("已手動禁用自動白平衡");
        } else {
            console.warn("此設備不支持手動白平衡，將使用自動白平衡");
        }

        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
        };
        analyzeBtn.disabled = false;
        torchBtn.disabled = false;  // 手電筒按鈕啟用
        console.log("相機啟動成功，應用自動白平衡（如無法手動控制）。");

    } catch (err) {
        console.error("無法啟動攝像頭: ", err);
        result.innerHTML = `錯誤：無法啟動攝像頭。${err.message}`;
        analyzeBtn.disabled = true;
        torchBtn.disabled = true;  // 禁用手電筒按鈕
    }
}

// 手動控制手電筒
async function toggleTorch() {
    try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        if (capabilities.torch) {
            isTorchOn = !isTorchOn;  // 切換手電筒狀態
            await track.applyConstraints({
                advanced: [{ torch: isTorchOn }]
            });
            torchBtn.textContent = isTorchOn ? '關閉手電筒' : '開啟手電筒';  // 更新按鈕文字
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

// 分析按鈕點擊事件
analyzeBtn.addEventListener('click', async function () {
    redBox1.classList.add('fixed');
    redBox2.classList.add('fixed');
    redBox3.classList.add('fixed');

    const color1 = getAverageColor(redBox1);  // 樣品顏色
    const color2 = getAverageColor(redBox2);  // 對照組顏色
    const color3 = getAverageColor(redBox3);  // 100% 顏色

    // 計算抑制率
    const inhibitionRate = calculateInhibitionRate(color2, color1, color3);
    
    result.innerHTML = `
        樣品1 RGB (處理組): (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
        樣品2 RGB (0%): (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        樣品3 RGB (100%): (${color3.r.toFixed(3)}, ${color3.g.toFixed(3)}, ${color3.b.toFixed(3)})<br>
        抑制率: ${inhibitionRate}%<br>
    `;
});

// 手電筒按鈕點擊事件
torchBtn.addEventListener('click', toggleTorch);
