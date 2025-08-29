const video = document.getElementById('camera');
const analyzeBtn = document.getElementById('analyzeBtn');
const stopBtn = document.getElementById('stopBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');
const redBox2 = document.getElementById('redBox2');
const analyzingOverlay = document.getElementById('analyzingOverlay');

let stream;
let interval;
let logRGBValues = [];

let redBoxPositions = {
    redBox1: { left: 0, top: 0 },
    redBox2: { left: 0, top: 0 },
};

// 檢測裝置類型
function detectDevice() {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    return { isIOS, isAndroid };
}

async function startCamera() {
    video.setAttribute('playsinline', true);
    video.setAttribute('webkit-playsinline', true);

    try {
        const constraints = {
            video: { 
                facingMode: 'environment',
                // 為 iOS 優化的設定
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("瀏覽器不支持 getUserMedia");
        }
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                video.play().then(() => {
                    analyzeBtn.disabled = false;
                    stopBtn.disabled = true;
                    resolve();
                }).catch(reject);
            };
        });
        
    } catch (err) {
        console.error("無法啟動攝像頭: ", err);
        result.innerHTML = `錯誤：無法啟動攝像頭。請檢查瀏覽器權限設置或設備支持性。${err.message}`;
        analyzeBtn.disabled = true;
        throw err;
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
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    const boxLeft = redBoxPositions[box.id].left;
    const boxTop = redBoxPositions[box.id].top;
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    const boxX = boxLeft * scaleX;
    const boxY = boxTop * scaleY;
    const boxW = boxWidth * scaleX;
    const boxH = boxHeight * scaleY;

    const safeX = Math.max(0, Math.min(boxX, canvas.width - boxW));
    const safeY = Math.max(0, Math.min(boxY, canvas.height - boxH));

    const imageData = ctx.getImageData(safeX, safeY, boxW, boxH).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        count++;
    }

    return { r: r / count, g: g / count, b: b / count };
}

function removeOutliers(values, count = 3) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.slice(count, sorted.length - count);
}

function calculateQuartiles(values) {
    values = values.filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return { q1: "N/A", q2: "N/A" };

    const trimmed = removeOutliers(values, 3);
    if (trimmed.length === 0) return { q1: "N/A", q2: "N/A" };

    const median = arr => {
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
    };

    const q2Raw = median(trimmed);
    const lowerHalf = trimmed.slice(0, Math.floor(trimmed.length / 2));
    const q1Raw = median(lowerHalf);

    return {
        q1: q1Raw.toFixed(5),
        q2: q2Raw.toFixed(5)
    };
}

analyzeBtn.addEventListener('click', async function () {
    updateRedBoxPositions();
    
    logRGBValues = [];
    let intervalCount = 180;

    stopBtn.disabled = false;
    analyzeBtn.disabled = true;

    analyzingOverlay.style.display = 'flex';
    
    // 嘗試開啟手電筒（如果支援）
    toggleTorch(true);

    // 立即顯示
    const color1 = getAverageColor(redBox1);
    const color2 = getAverageColor(redBox2);

    logRGBValues.push({
        time: intervalCount,
        color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
        color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) },
        slope: null
    });

    result.innerHTML = `
        剩餘時間: ${intervalCount} 秒<br>
        空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
        樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
    `;

    intervalCount -= 2;

    interval = setInterval(() => {
        const color1 = getAverageColor(redBox1);
        const color2 = getAverageColor(redBox2);

        const prev = logRGBValues[logRGBValues.length - 1];
        const slope = {
            b1: (parseFloat(prev.color1.b) - color1.b).toFixed(3),
            b2: (parseFloat(prev.color2.b) - color2.b).toFixed(3)
        };

        logRGBValues.push({
            time: intervalCount,
            color1: { r: color1.r.toFixed(3), g: color1.g.toFixed(3), b: color1.b.toFixed(3) },
            color2: { r: color2.r.toFixed(3), g: color2.g.toFixed(3), b: color2.b.toFixed(3) },
            slope
        });

        result.innerHTML = `
            剩餘時間: ${intervalCount} 秒<br>
            空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
            樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
        `;

        intervalCount -= 2;

        if (intervalCount < 0) {
            clearInterval(interval);
            analyzeBtn.disabled = false;
            stopBtn.disabled = true;
            toggleTorch(false);
            analyzingOverlay.style.display = 'none';
            showQuartiles();
        }
    }, 2000);
});

