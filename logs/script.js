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
  const branch = "main";

  const worksheet = XLSX.utils.json_to_sheet(logRGBValues);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "log");

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
  function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  }

  const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const base64 = btoa(String.fromCharCode(...uint8Array));

  const filename = "log_" + new Date().toISOString().replaceAll(":", "-") + ".xlsx";
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
        message: "上傳測試資料 log.xlsx",
        content: base64,
        branch,
        ...(sha ? { sha } : {})
      })
    });

    if (!res.ok) throw new Error(await res.text());

    document.getElementById("status").innerText = "✅ 上傳成功！";
    console.log("✅ Excel 檔已上傳至 GitHub");
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "❌ 上傳失敗：" + err.message;
  }
}
