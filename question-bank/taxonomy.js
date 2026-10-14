/* Shared, reviewable labels: stable codes; localized copy is display-only. */
const ELPA_TAXONOMY = Object.freeze({
  examStages: Object.freeze({
    start: {zh:'开学阶段',en:'Beginning of Semester'},
    mid: {zh:'学期中',en:'Mid-semester'},
    end: {zh:'学期末',en:'End of Semester'}
  }),
  semesters: Object.freeze({Spring:{zh:'春季',en:'Spring'},Fall:{zh:'秋季',en:'Fall'}}),
  advicePhases: Object.freeze({
    before:{zh:'考前准备',en:'Before the Exam'},
    during:{zh:'考试现场',en:'During the Exam'},
    after:{zh:'考后反馈',en:'After the Exam'}
  }),
  adviceTags: Object.freeze({
    'exam-process':{zh:'考试流程',en:'Exam Process'},
    'speaking-strategy':{zh:'答题技巧',en:'Speaking Strategy'},
    'time-management':{zh:'时间管理',en:'Time Management'},
    'stress-management':{zh:'心理调整',en:'Managing Stress'},
    'english-expression':{zh:'英语表达',en:'English Expression'},
    'ai-learning':{zh:'AI 辅助学习',en:'AI-assisted Learning'},
    'exam-experience':{zh:'现场经验',en:'Exam Experience'}
  }),
  sourceTypes: Object.freeze({
    firsthand:{zh:'本人亲历',en:'Firsthand'},
    secondhand:{zh:'同学转述',en:'Secondhand'}
  }),
  placeholders: Object.freeze({
    mainEn:'Enter the question in English',
    mainCn:'填写主问题的中文表述',
    subEn:'Enter the follow-up in English',
    subCn:'填写对应的中文小问',
    adviceTitle:'填写经验标题',
    adviceBody:'分享具体方法或经验',
    keyword:'搜索题目'
  })
});
