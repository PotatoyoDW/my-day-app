/**
 * スケジュール・タスク管理アプリ GAS Web API
 * Last deployed: 2026-04-23
 *
 * 【デプロイ手順】
 * 1. スプレッドシートを開く → 拡張機能 > Apps Script
 * 2. 左の「+」からファイルを追加 → 名前「api」で作成
 * 3. このコードを全部貼り付けて保存（Ctrl+S）
 * 4. 右上「デプロイ」→「新しいデプロイ」
 * 5. 種類：ウェブアプリ
 *    実行ユーザー：自分（yuka@potatoyo.com）
 *    アクセスできるユーザー：全員
 * 6. 「デプロイ」→ 表示されたURLをコピーしてClaudeに教える
 */

// ============================================================
// 設定
// ============================================================

const SPREADSHEET_ID = '1wpsNW6DgXPJP-DfUZfdvJ2d0oahBfNeMVcWpWwRO044';

const SHEET = {
  DAILY_LOG     : '①日次ログ',
  TASK_LOG      : '②タスクログ',
  TEMPLATES     : '③タスクテンプレート',
  HABITS        : '④習慣トラッカー',
  GOALS         : '⑤ゴール',
  FOOD_PRESETS  : '⑦プリセット食材',
  FOOD_LOG      : '⑧食事ログ'
};

// Claude API キー（スクリプトプロパティから取得）
// 設定方法: Apps Script エディタ → プロジェクトの設定 → スクリプトプロパティ
//           プロパティ名「CLAUDE_API_KEY」、値「sk-ant-...」で追加
function getClaudeApiKey() {
  return PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
}

// ============================================================
// 【一度だけ実行】外部リクエスト権限の付与
// Apps Script エディタでこの関数を選んで▶実行 → 「許可」を押すだけでOK
// 実行後はこの関数は使わないので削除しても構いません
// ============================================================
function grantExternalRequestPermission() {
  UrlFetchApp.fetch('https://www.google.com');
  Logger.log('✅ 外部リクエスト権限の付与が完了しました！');
}

// ============================================================
// エントリーポイント
// ============================================================

function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;
    switch (action) {
      case 'getTemplates':    result = getTemplates(e.parameter);    break;
      case 'getDailyLog':     result = getDailyLog(e.parameter);     break;
      case 'getHabits':       result = getHabits(e.parameter);       break;
      case 'getGoals':        result = getGoals();                   break;
      case 'getTaskAnalysis': result = getTaskAnalysis(e.parameter); break;
      case 'getWeeklyContext':result = getWeeklyContext();           break;
      case 'getHabitStreak':  result = getHabitStreak(e.parameter); break;
      case 'getTodayTasks':   result = getTodayTasks(e.parameter);  break;
      case 'getMealPresets':  result = getMealPresets();             break;
      default: result = { error: 'Unknown action: ' + action };
    }
    return respond(result);
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;
    switch (action) {
      case 'saveDailyLog':   result = saveDailyLog(data);   break;
      case 'saveTaskLog':    result = saveTaskLog(data);    break;
      case 'saveHabits':     result = saveHabits(data);     break;
      case 'updateGoal':     result = updateGoal(data);     break;
      case 'saveTodayTasks': result = saveTodayTasks(data); break;
      case 'analyzeMeals':   result = analyzeMeals(data);   break;
      case 'saveMealLog':    result = saveMealLog(data);    break;
      default: result = { error: 'Unknown action: ' + action };
    }
    return respond(result);
  } catch (err) {
    return respond({ error: err.message });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ヘルパー関数
// ============================================================

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

// シートの全データをオブジェクト配列に変換
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1)
    .filter(row => row[0] !== '')  // 空行を除外
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

// 日付を yyyy-MM-dd 形式の文字列に統一
function toDateStr(val) {
  if (!val) return '';
  try {
    return Utilities.formatDate(new Date(val), 'Asia/Tokyo', 'yyyy-MM-dd');
  } catch(e) {
    return String(val).substring(0, 10);
  }
}

// 今日の日付文字列
function today() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
}

// ============================================================
// GET: タスクテンプレート取得
// dayType を指定すると、その日タイプ＋全日タイプのタスクを返す
// ============================================================

