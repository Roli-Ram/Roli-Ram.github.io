async function uploadSampleLog() {
  const logRGBValues = [
    { time: 180, b1: 12.3, b2: 15.2 },
    { time: 178, b1: 13.1, b2: 16.0 },
    { time: 176, b1: 14.7, b2: 17.8 },
  ];

  document.getElementById("status").innerText = "上傳中...";

  const token = "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";
  const username = "Roli-Ram";
  const repo = "RGBlog";
  const branch = "main"; // 或 master，看你的 repo 分支名稱

  // 🔧 將 logRGBValues 轉成文字格式
  let contentText = "time\tb1\tb2\n";
  logRGBValues.forEach(row => {
    contentText += `${row.time}\t${row.b1}\t${row.b2}\n`;
  });

  const base64 = btoa(unescape(encodeURIComponent(contentText)));

  const filename = "log_" + new Date().toISOString().replaceAll(":", "-") + ".txt";
  const path = "logs/" + filename;
  const url = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;

  try {
    let sha;
    const getResp = await fetch(url, {
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json"
      }
    });
    if (getResp.ok) sha = (await getResp.json()).sha;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        message: "上傳測試資料 log.txt",
        content: base64,
        branch,
        ...(sha ? { sha } : {})
      })
    });

    if (!res.ok) throw new Error(await res.text());

    document.getElementById("status").innerText = "✅ 上傳成功！";
    console.log("✅ TXT 檔已上傳至 GitHub");
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "❌ 上傳失敗：" + err.message;
  }
}
