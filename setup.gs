/**
 * スケジュール・タスク管理アプリ DB セットアップスクリプト
 *
 * 【使い方】
 * 1. スプレッドシートを開く
 * 2. 拡張機能 > Apps Script を開く
 * 3. このコードをすべて貼り付ける（既存コードは削除してOK）
 * 4. 上部の「実行」ボタン（▶）を押す → 関数「setupAll」を選択して実行
 * 5. 権限の確認ダイアログが出たら「許可」を選択
 * 6. スプレッドシートに戻ると5つのシートができています
 */

function setupAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  setupSheet1_DailyLog(ss);
  setupSheet2_TaskLog(ss);
  setupSheet3_TaskTemplates(ss);
  setupSheet4_HabitTracker(ss);
  setupSheet5_Goals(ss);

  // デフォルトのSheet1を削除（空のまま残っていた場合）
  const defaultSheet = ss.getSheetByName('シート1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);
  const defaultSheet2 = ss.getSheetByName('Sheet1');
  if (defaultSheet2) ss.deleteSheet(defaultSheet2);

  // 日次ログを最初のシートにする
  const dailyLog = ss.getSheetByName('①日次ログ');
  if (dailyLog) ss.setActiveSheet(dailyLog);

  SpreadsheetApp.getUi().alert('✅ セットアップ完了！5つのシートが作成されました。');
}


// ============================================================
// シート① 日次ログ
// ============================================================
function setupSheet1_DailyLog(ss) {
  let sheet = ss.getSheetByName('①日次ログ');
  if (!sheet) sheet = ss.insertSheet('①日次ログ');
  sheet.clear();

  const headers = [
    '日付', '曜日', '日タイプ', '起床時刻', '体重(kg)',
    '作り置き実施', '外出フラグ', 'ジャーナル', '総合評価(1-5)', '備考'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // サンプル行（今日の日付）
  const today = new Date();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayTypes = ['出勤日', '在宅勤務日', '休日（自宅）', '休日（外出）', '出張・研修'];

  sheet.getRange(2, 1).setValue(Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd'));
  sheet.getRange(2, 2).setFormula('=TEXT(A2,"ddd")');
  sheet.getRange(2, 3).setValue('在宅勤務日');

  // 書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 列幅
  sheet.setColumnWidth(1, 110); // 日付
  sheet.setColumnWidth(2, 50);  // 曜日
  sheet.setColumnWidth(3, 130); // 日タイプ
  sheet.setColumnWidth(4, 80);  // 起床時刻
  sheet.setColumnWidth(5, 80);  // 体重
  sheet.setColumnWidth(6, 100); // 作り置き
  sheet.setColumnWidth(7, 80);  // 外出フラグ
  sheet.setColumnWidth(8, 300); // ジャーナル
  sheet.setColumnWidth(9, 120); // 総合評価
  sheet.setColumnWidth(10, 200); // 備考

  // 日タイプのドロップダウン
  const dayTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(dayTypes, true)
    .build();
  sheet.getRange(2, 3, 500, 1).setDataValidation(dayTypeRule);

  // 評価のドロップダウン
  const ratingRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['1', '2', '3', '4', '5'], true)
    .build();
  sheet.getRange(2, 9, 500, 1).setDataValidation(ratingRule);
}


// ============================================================
// シート② タスクログ
// ============================================================
function setupSheet2_TaskLog(ss) {
  let sheet = ss.getSheetByName('②タスクログ');
  if (!sheet) sheet = ss.insertSheet('②タスクログ');
  sheet.clear();

  const headers = [
    '日付', '日タイプ', 'タスクID', 'タスク名', 'カテゴリ',
    '開始時刻', '終了時刻', '実績時間(分)', '見積もり時間(分)', '差分(分)', '完了', '備考'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 実績時間の自動計算式（サンプル）
  // 実際の行に数式を入れるためのガイド
  sheet.getRange(2, 8).setFormula('=IF(AND(F2<>"",G2<>""),ROUND((TIMEVALUE(G2)-TIMEVALUE(F2))*1440,0),"")');
  sheet.getRange(2, 10).setFormula('=IF(AND(H2<>"",I2<>""),H2-I2,"")');

  // 書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#5BA35B').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 列幅
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 130);
  sheet.setColumnWidth(3, 90);
  sheet.setColumnWidth(4, 200);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 80);
  sheet.setColumnWidth(7, 80);
  sheet.setColumnWidth(8, 110);
  sheet.setColumnWidth(9, 120);
  sheet.setColumnWidth(10, 80);
  sheet.setColumnWidth(11, 60);
  sheet.setColumnWidth(12, 200);

  // 差分のカラーコード（超過は赤っぽく、余裕は緑っぽく）
  // ※条件付き書式は後から手動で追加推奨
}