function getTemplates(params) {
  const dayType = params.dayType || '';
  const sheet = getSheet(SHEET.TEMPLATES);
  const tasks = sheetToObjects(sheet);

  const filtered = tasks.filter(task => {
    if (!task['タスクID']) return false;
    const targets = task['対象日タイプ'].toString().split(',').map(s => s.trim());
    return targets.includes('全日タイプ') || targets.includes(dayType);
  });

  // ブロック → 順番 でソート
  filtered.sort((a, b) => {
    if (a['ブロック'] < b['ブロック']) return -1;
    if (a['ブロック'] > b['ブロック']) return 1;
    return Number(a['順番']) - Number(b['順番']);
  });

  return { tasks: filtered, dayType: dayType, count: filtered.length };
}

// ============================================================
// GET: 日次ログ取得（指定日 or 今日）
// ============================================================

function getDailyLog(params) {
  const date = params.date || today();
  const sheet = getSheet(SHEET.DAILY_LOG);
  const logs = sheetToObjects(sheet);
  const log = logs.find(row => toDateStr(row['日付']) === date) || null;
  return { date: date, log: log };
}

// ============================================================
// POST: 日次ログ保存・更新
// ============================================================

function saveDailyLog(data) {
  const sheet = getSheet(SHEET.DAILY_LOG);
  const allData = sheet.getDataRange().getValues();
  const date = data.date || today();

  // 既存行を検索
  let targetRow = -1;
  for (let i = 1; i < allData.length; i++) {
    if (toDateStr(allData[i][0]) === date) { targetRow = i + 1; break; }
  }

  const row = [
    data.date        || '',
    data.dayOfWeek   || '',
    data.dayType     || '',
    data.wakeTime    || '',
    data.weight      || '',
    data.mealPrep    || '',
    data.wentOut     || '',
    data.journal     || '',
    data.rating      || '',
    data.notes       || ''
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    return { status: 'updated', date: date };
  } else {
    sheet.appendRow(row);
    return { status: 'created', date: date };
  }
}

// ============================================================
// POST: タスクログ保存（開始・終了時刻つき）
// ============================================================

function saveTaskLog(data) {
  const sheet = getSheet(SHEET.TASK_LOG);
  const newRow = sheet.getLastRow() + 1;

  const row = [
    data.date              || today(),
    data.dayType           || '',
    data.taskId            || '',
    data.taskName          || '',
    data.category          || '',
    data.startTime         || '',
    data.endTime           || '',
    '',  // 実績時間(分)：数式で計算
    data.estimatedMinutes  || '',
    '',  // 差分(分)：数式で計算
    data.completed ? '✓' : '',
    data.notes             || ''
  ];

  sheet.getRange(newRow, 1, 1, row.length).setValues([row]);

  // 実績時間と差分の数式を設定
  if (data.startTime && data.endTime) {
    sheet.getRange(newRow, 8).setFormula(
      `=IF(AND(F${newRow}<>"",G${newRow}<>""),ROUND((TIMEVALUE(G${newRow})-TIMEVALUE(F${newRow}))*1440,0),"")`
    );
  }
  sheet.getRange(newRow, 10).setFormula(
    `=IF(AND(H${newRow}<>"",I${newRow}<>""),H${newRow}-I${newRow},"")`
  );

  return { status: 'saved', row: newRow };
}

// ============================================================
// GET: 習慣トラッカー取得（指定日 or 今日）
// ============================================================

function getHabits(params) {
  const date = params.date || today();
  const sheet = getSheet(SHEET.HABITS);
  const habits = sheetToObjects(sheet);
  const record = habits.find(row => toDateStr(row['日付']) === date) || null;
  return { date: date, habits: record };
}

// ============================================================
// POST: 習慣トラッカー保存・更新
// ============================================================

function saveHabits(data) {
  const sheet = getSheet(SHEET.HABITS);
  const allData = sheet.getDataRange().getValues();
  const date = data.date || today();

  let targetRow = -1;
  for (let i = 1; i < allData.length; i++) {
    if (toDateStr(allData[i][0]) === date) { targetRow = i + 1; break; }
  }

  const h = data.habits || {};
  const row = [
    date,
    data.dayOfWeek  || '',
    data.dayType    || '',
    h.aerobike             ? '✓' : '',
    h.gym                  ? '✓' : '',
    h.supplement_morning   ? '✓' : '',
    h.supplement_evening   ? '✓' : '',
    h.novel                ? '✓' : '',
    h.study                ? '✓' : '',
    '',  // 達成数：数式
    data.memo || ''
  ];

  let rowNum;
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    rowNum = targetRow;
  } else {
    sheet.appendRow(row);
    rowNum = sheet.getLastRow();
  }
  sheet.getRange(rowNum, 10).setFormula(`=COUNTIF(D${rowNum}:I${rowNum},"✓")`);

  return { status: targetRow > 0 ? 'updated' : 'created', date: date };
}

