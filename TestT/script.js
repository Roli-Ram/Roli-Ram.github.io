// 強制防止整頁滾動的全域設定
const style = document.createElement('style');
style.innerHTML = `
  html, body {
    overscroll-behavior: none;
    touch-action: none;
  }
`;
document.head.appendChild(style);

function makeDraggable(box) {
    let offsetX = 0, offsetY = 0, isDragging = false;

    function startDragging(e) {
        isDragging = true;
        e.preventDefault();
        document.body.style.overflow = 'hidden';
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        offsetX = clientX - box.getBoundingClientRect().left;
        offsetY = clientY - box.getBoundingClientRect().top;
        document.body.style.cursor = 'grabbing';
    }

    function moveDragging(e) {
        if (!isDragging) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const containerRect = document.querySelector('.container').getBoundingClientRect();
        const left = Math.max(0, Math.min(containerRect.width - box.offsetWidth, clientX - containerRect.left - offsetX));
        const top = Math.max(0, Math.min(containerRect.height - box.offsetHeight, clientY - containerRect.top - offsetY));

        box.style.left = `${left}px`;
        box.style.top = `${top}px`;

        redBoxPositions[box.id] = { left, top };
    }

    function stopDragging() {
        isDragging = false;
        document.body.style.cursor = 'default';
        document.body.style.overflow = '';
    }

    box.addEventListener('mousedown', startDragging);
    box.addEventListener('touchstart', startDragging, { passive: false });

    document.addEventListener('mousemove', moveDragging);
    document.addEventListener('touchmove', moveDragging, { passive: false });

    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);
}

startCamera();
makeDraggable(redBox1);
makeDraggable(redBox2);