// ============================================================
// シート③ タスクテンプレート
// ============================================================
function setupSheet3_TaskTemplates(ss) {
  let sheet = ss.getSheetByName('③タスクテンプレート');
  if (!sheet) sheet = ss.insertSheet('③タスクテンプレート');
  sheet.clear();

  const headers = [
    'タスクID', 'タスク名', 'カテゴリ', '対象日タイプ', 'ブロック', '順番',
    '見積もり時間(分)', '必須', '備考'
  ];

  // タスクデータ
  const tasks = [
    // ===== 共通・朝のアンカー =====
    ['task_001', '体重を測る',           '健康',      '全日タイプ',                                          '朝', 1,  2,  '',  '起床直後・朝食前'],
    ['task_002', 'ベッドメイク',          '家事',      '全日タイプ',                                          '朝', 2,  5,  '',  ''],
    ['task_003', '洗顔・歯磨き',          '身支度',    '全日タイプ',                                          '朝', 3,  8,  '✓', ''],
    ['task_004', 'スキンケア（朝）',       '身支度',    '全日タイプ',                                          '朝', 4,  5,  '✓', ''],
    ['task_005', 'サプリを飲む（朝）',     '健康',      '全日タイプ',                                          '朝', 5,  2,  '✓', '朝食と一緒に'],
    ['task_006', '朝食の準備',            '食事',      '出勤日,在宅勤務日',                                   '朝', 6,  15, '✓', '作り置きがあれば5分'],
    ['task_007', '朝食を食べる',          '食事',      '全日タイプ',                                          '朝', 7,  20, '✓', ''],
    ['task_008', '食器を洗う（朝）',       '家事',      '全日タイプ',                                          '朝', 8,  10, '✓', ''],

    // ===== 出勤日・朝（追加タスク） =====
    ['task_010', 'お弁当を詰める',        '食事',      '出勤日',                                              '朝', 9,  15, '✓', '前日の作り置きから'],
    ['task_011', '着替え・メイク',         '身支度',    '出勤日',                                              '朝', 10, 15, '✓', ''],
    ['task_012', '持ち物確認',            '身支度',    '出勤日',                                              '朝', 11, 5,  '✓', '鍵・弁当・スマホ・充電器・AppleWatch充電器'],

    // ===== 夏の朝洗濯モード（出勤日・在宅） =====
    ['task_015', '洗濯機を回す（朝）',    '家事',      '出勤日,在宅勤務日',                                   '朝', 5.5, 3, '',  '夏のみ・朝食準備前にセット'],
    ['task_016', '洗濯物を干す（外）',    '家事',      '出勤日,在宅勤務日',                                   '朝', 8.5, 10, '',  '夏のみ・食器洗いの後'],

    // ===== 在宅勤務日・朝（追加タスク） =====
    ['task_020', 'PC起動・業務準備',      '仕事',      '在宅勤務日',                                          '朝', 9,  5,  '✓', ''],

    // ===== 在宅勤務日・昼休憩 =====
    ['task_025', '昼食の準備',            '食事',      '在宅勤務日',                                          '昼', 1,  10, '✓', '作り置き→5分 / ラーメン・カレー→10分'],
    ['task_026', '昼食を食べる',          '食事',      '在宅勤務日',                                          '昼', 2,  20, '✓', ''],
    ['task_027', '食器を洗う（昼）',       '家事',      '在宅勤務日',                                          '昼', 3,  5,  '✓', ''],
    ['task_028', '昼休憩（仮眠 or 運動 or 家事）', '休憩', '在宅勤務日',                                      '昼', 4,  25, '',  '3択：仮眠20分 / エアロバイク10分 / 軽い家事'],

    // ===== 在宅勤務日・勤務後の余裕ブロック =====
    ['task_030', '業務終了・PCを閉じる',  '仕事',      '在宅勤務日',                                          '夕方', 1, 5,  '✓', '仕事モード終了の儀式'],
    ['task_031', '気持ち切り替え・休憩',  '休憩',      '在宅勤務日',                                          '夕方', 2, 15, '',  ''],

    // ===== 夜ブロック（出勤日） =====
    ['task_040', '帰宅・手洗い・着替え', '身支度',    '出勤日',                                              '夜', 1,  8,  '✓', ''],

    // ===== 夜ブロック（共通） =====
    ['task_045', '夕食の準備',            '食事',      '出勤日,在宅勤務日,休日（自宅）',                      '夜', 2,  25, '✓', '作り置き→10分 / 自炊→25分 / 買ってきた→5分'],
    ['task_046', '夕食を食べる',          '食事',      '全日タイプ',                                          '夜', 3,  30, '✓', ''],
    ['task_047', '食器を洗う（夜）',       '家事',      '全日タイプ',                                          '夜', 4,  10, '✓', ''],
    ['task_048', 'お風呂・シャワー',       '身支度',    '全日タイプ',                                          '夜', 5,  60, '✓', '※実績要確認（過去平均との比較対象）'],
    ['task_049', 'スキンケア（夜）',       '身支度',    '全日タイプ',                                          '夜', 6,  5,  '✓', ''],
    ['task_050', '歯磨き（夜）',          '身支度',    '全日タイプ',                                          '夜', 7,  3,  '✓', ''],
    ['task_051', 'サプリを飲む（夜）',     '健康',      '全日タイプ',                                          '夜', 8,  2,  '✓', ''],
    ['task_052', '洗濯機を回す（夜）',    '家事',      '全日タイプ',                                          '夜', 9,  5,  '',  '2日に1回・お風呂後にバスタオルも一緒に'],
    ['task_053', '室内に干す',            '家事',      '全日タイプ',                                          '夜', 10, 10, '',  '洗濯完了後（冬・悪天候）'],
    ['task_054', '翌日の準備',            '身支度',    '出勤日,在宅勤務日',                                   '夜', 11, 10, '',  '服・バッグを出しておく'],

    // ===== 休日（自宅）・家事ブロック =====
    ['task_060', 'トイレ掃除',            '家事・掃除', '休日（自宅）',                                       '家事', 1, 10, '',  ''],
    ['task_061', '洗面台・お風呂掃除',    '家事・掃除', '休日（自宅）',                                       '家事', 2, 15, '',  ''],
    ['task_062', '部屋の掃き・拭き掃除',  '家事・掃除', '休日（自宅）',                                       '家事', 3, 20, '',  ''],
    ['task_063', 'ロボット掃除機の手入れ', '家事・掃除','休日（自宅）',                                       '家事', 4, 10, '',  ''],
    ['task_064', '机・ベッド周りの片付け', '家事・掃除','全日タイプ',                                         '家事', 5, 15, '',  ''],

    // ===== 休日（自宅）・料理ブロック =====
    ['task_070', '買い物リストを作る',    '料理・食材', '休日（自宅）',                                       '料理', 1, 5,  '',  ''],
    ['task_071', '買い物（スーパー等）',  '料理・食材', '休日（自宅）',                                       '料理', 2, 60, '',  '業務スーパーなど'],
    ['task_072', '作り置きを作る',        '料理・食材', '休日（自宅）',                                       '料理', 3, 60, '',  '週1回推奨・平日分のお弁当含む'],

    // ===== 副業ブロック =====
    ['task_080', 'やまぐちファーム案件',  '副業',      '休日（自宅）,在宅勤務日',                             '副業', 1, 60, '',  ''],
    ['task_081', '山本小屋ふる里館案件',  '副業',      '休日（自宅）,在宅勤務日',                             '副業', 2, 60, '',  ''],
    ['task_082', 'Potatoyo関連',          '副業',      '休日（自宅）,在宅勤務日',                             '副業', 3, 60, '',  'ロゴ・名刺・HP等'],

    // ===== 習慣ブロック =====
    ['task_090', 'エアロバイク（10分）',  '習慣・運動', '全日タイプ',                                         '習慣', 1, 10, '',  '最低10分・できれば毎日'],
    ['task_091', 'ジムに行く',            '習慣・運動', '出勤日,在宅勤務日,休日（自宅）',                      '習慣', 2, 90, '',  '外出Day・登山・スキーの日は運動達成とみなしてOK'],
    ['task_092', '小説を書く',            '習慣・創作', '全日タイプ',                                         '習慣', 3, 30, '',  '10分でも◎・書き始めたら過集中でOK'],
    ['task_093', 'IT資格勉強',            '習慣・勉強', '全日タイプ',                                         '習慣', 4, 30, '',  '10分でも◎'],

    // ===== 外出・旅行・前日チェックリスト =====
    ['task_100', 'スマホ・モバイルバッテリーの充電確認', '外出準備', '休日（外出）,出張・研修',              '前日', 1, 3,  '✓', ''],
    ['task_101', 'Apple Watch充電器の確認',              '外出準備', '休日（外出）,出張・研修',              '前日', 2, 3,  '✓', 'しょっちゅう忘れる！宿泊時は特に確認'],
    ['task_102', '財布の確認',                           '外出準備', '休日（外出）,出張・研修',              '前日', 3, 2,  '✓', '現金をあまり使わないので忘れやすい'],
    ['task_103', '耳栓の確認',                           '外出準備', '休日（外出）,出張・研修',              '前日', 4, 2,  '✓', ''],
    ['task_104', 'ノイズキャンセリングイヤホンの確認',   '外出準備', '休日（外出）,出張・研修',              '前日', 5, 2,  '✓', '音過敏対策・必携'],
    ['task_105', '天気・気温の確認',                     '外出準備', '休日（外出）',                         '前日', 6, 5,  '✓', ''],
    ['task_106', '出発時刻・交通手段の確認',             '外出準備', '休日（外出）,出張・研修',              '前日', 7, 5,  '✓', ''],

    // 登山追加
    ['task_110', 'ザックの中身確認（登山）', '外出準備・登山', '休日（外出）',                              '前日', 8, 10, '✓', '水・行動食・レインウェア・着替え・救急セット・地図・トレッキングポール'],
    ['task_111', '登山靴・ウェアの確認',   '外出準備・登山', '休日（外出）',                              '前日', 9, 5,  '✓', ''],

    // スキー追加
    ['task_115', 'スキーウェア・グローブ・ゴーグルの確認', '外出準備・スキー', '休日（外出）',             '前日', 8, 5,  '✓', 'シーズンレンタルなので板・ブーツは不要'],
    ['task_116', '車のガソリン確認',       '外出準備・スキー', '休日（外出）',                             '前日', 9, 3,  '✓', ''],

    // 旅行追加
    ['task_120', '宿・交通の予約確認',     '外出準備・旅行', '休日（外出）,出張・研修',                    '前日', 8, 5,  '✓', ''],
    ['task_121', '着替え・洗面用具のパッキング', '外出準備・旅行', '休日（外出）,出張・研修',              '前日', 9, 20, '✓', ''],

    // 帰宅後リセット
    ['task_130', '荷物をほどく・洗濯物を出す', '外出後', '休日（外出）,出張・研修',                        '帰宅後', 1, 10, '✓', '床に置かない！帰ったらすぐほどく'],
    ['task_131', '手洗い・着替え（帰宅後）', '外出後', '休日（外出）,出張・研修',                          '帰宅後', 2, 5,  '✓', ''],

    // 出張後フォロー
    ['task_135', '経費レシートをまとめる',  '仕事・出張後', '出張・研修',                                  '帰宅後', 3, 10, '✓', '帰宅当日に'],
    ['task_136', '研修メモをジャーナルに記録', '仕事・出張後', '出張・研修',                               '帰宅後', 4, 10, '',  '翌日〜翌々日中に'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, tasks.length, tasks[0].length).setValues(tasks);

  // 書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#E8884A').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);

  // ブロック列に色分け
  const blockColors = {
    '朝':    '#FFF9C4',
    '昼':    '#E8F5E9',
    '夕方':  '#FFF3E0',
    '夜':    '#E8EAF6',
    '家事':  '#FCE4EC',
    '料理':  '#F3E5F5',
    '副業':  '#E0F2F1',
    '習慣':  '#E0F7FA',
    '前日':  '#FBE9E7',
    '帰宅後':'#F1F8E9',
  };

  for (let i = 0; i < tasks.length; i++) {
    const block = tasks[i][4];
    const color = blockColors[block] || '#FFFFFF';
    sheet.getRange(i + 2, 1, 1, headers.length).setBackground(color);
  }

  // 列幅
  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 230);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 260);
  sheet.setColumnWidth(5, 70);
  sheet.setColumnWidth(6, 55);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(8, 55);
  sheet.setColumnWidth(9, 300);
}