// ============================================================
// GET: ゴール（中長期目標）取得
// ============================================================

function getGoals() {
  const sheet = getSheet(SHEET.GOALS);
  const goals = sheetToObjects(sheet);
  const active = goals.filter(g => g['目標ID'] && g['ステータス'] !== '中断');
  return { goals: active, total: goals.length };
}

// ============================================================
// POST: ゴール進捗を更新
// ============================================================

function updateGoal(data) {
  const sheet = getSheet(SHEET.GOALS);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol      = headers.indexOf('目標ID');
  const currentCol = headers.indexOf('現在値');
  const statusCol  = headers.indexOf('ステータス');

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === data.goalId) {
      if (data.currentValue !== undefined) {
        sheet.getRange(i + 1, currentCol + 1).setValue(data.currentValue);
      }
      if (data.status) {
        sheet.getRange(i + 1, statusCol + 1).setValue(data.status);
      }
      return { status: 'updated', goalId: data.goalId };
    }
  }
  return { status: 'not_found', goalId: data.goalId };
}

// ============================================================
// GET: タスク実績分析（見積もり vs 実績）
// 10件以上溜まると、見積もり修正の提案コメントが出る
// ============================================================

function getTaskAnalysis(params) {
  const taskName = params.taskName;
  if (!taskName) return { error: 'taskName が必要です' };

  const sheet = getSheet(SHEET.TASK_LOG);
  const logs = sheetToObjects(sheet);

  const records = logs.filter(row =>
    row['タスク名'] === taskName &&
    row['完了'] === '✓' &&
    Number(row['実績時間(分)']) > 0 &&
    Number(row['見積もり時間(分)']) > 0
  );

  if (records.length === 0) {
    return { taskName: taskName, count: 0, message: 'まだ実績データがありません' };
  }

  const actuals    = records.map(r => Number(r['実績時間(分)']));
  const estimated  = Number(records[0]['見積もり時間(分)']);
  const avg        = Math.round(actuals.reduce((a, b) => a + b, 0) / actuals.length);
  const max        = Math.max(...actuals);
  const min        = Math.min(...actuals);
  const overCount  = actuals.filter(a => a > estimated).length;
  const overRate   = Math.round(overCount / records.length * 100);

  // 実績が見積もりの1.2倍以上かつ5件以上で提案
  let suggestion = null;
  if (records.length >= 5 && avg > estimated * 1.2) {
    suggestion = `直近${records.length}回の平均は${avg}分でした（見積もり${estimated}分）。見積もりを${avg}分に更新しませんか？`;
  }

  return {
    taskName        : taskName,
    count           : records.length,
    estimatedMinutes: estimated,
    avgActualMinutes: avg,
    maxMinutes      : max,
    minMinutes      : min,
    overEstimateRate: overRate,
    suggestion      : suggestion
  };
}

// ============================================================
// GET: 週次コンテキスト（お惣菜提案・作り置き確認用）
// 先週末の外出状況と作り置き実施状況を返す
// ============================================================

function getWeeklyContext() {
  const now = new Date();
  const dow = now.getDay(); // 0=日,1=月,...,6=土

  // 直前の土曜・日曜を算出
  const lastSun = new Date(now); lastSun.setDate(now.getDate() - dow);
  const lastSat = new Date(lastSun); lastSat.setDate(lastSun.getDate() - 1);
  const satStr  = toDateStr(lastSat);
  const sunStr  = toDateStr(lastSun);

  const sheet = getSheet(SHEET.DAILY_LOG);
  const logs  = sheetToObjects(sheet);

  const satLog = logs.find(r => toDateStr(r['日付']) === satStr);
  const sunLog = logs.find(r => toDateStr(r['日付']) === sunStr);

  const satOut      = !!(satLog && satLog['外出フラグ'] === '✓');
  const sunOut      = !!(sunLog && sunLog['外出フラグ'] === '✓');
  const mealPrep    = !!(
    (satLog && satLog['作り置き実施'] === '✓') ||
    (sunLog && sunLog['作り置き実施'] === '✓')
  );

  let suggestion = null;
  if (satOut && sunOut && !mealPrep) {
    suggestion = '先週末は土日とも外出されていたため、作り置きができていない可能性があります。今週は惣菜や外食を上手に活用して、無理に自炊しなくて大丈夫ですよ！';
  } else if ((satOut || sunOut) && !mealPrep) {
    suggestion = '先週末は外出日があったので、作り置きが少ないかもしれません。今週は手を抜ける日を作っておきましょう。お惣菜を買ってくる日を決めてしまうのも手ですよ。';
  }

  return {
    lastSaturday : satStr,
    lastSunday   : sunStr,
    saturdayOut  : satOut,
    sundayOut    : sunOut,
    mealPrepDone : mealPrep,
    suggestion   : suggestion
  };
}