// 停止按鈕功能
stopBtn.addEventListener('click', function() {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    analyzeBtn.disabled = false;
    stopBtn.disabled = true;
    toggleTorch(false);
    analyzingOverlay.style.display = 'none';
    
    if (logRGBValues.length > 1) {
        showQuartiles();
    }
});

function toggleTorch(on) {
    try {
        if (stream && stream.getVideoTracks().length > 0) {
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            if (capabilities.torch) {
                track.applyConstraints({
                    advanced: [{ torch: on }]
                });
            }
        }
    } catch (err) {
        console.error("無法控制手電筒: ", err);
    }
}

// 啟動相機按鈕
document.getElementById('startBtn').addEventListener('click', async () => {
    try {
        await startCamera();
        // 更新紅框位置
        video.onloadeddata = () => {
            updateRedBoxPositions();

            // 抓取紅框 RGB 值
            const color1 = getAverageColor(redBox1);
            const color2 = getAverageColor(redBox2);

            // 顯示在 result 區塊
            result.innerHTML = `
                空白組 RGB: (${color1.r.toFixed(3)}, ${color1.g.toFixed(3)}, ${color1.b.toFixed(3)})<br>
                樣品組 RGB: (${color2.r.toFixed(3)}, ${color2.g.toFixed(3)}, ${color2.b.toFixed(3)})<br>
            `;
        };
    } catch (error) {
        console.error('啟動相機失敗:', error);
    }
});