// ============================================================
// シート④ 習慣トラッカー
// ============================================================
function setupSheet4_HabitTracker(ss) {
  let sheet = ss.getSheetByName('④習慣トラッカー');
  if (!sheet) sheet = ss.insertSheet('④習慣トラッカー');
  sheet.clear();

  const headers = [
    '日付', '曜日', '日タイプ',
    'エアロバイク', 'ジム', 'サプリ（朝）', 'サプリ（夜）', '小説', 'IT資格勉強',
    '達成数', '習慣メモ'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 達成数の自動計算式
  sheet.getRange(2, 10).setFormula('=COUNTIF(D2:I2,"✓")');

  // 書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#8E6BBF').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 列幅
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 50);
  sheet.setColumnWidth(3, 130);
  const habitCols = [4,5,6,7,8,9];
  habitCols.forEach(col => sheet.setColumnWidth(col, 100));
  sheet.setColumnWidth(10, 80);
  sheet.setColumnWidth(11, 200);

  // 習慣列のドロップダウン（✓ or 空白）
  const checkRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['✓', '△（少しだけ）'], true)
    .build();
  sheet.getRange(2, 4, 500, 6).setDataValidation(checkRule);
}


// ============================================================
// シート⑤ ゴール（中長期目標）
// ============================================================
function setupSheet5_Goals(ss) {
  let sheet = ss.getSheetByName('⑤ゴール');
  if (!sheet) sheet = ss.insertSheet('⑤ゴール');
  sheet.clear();

  const headers = [
    '目標ID', '目標名', 'カテゴリ', '単位', '目標値', '現在値',
    '進捗(%)', '開始日', '期限', 'ステータス', '備考'
  ];

  // サンプルデータ
  const goals = [
    ['goal_001', '小説第1章完成',       '創作',   '文字数', 30000, 0, '', '2026-04-21', '2026-06-30', '進行中', '10分でも書けたら更新'],
    ['goal_002', '体重管理（目標設定）', '健康',   'kg',     0,     0, '', '2026-04-21', '',           '設定中', '目標体重を決めたら更新'],
    ['goal_003', 'IT資格試験合格',       '資格勉強','時間',  100,   0, '', '2026-04-21', '',           '進行中', '受験予定の資格を備考に追記'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, goals.length, goals[0].length).setValues(goals);

  // 進捗(%)の自動計算
  sheet.getRange(2, 7).setFormula('=IF(AND(E2>0,F2>="0"),ROUND(F2/E2*100,1)&"%","")');
  sheet.getRange(3, 7).setFormula('=IF(AND(E3>0,F3>="0"),ROUND(F3/E3*100,1)&"%","")');
  sheet.getRange(4, 7).setFormula('=IF(AND(E4>0,F4>="0"),ROUND(F4/E4*100,1)&"%","")');

  // 書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#D4A843').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);

  // ステータスのドロップダウン
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['進行中', '達成', '中断', '設定中'], true)
    .build();
  sheet.getRange(2, 10, 50, 1).setDataValidation(statusRule);

  // 列幅
  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 80);
  sheet.setColumnWidth(6, 80);
  sheet.setColumnWidth(7, 80);
  sheet.setColumnWidth(8, 110);
  sheet.setColumnWidth(9, 110);
  sheet.setColumnWidth(10, 90);
  sheet.setColumnWidth(11, 250);
}