// ============================================================
// GET: 習慣ストリーク（連続達成日数）
// habit パラメータ例: aerobike / gym / novel / study / supplement_morning / supplement_evening
// ============================================================

function getHabitStreak(params) {
  const habitKey = params.habit;
  const colMap = {
    aerobike           : 'エアロバイク',
    gym                : 'ジム',
    supplement_morning : 'サプリ（朝）',
    supplement_evening : 'サプリ（夜）',
    novel              : '小説',
    study              : 'IT資格勉強'
  };
  const colName = colMap[habitKey];
  if (!colName) return { error: '習慣名が不正です: ' + habitKey };

  const sheet  = getSheet(SHEET.HABITS);
  const logs   = sheetToObjects(sheet);

  // 日付の新しい順に並べ替え
  const sorted = logs
    .filter(r => r['日付'])
    .sort((a, b) => new Date(b['日付']) - new Date(a['日付']));

  let streak = 0;
  for (const row of sorted) {
    const val = row[colName];
    if (val === '✓' || val === '△（少しだけ）') {
      streak++;
    } else {
      break;
    }
  }

  return { habit: habitKey, label: colName, streak: streak };
}

// ============================================================
// POST: 今日のタスク保存（Claudeプランの取り込み）
// ============================================================

function saveTodayTasks(data) {
  const sheet = getSheet('⑥今日のタスク');
  const date = data.date || today();
  const tasks = data.tasks || [];

  // ヘッダーがなければ追加
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['日付','日タイプ','順番','ブロック','タスク名','見積もり時間(分)','メモ','完了','Claudeコメント']);
  }

  // 同日の既存データを削除
  if (data.clearExisting) {
    const allData = sheet.getDataRange().getValues();
    for (let i = allData.length - 1; i >= 1; i--) {
      if (toDateStr(allData[i][0]) === date) {
        sheet.deleteRow(i + 1);
      }
    }
  }

  // 新規データを追加
  const rows = tasks.map((t, i) => [
    date,
    data.dayType || '',
    t.order || (i + 1),
    t.block || '',
    t.taskName || '',
    t.estimatedMinutes || '',
    t.memo || '',
    '',
    t.claudeComment || ''
  ]);

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  }

  return { status: 'saved', date: date, count: rows.length };
}

// ============================================================
// GET: 今日のタスク取得（指定日 or 今日）
// ============================================================

function getTodayTasks(params) {
  const date = params.date || today();
  const sheet = getSheet('⑥今日のタスク');
  if (sheet.getLastRow() === 0) return { date: date, tasks: [], count: 0 };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const tasks = allData.slice(1)
    .filter(row => row[0] !== '' && toDateStr(row[0]) === date)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

  return { date: date, tasks: tasks, count: tasks.length };
}


// ============================================================
// GET: プリセット食材一覧を取得
// ============================================================

function getMealPresets() {
  const sheet = getSheet(SHEET.FOOD_PRESETS);
  if (!sheet) return { presets: [], error: '⑦プリセット食材シートが見つかりません' };

  const presets = sheetToObjects(sheet).map(row => ({
    id          : row['プリセットID'],
    name        : row['表示名'],
    category    : row['カテゴリ'],
    ingredients : row['材料詳細'],
    defaultGrams: Number(row['デフォルトg']) || 0,
    note        : row['備考'] || ''
  }));

  return { presets: presets, count: presets.length };
}


