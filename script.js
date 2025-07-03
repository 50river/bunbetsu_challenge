// 金沢市ごみ分別チャレンジ 用スクリプト
// 回答時には詳細分類（例：燃やさないごみ（金属））を表示
    let quizData = [];
    let currentIndex = 0;
    let score = 0;
    let timer;
    let timeLeft = 60;
    let answeredList = [];

    function startGame() {
      document.querySelector('button.start').style.display = 'none';
      document.getElementById('game').style.display = 'block';
      document.getElementById('title').style.display = 'none';
      document.getElementById('intro').style.display = 'none';
      document.querySelector('.note').style.display = 'none';
      currentIndex = 0;
      score = 0;
      timeLeft = 60;
      answeredList = [];

      fetchCSVData().then(data => {
        quizData = shuffle(data).slice(0, 100);
        showQuestion();
        timer = setInterval(() => {
          timeLeft--;
          document.getElementById('timer').innerText = `残り時間: ${timeLeft}秒`;
          if (timeLeft <= 0) {
            clearInterval(timer);
            endGame();
          }
        }, 1000);
      });
    }

    function fetchCSVData() {
      const url = 'https://catalog-data.city.kanazawa.ishikawa.jp/dataset/ca0f0586-51bc-419c-8a1f-8ce432bf3fd9/resource/4da14709-f5c6-44dc-afc8-f6e9a07656e1/download/bunbetsujiten_r7.4.csv';
      return fetch(url)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          const decoder = new TextDecoder('shift-jis');
          const text = decoder.decode(buffer);
          const parsed = Papa.parse(text, { header: true }).data;
          return parsed
            .filter(row => row['品　名'] && row['ごみの種類'])
            .map(row => ({
              item: row['品　名'],
              category: simplifyCategory(row['ごみの種類']),
              fullCategory: row['ごみの種類']
            }));
        });
    }

    function simplifyCategory(category) {
      if (!category) return 'その他';
      if (category.includes('燃やす')) return '燃やすごみ';
      if (category.includes('燃やさない')) return '燃やさないごみ';
      if (category.includes('資源')) return '資源ごみ';
      if (category.includes('粗大')) return '粗大ごみ';
      return 'その他';
    }

    function showQuestion() {
      if (currentIndex >= quizData.length) return endGame();
      const q = quizData[currentIndex];
      document.getElementById('question').innerText = `「${q.item}」はどのごみ？`;
      const resultDiv = document.getElementById('result');
      resultDiv.innerText = '\u00a0';
      resultDiv.classList.remove('correct', 'incorrect');
      document.querySelectorAll('.choices button').forEach(btn => btn.disabled = false);
    }

    function answer(choice) {
      const current = quizData[currentIndex];
      const correct = current.category;
      const full = current.fullCategory || correct;
      const isCorrect = (choice === correct);
      const resultDiv = document.getElementById('result');
      document.querySelectorAll('.choices button').forEach(btn => btn.disabled = true);

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
      setTimeout(showQuestion, 500);
    }

    function endGame() {
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
            <td>${entry.item}</td>
            <td>${entry.user}</td>
            <td>${entry.full}</td>
            <td>${entry.result ? '〇' : '×'}</td>
          </tr>
        `;
      });

      summaryHTML += '</table></div>';
      document.getElementById('game').innerHTML = summaryHTML;
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
