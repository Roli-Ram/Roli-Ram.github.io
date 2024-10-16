const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');  // 樣品紅框
const redBox2 = document.getElementById('redBox2');  // 對照紅框
const redBox3 = document.getElementById('redBox3');  // 100%紅框

let stream;

async function startCamera() {
    try {
        // 僅啟用相機流，不強制手動白平衡設置
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }  // 使用後置攝像頭
        });

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        // 僅在設備支持的情況下，才禁用白平衡
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
        console.log("相機啟動成功，應用自動白平衡（如無法手動控制）。");

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
        } else {
            console.warn("此設備不支持手電筒功能。");
        }
    } catch (err) {
        console.error("無法控制手電筒: ", err);
        alert("無法控制手電筒，繼續進行檢測。");
    }
}

startCamera();

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

// 基於線性插值計算抑制率，並檢查數據有效性
function calculateInhibitionRate(controlColor, treatmentColor, maxColor) {
    const controlBlue = controlColor.b;
    const treatmentBlue = treatmentColor.b;
    const maxBlue = maxColor.b;

    // 檢查分母是否為 0，避免 NaN
    if (controlBlue === maxBlue) {
        console.error("對照組藍色值與100%藍色值相同，無法計算抑制率。");
        return "錯誤：對照組與100%藍色值相同";
    }

    // 使用線性插值計算抑制率
    const inhibitionRate = 100 * (controlBlue - treatmentBlue) / (controlBlue - maxBlue);

    // 確保抑制率為有效數字
    if (isNaN(inhibitionRate) || !isFinite(inhibitionRate)) {
        return "錯誤：計算抑制率出錯";
    }

    return inhibitionRate.toFixed(2);
}

analyzeBtn.addEventListener('click', async function () {
    redBox1.classList.add('fixed');
    redBox2.classList.add('fixed');
    redBox3.classList.add('fixed');

    await toggleTorch(true);

    const color1 = getAverageColor(redBox1);  // 樣品顏色
    const color2 = getAverageColor(redBox2);  // 對照組顏色
    const color3 = getAverageColor(redBox3);  // 100% 顏色

    // 基於線性插值計算抑制率
    const inhibitionRate = calculateInhibitionRate(color2, color1, color3);
    
    result.innerHTML = `
        樣品1 RGB (處理組): (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
        樣品2 RGB (0%): (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        樣品3 RGB (100%): (${color3.r.toFixed(3)}, ${color3.g.toFixed(3)}, ${color3.b.toFixed(3)})<br>
        抑制率: ${inhibitionRate}%<br>
    `;

    await toggleTorch(false);
});