// ============================================================
// POST: 食事内容をClaudeで分析してカロリー・PFCを返す
// リクエスト例:
// {
//   action: 'analyzeMeals',
//   date: '2026-04-28',
//   breakfast: '納豆ご飯、味噌汁',
//   lunch: 'いつものお弁当',
//   dinner: '',
//   snack: 'プロテイン（水割り）'
// }
// ============================================================

function analyzeMeals(data) {
  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return { error: 'Claude APIキーが設定されていません。スクリプトプロパティに CLAUDE_API_KEY を追加してください。' };
  }

  // 入力された食事テキストをまとめる
  const breakfast = (data.breakfast || '').trim();
  const lunch     = (data.lunch     || '').trim();
  const dinner    = (data.dinner    || '').trim();
  const snack     = (data.snack     || '').trim();

  // 何も入力されていなければエラー
  if (!breakfast && !lunch && !dinner && !snack) {
    return { error: '食事が何も入力されていません' };
  }

  // 使われているプリセット名を探して定義文を組み立てる
  const allText = [breakfast, lunch, dinner, snack].join(' ');
  const presetDefs = buildPresetDefinitions(allText);

  // Claudeへ渡すプロンプトを組み立てる
  const userMessage = buildMealPrompt(breakfast, lunch, dinner, snack, presetDefs);

  // Claude API を呼び出す
  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'Content-Type'      : 'application/json',
        'x-api-key'         : apiKey,
        'anthropic-version' : '2023-06-01'
      },
      payload: JSON.stringify({
        model      : 'claude-haiku-4-5-20251001',  // 高速・低コストなHaikuを使用
        max_tokens : 2000,
        system     : MEAL_SYSTEM_PROMPT,
        messages   : [{ role: 'user', content: userMessage }]
      }),
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    const body   = JSON.parse(response.getContentText());

    if (status !== 200) {
      return { error: 'Claude API エラー: ' + (body.error?.message || status) };
    }

    // レスポンスのテキストからJSONを取り出す
    const rawText   = body.content[0].text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { error: 'AIの返答からJSONを取り出せませんでした', raw: rawText };
    }

    const analysis = JSON.parse(jsonMatch[0]);
    analysis.calculatedAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss");
    analysis.isPartial    = !breakfast || !lunch || !dinner;  // 未記録の食事があるかどうか

    return { status: 'ok', analysis: analysis };

  } catch (err) {
    return { error: 'API呼び出し中にエラーが発生しました: ' + err.message };
  }
}


// ============================================================
// POST: 食事ログをスプレッドシートに保存
// （Firebaseへの保存とは別に、集計・統計用に記録しておく）
// ============================================================

function saveMealLog(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(SHEET.FOOD_LOG);

  // シートがなければ自動作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET.FOOD_LOG);
    const headers = [
      '日付', '朝ごはん', '昼ごはん', '夕ごはん', '間食・メモ',
      '合計kcal', 'タンパク質(g)', '脂質(g)', '炭水化物(g)',
      'P比率(%)', 'F比率(%)', 'C比率(%)',
      'フィードバック', '部分記録', '信頼度', '保存日時'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#E57373').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 110);
    [2,3,4,5].forEach(c => sheet.setColumnWidth(c, 200));
    [6,7,8,9,10,11,12].forEach(c => sheet.setColumnWidth(c, 90));
    sheet.setColumnWidth(13, 280);
    sheet.setColumnWidth(14, 80);
    sheet.setColumnWidth(15, 70);
    sheet.setColumnWidth(16, 150);
  }

  const date = data.date || today();
  const a    = data.analysis || {};
  const pfc  = a.pfc         || {};
  const pfcR = a.pfcRatio    || {};

  // 同じ日付の既存行を上書きする
  const allData = sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
  let targetRow = -1;
  for (let i = 1; i < allData.length; i++) {
    if (toDateStr(allData[i][0]) === date) { targetRow = i + 1; break; }
  }

  const row = [
    date,
    data.breakfast || '',
    data.lunch     || '',
    data.dinner    || '',
    data.snack     || '',
    a.totalCalories  || '',
    pfc.protein      || '',
    pfc.fat          || '',
    pfc.carbs        || '',
    pfcR.protein     || '',
    pfcR.fat         || '',
    pfcR.carbs       || '',
    a.feedback       || '',
    a.isPartial ? '部分' : '全日',
    a.confidence     || '',
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    return { status: 'updated', date: date };
  } else {
    sheet.appendRow(row);
    return { status: 'created', date: date };
  }
}