function calculatePercentageReduction(b1Stats, b2Stats) {
    function safePercent(qB1, qB2) {
        const n1 = parseFloat(qB1);
        const n2 = parseFloat(qB2);
        if (n1 === 0) return null;
        return (1 - (n2 / n1)) * 100;
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

function updateRedBoxPositions() {
    const parentRect = video.getBoundingClientRect();

    ['redBox1', 'redBox2'].forEach(id => {
        const box = document.getElementById(id);
        const rect = box.getBoundingClientRect();

        redBoxPositions[id] = {
            left: rect.left - parentRect.left,
            top: rect.top - parentRect.top
        };
    });
}

// 改進的檔案匯出函數 - 支援跨平台
function exportAnalysisData(data) {
    const device = detectDevice();
    
    // 準備 CSV 資料
    const csvData = convertToCSV(data);
    const filename = generateFilename();
    
    if (device.isIOS) {
        // iOS: 在新視窗開啟資料
        exportForIOS(csvData, filename);
    } else {
        // Android/其他: 直接下載
        exportWithDownload(csvData, filename);
    }
}

function convertToCSV(data) {
    const headers = [
        "時間", "空白組 R", "空白組 G", "空白組 B", 
        "樣品組 R", "樣品組 G", "樣品組 B", 
        "B通道變化量1", "B通道變化量2"
    ];
    
    const rows = data.map(entry => [
        entry.time,
        entry.color1.r, entry.color1.g, entry.color1.b,
        entry.color2.r, entry.color2.g, entry.color2.b,
        entry.slope ? entry.slope.b1 : "", 
        entry.slope ? entry.slope.b2 : ""
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    // 加入 BOM 以支援中文
    return '\ufeff' + csvContent;
}

function generateFilename() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    return `analysis_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
}

function exportForIOS(csvData, filename) {
    // 方法1: 嘗試 Web Share API (iOS 12+)
    if (navigator.share) {
        try {
            const file = new File([csvData], filename, { type: 'text/csv' });
            navigator.share({
                title: '分析結果',
                files: [file]
            }).catch(err => {
                console.log('分享失敗，使用備用方法');
                fallbackExportForIOS(csvData);
            });
            return;
        } catch (error) {
            console.log('Web Share API 不支援，使用備用方法');
        }
    }
    
    // 備用方法: 新視窗開啟
    fallbackExportForIOS(csvData);
}

function fallbackExportForIOS(csvData) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>分析結果</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; 
            padding: 20px; 
            max-width: 800px; 
            margin: 0 auto; 
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #007AFF, #5856D6);
            color: white;
            padding: 20px;
            border-radius: 12px;
        }
        .instructions { 
            background: #fff3cd; 
            padding: 20px; 
            border-radius: 12px; 
            margin-bottom: 25px;
            border-left: 4px solid #ffc107;
        }
        .step {
            margin: 15px 0;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 3px solid #007AFF;
        }
        .step-number {
            display: inline-block;
            background: #007AFF;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            text-align: center;
            line-height: 24px;
            font-weight: bold;
            margin-right: 10px;
            font-size: 14px;
        }
        .data { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 8px; 
            font-family: 'SF Mono', Monaco, monospace; 
            white-space: pre-wrap;
            font-size: 12px;
            border: 1px solid #dee2e6;
            max-height: 200px;
            overflow-y: auto;
        }
        .copy-btn { 
            background: #28a745; 
            color: white; 
            border: none; 
            padding: 15px 25px; 
            border-radius: 10px; 
            margin: 15px 5px; 
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 2px 10px rgba(40, 167, 69, 0.3);
            transition: all 0.3s ease;
        }
        .copy-btn:active {
            transform: scale(0.95);
            background: #218838;
        }
        .share-btn {
            background: #007AFF; 
            color: white; 
            border: none; 
            padding: 15px 25px; 
            border-radius: 10px; 
            margin: 15px 5px; 
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 2px 10px rgba(0, 122, 255, 0.3);
            transition: all 0.3s ease;
        }
        .share-btn:active {
            transform: scale(0.95);
            background: #0056b3;
        }
        .warning {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #dc3545;
            margin: 15px 0;
        }
        .success {
            background: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #28a745;
            margin: 15px 0;
            display: none;
        }
        .app-icon {
            display: inline-block;
            width: 20px;
            height: 20px;
            margin-right: 8px;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 攝像頭分析結果</h1>
        <p>請按照以下步驟儲存資料到您的 iPhone</p>
    </div>
    
    <div class="instructions">
        <h2>🔥 推薦方法：使用「檔案」App</h2>
        
        <div class="step">
            <span class="step-number">1</span>
            <strong>複製資料：</strong>點擊下方「📋 複製資料」按鈕
        </div>
        
        <div class="step">
            <span class="step-number">2</span>
            <strong>開啟檔案 App：</strong>在 iPhone 桌面找到 
            <span style="background: #007AFF; color: white; padding: 2px 6px; border-radius: 4px;">📁 檔案</span> 
            App 並點擊開啟
        </div>
        
        <div class="step">
            <span class="step-number">3</span>
            <strong>建立新檔案：</strong><br>
            • 點擊右上角的 <strong>「⋯」</strong> 按鈕<br>
            • 選擇 <strong>「新增文件」</strong><br>
            • 或長按空白處，選擇 <strong>「新增文件」</strong>
        </div>
        
        <div class="step">
            <span class="step-number">4</span>
            <strong>貼上並命名：</strong><br>
            • 在文字區域<strong>長按</strong>，選擇 <strong>「貼上」</strong><br>
            • 將檔名改為：<code>analysis_${new Date().toISOString().slice(0,10)}.csv</code><br>
            • <strong>重要：副檔名一定要是 .csv</strong>
        </div>
        
        <div class="step">
            <span class="step-number">5</span>
            <strong>儲存完成：</strong>點擊 <strong>「儲存」</strong>，檔案會存在「我的 iPhone」→「檔案」資料夾
        </div>
    </div>

    <div class="warning">
        <strong>⚠️ 重要提醒：</strong><br>
        • 檔名結尾一定要加 <strong>.csv</strong> 才能被 Excel 或試算表軟體正確開啟<br>
        • 如果忘記加 .csv，之後可以重新命名檔案
    </div>
    
    <div style="text-align: center; margin: 25px 0;">
        <button class="copy-btn" onclick="copyToClipboard()">📋 複製資料</button>
        <button class="share-btn" onclick="shareData()" id="shareBtn" style="display: none;">📤 分享檔案</button>
    </div>
    
    <div class="success" id="successMessage">
        <strong>✅ 複製成功！</strong><br>
        現在請開啟「檔案」App 並按照上方步驟操作
    </div>

    <details style="margin-top: 30px;">
        <summary style="font-size: 16px; font-weight: 600; cursor: pointer; padding: 10px;">
            🔍 其他儲存方法（點擊展開）
        </summary>
        <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h3>方法二：使用「備忘錄」App</h3>
            <ol>
                <li>複製資料後，開啟「備忘錄」App</li>
                <li>建立新備忘錄並貼上資料</li>
                <li>點擊分享按鈕，選擇「儲存到檔案」</li>
                <li>將檔名改為 analysis.csv 並儲存</li>
            </ol>
            
            <h3>方法三：使用 Email</h3>
            <ol>
                <li>複製資料後，開啟「郵件」App</li>
                <li>寫一封 Email 給自己並貼上資料</li>
                <li>傳送後在電腦上下載附件並另存為 .csv</li>
            </ol>
        </div>
    </details>
    
    <div style="margin-top: 30px; padding: 15px; background: #e9ecef; border-radius: 8px; font-size: 12px;">
        <h4>📄 資料預覽：</h4>
        <div class="data" id="csvData">${csvData}</div>
    </div>
    
    <script>
        // 檢查是否支援 Web Share API
        if (navigator.share && navigator.canShare) {
            document.getElementById('shareBtn').style.display = 'inline-block';
        }
        
        function copyToClipboard() {
            const data = document.getElementById('csvData').textContent;
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(data).then(() => {
                    showSuccess();
                }).catch(err => {
                    fallbackCopy(data);
                });
            } else {
                fallbackCopy(data);
            }
        }
        
        function fallbackCopy(data) {
            // 備用複製方法
            const textArea = document.createElement('textarea');
            textArea.value = data;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                showSuccess();
            } catch (err) {
                alert('❌ 複製失敗，請手動選取並複製下方資料');
            } finally {
                document.body.removeChild(textArea);
            }
        }
        
        function showSuccess() {
            const successMsg = document.getElementById('successMessage');
            successMsg.style.display = 'block';
            successMsg.scrollIntoView({ behavior: 'smooth' });
            
            // 3秒後自動隱藏
            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 5000);
        }
        
        async function shareData() {
            const data = document.getElementById('csvData').textContent;
            const filename = 'analysis_${new Date().toISOString().slice(0,10)}.csv';
            
            try {
                const file = new File([data], filename, { 
                    type: 'text/csv',
                    lastModified: Date.now() 
                });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: '攝像頭分析結果',
                        text: '分析資料 CSV 檔案',
                        files: [file]
                    });
                } else {
                    alert('⚠️ 您的瀏覽器版本不支援檔案分享，請使用複製方式');
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    alert('❌ 分享失敗：' + error.message);
                }
            }
        }
        
        // 防止頁面意外關閉
        window.addEventListener('beforeunload', function(e) {
            if (document.getElementById('successMessage').style.display === 'block') {
                const confirmationMessage = '您確定要離開嗎？請確認已完成檔案儲存。';
                e.returnValue = confirmationMessage;
                return confirmationMessage;
            }
        });
    </script>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    
    if (!newWindow) {
        alert('⚠️ 無法開啟新視窗，請檢查彈窗設定');
    }
    
    // 延遲釋放 URL
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function exportWithDownload(csvData, filename) {
    try {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        console.log('✅ 檔案下載成功');
    } catch (error) {
        console.error('下載失敗:', error);
        // 備用：使用 data URL
        const dataURL = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvData);
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// 舊的 Excel 導出函數保持向後兼容（如果需要）
function exportToExcel(data) {
    if (typeof XLSX !== 'undefined') {
        // 如果有 XLSX 庫，使用原本的 Excel 導出
        const wb = XLSX.utils.book_new();
        const worksheetData = [
            ["時間", "空白組 R", "空白組 G", "空白組 B", "樣品組 R", "樣品組 G", "樣品組 B", "B通道變化量1", "B通道變化量2"]
        ];

        data.forEach(entry => {
            worksheetData.push([
                entry.time,
                entry.color1.r, entry.color1.g, entry.color1.b,
                entry.color2.r, entry.color2.g, entry.color2.b,
                entry.slope ? entry.slope.b1 : "", 
                entry.slope ? entry.slope.b2 : ""
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(wb, ws, "分析記錄");

        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const filename = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.xlsx`;

        XLSX.writeFile(wb, filename);
    } else {
        // 沒有 XLSX 庫，使用 CSV 導出
        exportAnalysisData(data);
    }
}

function movingAverage(values, windowSize = 5) {
    const result = [];
    for (let i = 0; i <= values.length - windowSize; i++) {
        const window = values.slice(i, i + windowSize);
        const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
        result.push(avg);
    }
    return result;
}

function showQuartiles() {
    // 過濾有效資料
    const validData = logRGBValues.filter(entry =>
        entry.slope &&
        !isNaN(parseFloat(entry.slope.b1)) &&
        !isNaN(parseFloat(entry.slope.b2))
    );

    // 取變化幅度（無論上升或下降）
    const rawB1 = validData.map(entry => (parseFloat(entry.slope.b1)));
    const rawB2 = validData.map(entry => (parseFloat(entry.slope.b2)));

    // 使用滑動平均（每5筆）
    const b1Smoothed = movingAverage(rawB1, 5);
    const b2Smoothed = movingAverage(rawB2, 5);

    // 四分位數統計
    const b1Stats = calculateQuartiles(b1Smoothed);
    const b2Stats = calculateQuartiles(b2Smoothed);

    // 異常確認
    const isEnzymeError = !isNaN(parseFloat(b1Stats.q2)) && parseFloat(b1Stats.q2) < 0.4;
    
    // 儲存到記憶體（不使用 localStorage，因為在某些環境可能不可用）
    window.analysisResults = {
        enzymeError: isEnzymeError,
        rate: calculatePercentageReduction(b1Stats, b2Stats).q2Percent,
        rawData: logRGBValues,
        stats: { b1Stats, b2Stats }
    };

    // 顯示分析完成對話框
    showAnalysisCompleteDialog();
}

function showAnalysisCompleteDialog() {
    const device = detectDevice();
    const results = window.analysisResults;
    
    // 創建自訂對話框
    const dialog = document.createElement('div');
    dialog.id = 'analysisDialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    `;
    
    dialog.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        ">
            <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
            <h2 style="color: #333; margin: 0 0 15px 0;">分析完成！</h2>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 20px 0; text-align: left;">
                <div style="margin: 8px 0;"><strong>抑制率：</strong> ${results.rate}</div>
                <div style="margin: 8px 0;"><strong>酵素狀態：</strong> 
                    <span style="color: ${results.enzymeError ? '#dc3545' : '#28a745'};">
                        ${results.enzymeError ? '異常' : '正常'}
                    </span>
                </div>
                <div style="margin: 8px 0;"><strong>資料點數：</strong> ${results.rawData.length}</div>
            </div>
            
            <p style="color: #666; margin: 20px 0; line-height: 1.5;">
                ${device.isIOS ? 
                    '是否要儲存分析結果？<br><small style="color: #999;">點擊「是」會開啟新視窗提供儲存指引</small>' :
                    '是否要將分析結果下載到裝置？<br><small style="color: #999;">將自動下載 CSV 檔案</small>'
                }
            </p>
            
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                <button id="saveYes" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    min-width: 80px;
                ">是</button>
                
                <button id="saveNo" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    min-width: 80px;
                ">否</button>
            </div>
            
            <div style="margin-top: 20px; font-size: 12px; color: #999;">
                ${device.isIOS ? '🍎 iOS 裝置' : '🤖 Android 裝置'}
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 按鈕事件處理
    document.getElementById('saveYes').addEventListener('click', () => {
        document.body.removeChild(dialog);
        // 自動儲存分析結果
        exportAnalysisData(results.rawData);
        
        // 顯示儲存狀態
        showSaveStatus(true, device.isIOS);
        
        // 跳轉到結果頁面（如果存在）
        setTimeout(() => {
            if (document.querySelector('a[href="Results.html"]') || window.location.href.includes('Results.html')) {
                location.href = "Results.html";
            } else {
                displayResultsOnCurrentPage();
            }
        }, device.isIOS ? 2000 : 1000);
    });
    
    document.getElementById('saveNo').addEventListener('click', () => {
        document.body.removeChild(dialog);
        showSaveStatus(false);
        
        // 直接跳轉到結果頁面
        setTimeout(() => {
            if (document.querySelector('a[href="Results.html"]') || window.location.href.includes('Results.html')) {
                location.href = "Results.html";
            } else {
                displayResultsOnCurrentPage();
            }
        }, 500);
    });
    
    // 點擊背景關閉（預設為「否」）
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            document.getElementById('saveNo').click();
        }
    });
    
    // 添加按鈕懸停效果
    const buttons = dialog.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'none';
        });
        
        btn.addEventListener('touchstart', () => {
            btn.style.transform = 'scale(0.95)';
        });
        
        btn.addEventListener('touchend', () => {
            btn.style.transform = 'scale(1)';
        });
    });
}

