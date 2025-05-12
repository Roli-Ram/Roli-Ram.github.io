const percent = parseFloat(new URLSearchParams(location.search).get('rate')) || 0;  // 抑制率百分比計算

const circle = document.getElementById('fgCircle');
const text = document.getElementById('percentText');
const status = document.getElementById('statusText');

const radius = 70;
const circumference = 2 * Math.PI * radius;

circle.style.strokeDasharray = circumference;
circle.style.strokeDashoffset = circumference;

// 決定顏色與文字
let color = '';
let label = '';

if (percent <= 35) {
  color = 'green';
  label = '合格';
} else if (percent <= 45) {
  color = 'orange';
  label = '有點危險';
} else {
  color = 'red';
  label = '不合格';
}

circle.style.stroke = color;
status.textContent = label;
status.style.color = color;

// 動畫
let current = 0;
const duration = 1000;
const steps = 60;
const stepTime = duration / steps;
const stepSize = percent / steps;

const interval = setInterval(() => {
  current += stepSize;
  if (current >= percent) {
    current = percent;
    clearInterval(interval);
  }
  const offset = circumference - (current / 100) * circumference;
  circle.style.strokeDashoffset = offset;
  text.textContent = Math.round(current) + '%';
}, stepTime);