// ============================================================
// 内部ヘルパー: プリセット定義文を組み立てる
// 食事テキストの中にプリセット名が含まれていたら定義を付ける
// ============================================================

function buildPresetDefinitions(mealText) {
  const sheet = getSheet(SHEET.FOOD_PRESETS);
  if (!sheet) return '（プリセット情報なし）';

  const presets = sheetToObjects(sheet);
  const used = presets.filter(p => p['表示名'] && mealText.includes(p['表示名']));

  if (used.length === 0) return '（プリセット使用なし）';

  return used.map(p =>
    `・「${p['表示名']}」の詳細材料: ${p['材料詳細']}`
  ).join('\n');
}


// ============================================================
// 内部ヘルパー: Claude へのプロンプトを組み立てる
// ============================================================

function buildMealPrompt(breakfast, lunch, dinner, snack, presetDefs) {
  const lines = [];
  if (breakfast) lines.push(`【朝ごはん】\n${breakfast}`);
  if (lunch)     lines.push(`【昼ごはん】\n${lunch}`);
  if (dinner)    lines.push(`【夕ごはん】\n${dinner}`);
  if (snack)     lines.push(`【間食・メモ】\n${snack}`);
  lines.push(`\n【プリセット定義（「いつもの〇〇」の正確な材料）】\n${presetDefs}`);

  return lines.join('\n\n') + `

以下のJSON形式だけで回答してください（説明文は不要です）:
{
  "totalCalories": 合計kcal（数値）,
  "pfc": { "protein": gの数値, "fat": gの数値, "carbs": gの数値 },
  "pfcRatio": { "protein": %の数値, "fat": %の数値, "carbs": %の数値 },
  "meals": [
    {
      "type": "breakfast または lunch または dinner または snack",
      "calories": kcal（数値）,
      "pfc": { "protein": g, "fat": g, "carbs": g },
      "items": [
        { "name": "食品名", "amount": "量の表記", "calories": kcal, "protein": g, "fat": g, "carbs": g }
      ]
    }
  ],
  "feedback": "50〜80文字、責めず前向きなトーン、絵文字1〜2個",
  "confidence": "high または medium または low"
}`;
}


// ============================================================
// 定数: Claude へのシステムプロンプト
// ============================================================

const MEAL_SYSTEM_PROMPT = `あなたは栄養計算の専門家です。
ユーザーが記録した食事内容から、カロリーとPFC（タンパク質・脂質・炭水化物）を計算してください。

【計算ルール】
1. 文部科学省「日本食品標準成分表2020年版」の値を基準とする
2. 量が書かれていない場合は、日本の一般的な1人前の量で計算する
3. 「いつもの〇〇」という表現が出た場合は、ユーザーメッセージ内の【プリセット定義】の材料から計算する
4. 自炊・作り置き料理は材料とグラム数から計算する。炒め料理は水分20%減、煮込みは10〜30%減を考慮する
5. 「大盛り」など量の修飾語がある場合は標準の1.3〜1.5倍で計算する
6. 不確実な場合は過小評価より過大評価側に倒す（摂取カロリーを把握することが目的のため）
7. 必ずJSON形式のみを返すこと。説明文・前置き・コードブロック記号は不要

【重要：食品の重量の解釈ルール】
- 「〇〇・炊き上がり150g（材料の説明...）」と書かれている場合、カロリーは必ず「炊き上がり150g」のみで計算する。括弧内の材料はレシピの説明であり、別の食品として加算しない。
- 「調理後〇〇g」「炒め後〇〇g」「蒸した後〇〇g」なども同様。括弧外に記載された完成重量だけをカロリー計算に使う。
- 食品名の後の括弧（）の中に生材料の重量が書いてあっても、それを合算してカロリーを計算してはいけない。あくまで括弧外の摂取量が基準。
- 炊き上がりのご飯は「炊いた白米」の栄養価（100gあたり168kcal）を基準にし、マンナンヒカリ入りの場合はさらに10〜15%低く計算する。
- 例：「雑穀米・炊き上がり150g（白米150g+マンナンヒカリ1袋+雑穀大さじ2を炊飯、炊き上がり約360g）」→ 炊き上がり150gとして計算（約230〜250kcal）。白米150g（生）として計算しない（537kcalになるため誤り）。`;
