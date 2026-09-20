// 金沢市ごみ分別チャレンジ 用スクリプト
// 回答時には詳細分類（例：燃やさないごみ（金属））を表示
    let quizData = [];
    let currentIndex = 0;
    let score = 0;
    let timer;
    let questionTimeout;
    let timeLeft = 60;
    let answeredList = [];
    let gameEnded = false;
    const choices = ['燃やすごみ', '燃やさないごみ', '資源ごみ', '粗大ごみ', 'その他'];

    function startGame() {
      document.querySelector('button.start').style.display = 'none';
      document.getElementById('game').style.display = 'block';
      document.getElementById('title').style.display = 'none';
      document.getElementById('intro').style.display = 'none';
      document.querySelector('.note').style.display = 'none';
      document.getElementById('hints').style.display = 'none';
      clearInterval(timer);
      clearTimeout(questionTimeout);
      currentIndex = 0;
      score = 0;
      timeLeft = 60;
      answeredList = [];
      gameEnded = false;

      document.getElementById('timer').innerText = `残り時間: ${timeLeft}秒`;

      fetchCSVData().then(data => {
        if (!data.length) throw new Error('分別データを読み込めませんでした。');
        quizData = shuffle(data).slice(0, 100);
        showQuestion();
        timer = setInterval(() => {
          timeLeft--;
          const timerEl = document.getElementById('timer');
          if (timerEl) timerEl.innerText = `残り時間: ${Math.max(timeLeft, 0)}秒`;
          if (timeLeft <= 0) {
            clearInterval(timer);
            endGame();
          }
        }, 1000);
      }).catch(error => {
        console.error('分別データの読み込みに失敗しました:', error);
        showLoadError();
      });
    }

    function fetchCSVData() {
      const resourceId = '4da14709-f5c6-44dc-afc8-f6e9a07656e1';
      const apiUrl = `https://catalog-data.city.kanazawa.ishikawa.jp/api/3/action/datastore_search?resource_id=${resourceId}&limit=5000`;
      const csvUrl = 'https://catalog-data.city.kanazawa.ishikawa.jp/dataset/ca0f0586-51bc-419c-8a1f-8ce432bf3fd9/resource/4da14709-f5c6-44dc-afc8-f6e9a07656e1/download/bunbetsu2026.csv';

      // まずCKAN Datastore API(JSON)を利用する。
      // ダウンロードCSVは環境によって直接取得に失敗するため、APIを優先する。
      return fetch(apiUrl)
        .then(res => {
          if (!res.ok) throw new Error(`APIの取得に失敗しました (${res.status})`);
          return res.json();
        })
        .then(json => {
          if (!json.success || !json.result || !Array.isArray(json.result.records)) {
            throw new Error('APIの応答形式が不正です');
          }
          return mapRows(json.result.records);
        })
        .catch(apiError => {
          console.warn('Datastore APIから取得できないためCSVへフォールバックします:', apiError);

          return fetch(csvUrl)
            .then(res => {
              if (!res.ok) throw new Error(`CSVの取得に失敗しました (${res.status})`);
              return res.arrayBuffer();
            })
            .then(buffer => {
              const decoder = new TextDecoder('shift-jis');
              const text = decoder.decode(buffer);
              const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
              }).data;
              return mapRows(parsed);
            });
        });
    }

    function mapRows(rows) {
      return rows
        .map(row => {
          const normalized = {};
          Object.entries(row).forEach(([key, value]) => {
            normalized[key.replace(/[\s\u3000]+/g, '')] = value;
          });
          return normalized;
        })
        .filter(row => row['品目'] && row['ごみの種類'])
        .map(row => ({
          item: String(row['品目']).trim(),
          category: simplifyCategory(String(row['ごみの種類'])),
          fullCategory: String(row['ごみの種類']).trim()
        }));
    }

    function simplifyCategory(category) {
      if (!category) return 'その他';
      const normalized = category.replace(/[\s\u3000]+/g, '').trim();

      // 詳細区分（例：燃やさないごみ（金属））をゲームの5択へまとめる。
      if (normalized.startsWith('燃やさないごみ')) return '燃やさないごみ';
      if (normalized.startsWith('燃やすごみ')) return '燃やすごみ';
      if (normalized.startsWith('資源')) return '資源ごみ';
      if (normalized.includes('粗大ごみ')) return '粗大ごみ';

      // 「市で収集できないもの」など、上記4分類に入らない区分。
      return 'その他';
    }

    function showQuestion() {
      if (gameEnded) return;
      if (currentIndex >= quizData.length) {
        endGame();
        return;
      }
      const q = quizData[currentIndex];
      const questionEl = document.getElementById('question');
      const resultDiv = document.getElementById('result');
      if (!questionEl || !resultDiv) return;
      questionEl.innerText = `「${q.item}」はどのごみ？`;
      resultDiv.innerText = '\u00a0';
      resultDiv.classList.remove('correct', 'incorrect');
      renderChoiceButtons();
    }

    function renderChoiceButtons() {
      const choicesEl = document.getElementById('choices');
      if (!choicesEl) return;

      // iOS Safariは同じbutton要素を再利用すると、前回のタップ表示が
      // 残ることがある。毎問ボタンを作り直し、擬似クラス状態を引き継がない。
      choicesEl.replaceChildren();
      choices.forEach(choice => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = choice;
        button.addEventListener('click', event => {
          answer(choice, event.currentTarget);
        });
        choicesEl.appendChild(button);
      });
    }

    function answer(choice, button) {
      if (gameEnded) return;
      const current = quizData[currentIndex];
      if (!current) return;
      const correct = current.category;
      const full = current.fullCategory || correct;
      const isCorrect = (choice === correct);
      const resultDiv = document.getElementById('result');
      document.querySelectorAll('.choices button').forEach(btn => btn.disabled = true);
      if (button) button.blur();

      if (isCorrect) {
        score++;
        resultDiv.innerText = `\u2728正解！「${full}」です\u2728`;
        resultDiv.classList.add('correct');
      } else {
        resultDiv.innerText = `\u274C不正解。正しくは「${full}」です。`;
        resultDiv.classList.add('incorrect');
      }
      answeredList.push({ item: current.item, correct: correct, full: full, user: choice, result: isCorrect });
      currentIndex++;
      questionTimeout = setTimeout(showQuestion, 500);
    }

    function endGame() {
      if (gameEnded) return;
      gameEnded = true;
      clearInterval(timer);
      clearTimeout(questionTimeout);

      const total = answeredList.length;
      const accuracy = total ? Math.round((score / total) * 100) : 0;

      let summaryHTML = `
        <h2>ゲーム終了！</h2>
        <p>解答数：${total} 問 ／ 正解数：${score} 問 ／ 正解率：${accuracy}%</p>
        <button class="back-btn" onclick="location.reload()">スタート画面に戻る</button>
        <button class="share-btn" onclick="shareResult(${score}, ${total}, ${accuracy})">結果をSNSでシェア</button>
        <div class="summary">
        <table>
          <tr><th>#</th><th>品名</th><th>あなたの回答</th><th>正解（詳細）</th><th>結果</th></tr>
      `;

      answeredList.forEach((entry, i) => {
        summaryHTML += `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHTML(entry.item)}</td>
            <td>${escapeHTML(entry.user)}</td>
            <td>${escapeHTML(entry.full)}</td>
            <td>${entry.result ? '〇' : '×'}</td>
          </tr>
        `;
      });

      summaryHTML += '</table></div>';
      document.getElementById('game').innerHTML = summaryHTML;
    }

    function showLoadError() {
      gameEnded = true;
      clearInterval(timer);
      clearTimeout(questionTimeout);
      document.getElementById('game').innerHTML = `
        <h2>データを読み込めませんでした</h2>
        <p>金沢市の分別データを取得できませんでした。時間をおいてもう一度お試しください。</p>
        <button class="back-btn" onclick="location.reload()">スタート画面に戻る</button>
      `;
    }

    function escapeHTML(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function shareResult(score, total, accuracy) {
      const wrongs = answeredList.filter(e => !e.result);
      let detail = wrongs.map(e => `「${e.item}」は${e.full}`).join('、');
      if (detail.length > 100) {
        detail = detail.substring(0, 97) + '…';
      }
      const text = `金沢市ごみ分別チャレンジ\n正解数：${score}/${total}問（正解率：${accuracy}%）\n${detail ? '金沢市では ' + detail + ' です。\n' : ''}#ゴミチャレ金沢`;
      const url = location.href;
      const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(tweet, '_blank');
    }

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
