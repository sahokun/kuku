
function showTable() {
  showScreen('table-screen');
  renderAllTable();
}

function renderAllTable() {
  const container = document.getElementById('table-content');
  container.innerHTML = '';

  for (let dan = 1; dan <= 9; dan++) {
    const tableData = kukuData.filter(d => d.a === dan);

    const section = document.createElement('div');
    section.className = 'table-dan-section';

    const title = document.createElement('div');
    title.className = 'table-dan-title';
    title.innerHTML = `
      <span>${dan}のだん</span>
      <button class="btn btn-secondary play-dan-btn" onclick="playDan(${dan})">🔊</button>
    `;

    section.appendChild(title);

    tableData.forEach((data, index) => {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.id = `table-row-${dan}-${index}`;
      row.onclick = () => playTableRow(data, dan, index);

      const left = document.createElement('span');
      left.className = 'table-row-left';
      left.textContent = `${data.a} × ${data.b} =`;

      const right = document.createElement('span');
      right.className = 'table-row-right';
      right.textContent = data.a * data.b;

      const reading = document.createElement('span');
      reading.className = 'table-row-reading';
      reading.textContent = data.q_read + data.a_read;

      row.appendChild(left);
      row.appendChild(right);
      row.appendChild(reading);
      section.appendChild(row);
    });

    container.appendChild(section);
  }
}

function playTableRow(data, dan, rowIndex) {
  stopTablePlayback();

  // ハイライト
  const row = document.getElementById(`table-row-${dan}-${rowIndex}`);
  if (row) {
    row.classList.add('playing');
    setTimeout(() => row.classList.remove('playing'), 2000);
  }

  speak(getFullSpeak(data));
}

function playDan(dan) {
  if (isPlayingTable) {
    stopTablePlayback();
    return;
  }

  isPlayingTable = true;
  tablePlaybackIndex = 0;
  tablePlaybackData = kukuData.filter(d => d.a === dan).map((data, index) => ({
    data: data,
    dan: dan,
    index: index
  }));

  playNextTableRow();
}

function playNextTableRow() {
  if (!isPlayingTable || tablePlaybackIndex >= tablePlaybackData.length) {
    stopTablePlayback();
    return;
  }

  const item = tablePlaybackData[tablePlaybackIndex];
  const row = document.getElementById(`table-row-${item.dan}-${item.index}`);

  // 全ての行のハイライトを削除
  document.querySelectorAll('.table-row').forEach(r => r.classList.remove('playing'));

  // 現在の行をハイライト
  if (row) {
    row.classList.add('playing');
  }

  speak(getFullSpeak(item.data));

  tablePlaybackIndex++;
  setTimeout(() => playNextTableRow(), 2000);
}

function stopTablePlayback() {
  isPlayingTable = false;
  tablePlaybackIndex = 0;
  tablePlaybackData = [];
  document.querySelectorAll('.table-row').forEach(r => r.classList.remove('playing'));
}

// 初期化
initVoice();