function showSaveStatus(saved, isIOS = false) {
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10001;
        padding: 15px 25px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
    `;
    
    if (saved) {
        statusDiv.style.background = '#28a745';
        statusDiv.style.color = 'white';
        statusDiv.innerHTML = isIOS ? 
            '✅ 已開啟儲存頁面，請按照指引操作' : 
            '✅ 檔案已開始下載到您的裝置';
    } else {
        statusDiv.style.background = '#ffc107';
        statusDiv.style.color = '#333';
        statusDiv.innerHTML = '⏭️ 已跳過儲存，直接查看結果';
    }
    
    document.body.appendChild(statusDiv);
    
    // 自動消失
    setTimeout(() => {
        statusDiv.style.opacity = '0';
        statusDiv.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => {
            if (statusDiv.parentNode) {
                document.body.removeChild(statusDiv);
            }
        }, 300);
    }, isIOS ? 4000 : 3000);
}

function displayResultsOnCurrentPage() {
    const results = window.analysisResults;
    if (!results) return;
    
    const device = detectDevice();
    const resultDiv = document.getElementById('result') || document.createElement('div');
    resultDiv.innerHTML = `
        <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 20px 0;">
            <h2 style="text-align: center; color: #333; margin-bottom: 25px;">📊 分析結果</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #495057;">結果摘要：</h3>
                <div style="display: grid; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                        <strong>抑制率：</strong>
                        <span style="font-size: 18px; font-weight: bold; color: #007bff;">${results.rate}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                        <strong>酵素狀態：</strong>
                        <span style="padding: 4px 12px; border-radius: 20px; font-weight: bold; color: white; background: ${results.enzymeError ? '#dc3545' : '#28a745'};">
                            ${results.enzymeError ? '異常' : '正常'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                        <strong>資料點數：</strong>
                        <span>${results.rawData.length}</span>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <button onclick="exportAnalysisData(window.analysisResults.rawData)" 
                        style="
                            background: linear-gradient(135deg, #28a745, #20c997);
                            color: white; 
                            border: none; 
                            padding: 15px 30px; 
                            border-radius: 10px; 
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
                            transition: all 0.3s ease;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(40, 167, 69, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(40, 167, 69, 0.3)'"
                        ontouchstart="this.style.transform='scale(0.95)'"
                        ontouchend="this.style.transform='scale(1)'">
                    📥 ${device.isIOS ? '儲存分析資料' : '下載分析資料'}
                </button>
                
                <div style="margin-top: 15px; font-size: 14px; color: #6c757d;">
                    ${device.isIOS ? 
                        '點擊後會開啟新頁面並提供儲存指引' : 
                        '點擊後會自動下載 CSV 檔案到您的裝置'
                    }
                </div>
            </div>
            
            ${results.enzymeError ? `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <h4 style="color: #856404; margin-top: 0;">⚠️ 注意事項</h4>
                    <p style="color: #856404; margin: 0; line-height: 1.5;">
                        檢測到酵素狀態異常，建議重新檢測或諮詢專業人員。
                    </p>
                </div>
            ` : ''}
        </div>
    `;
    
    if (!document.getElementById('result')) {
        document.body.appendChild(resultDiv);
    }
    
    // 滾動到結果區域
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 初始化
startCamera().catch(console.error);
makeDraggable(redBox1);
makeDraggable(redBox2);
 
