/* ELPA 结构化题库 · 网站唯一题目数据入口。
 * 题目来自学生分享及回忆，并非 HKUST(GZ) 官方题卡。
 * 如需更新题目，请在此维护条目与稳定 ID；来源与背景详见同目录 Markdown 文档。
 * A/B/C 条目仅为旧学习记录和来源兼容保留，页面按往年题库去重展示。
 */
const BANKS = {
  A: {
    name: "往年题库",
    items: [
      { num: 1, en: "Describe and reflect upon your experience of undergraduate study.",
        cn: "描述并反思你的本科学习经历",
        subs: [
          { en: "What was your degree / major?", cn: "专业是什么" },
          { en: "Why did you study this?", cn: "为什么学这个专业" },
          { en: "What do you think about the courses you took?", cn: "上过的课程怎么样" },
          { en: "What is one thing you would change in your courses if you could?", cn: "如果可以，你会改变课程的什么" },
          { en: "What is one thing you would keep in the course?", cn: "课程中你会保留什么" },
          { en: "What course did you enjoy the most as an undergraduate? Why?", cn: "最喜欢的课程及原因" },
          { en: "If you were going to study as an undergraduate again, what would you do differently?", cn: "重读本科会怎么做" },
          { en: "What classes have you taken?", cn: "上过哪些课" },
          { en: "What is your favorite class?", cn: "最喜欢的课" },
          { en: "Which class did you not like?", cn: "不喜欢的课" },
          { en: "What do you want to do if you restart your undergraduate life?", cn: "重启大学生活想做什么" }
        ]},
      { num: 2, en: "Describe your research using clear and simple language. If you use complex terminology, be sure to explain them so that others can understand.",
        cn: "用清晰简单的语言描述你的研究；使用专业术语时务必解释清楚",
        subs: [
          { en: "What is the general topic of your research?", cn: "研究主题" },
          { en: "What is your research project about?", cn: "研究是关于什么的" },
          { en: "Why are you interested in this area of research?", cn: "为什么对这个领域感兴趣" },
          { en: "Why is research in your area important to society? Can you give an example of a real-world application of your research?", cn: "为什么对社会重要？举一个实际应用例子" },
          { en: "What main challenges have you faced in research you have done until now?", cn: "目前研究遇到的挑战" },
          { en: "What do you hope to achieve in your research?", cn: "研究的期望目标" },
          { en: "Your general research problem?", cn: "研究问题" },
          { en: "Your research topic in detail?", cn: "课题细节" },
          { en: "Prospects of your research?", cn: "研究前景" }
        ]},
      { num: 3, en: "Describe an event (or situation) where you were required to speak in English as a research postgraduate.",
        cn: "描述一个作为研究型研究生必须用英语发言的事件或场合",
        subs: [
          { en: "What was the event and where did it take place?", cn: "什么事件？在哪里发生" },
          { en: "How long was / will it be?", cn: "持续多长时间" },
          { en: "Why did / will you attend it?", cn: "为什么参加" },
          { en: "Were / will you be able to prepare in advance for it? If so, in what way?", cn: "能否提前准备？怎么准备" },
          { en: "Who were / will be the other people present?", cn: "在场的其他人是谁" },
          { en: "What did / will you talk about? Were you successful? Why / Why not?", cn: "讲了什么？成功吗？为什么" },
          { en: "Did / Will the event require much conversation and/or exchange of information with others? Or was / will it require you to speak on your own?", cn: "需要交流互动还是独自陈述" },
          { en: "When will you speak? / To whom will you speak? / Where will you speak?", cn: "何时 / 对谁 / 在哪里发言" },
          { en: "Any details? / Any difficulties?", cn: "其他细节？困难？" }
        ]},
      { num: 4, en: "Describe your experience of speaking or presenting your research in English.",
        cn: "描述你用英语演讲或展示研究的经历",
        subs: [
          { en: "When did you speak about your research / academic areas of interest?", cn: "什么时候讲过自己的研究" },
          { en: "Have you had much chance to speak about your research in English?", cn: "用英语讲研究的机会多吗" },
          { en: "If not, have you had opportunities to speak about academic topics in English?", cn: "如果没有，有讲过英语学术话题吗" },
          { en: "What do you find most challenging about speaking about your research and/or academic topics in English?", cn: "最有挑战的是什么" },
          { en: "What do you like about presenting your research in English?", cn: "喜欢用英语展示研究吗" },
          { en: "What would you like to improve about your English presenting skills?", cn: "想提升哪些方面" },
          { en: "When / To whom / Where do you speak?", cn: "何时 / 对谁 / 何地" },
          { en: "Other details? / Any difficulties?", cn: "其他细节？困难？" }
        ]},
      { num: 5, en: "Describe why you chose to study at HKUST.",
        cn: "描述你为什么选择来香港科技大学读书（有考生考场抽到）",
        subs: [
          { en: "What did you hear about HKUST before you came here?", cn: "来之前听说过科大什么" },
          { en: "What attracted you to study at HKUST?", cn: "什么吸引你来科大" },
          { en: "What are your first impression of the campus?", cn: "对校园的初印象" },
          { en: "How does HKUST compare to the university of your undergraduate studies?", cn: "科大与本科学校相比如何" },
          { en: "What do you know about your research department at HKUST?", cn: "对科大的研究部门了解多少" },
          { en: "Which professors will you be working with?", cn: "想跟哪位教授 / 在哪个部门" },
          { en: "Aside from studies, what else do you hope to achieve at HKUST?", cn: "除了学业还想收获什么" }
        ]},
      { num: 6, en: "Describe a challenge you faced in your studies or at work. How did you overcome it?",
        cn: "描述一个学习或工作中遇到的挑战，以及你是如何克服的（有考生考场抽到）",
        subs: [
          { en: "What was the challenge?", cn: "什么挑战" },
          { en: "Why was it a challenge?", cn: "为什么是挑战" },
          { en: "What did you do to overcome it?", cn: "如何克服" },
          { en: "Did you handle it well? Why?", cn: "处理好了吗？为什么" },
          { en: "What did you learn from this challenge?", cn: "从中学到了什么" },
          { en: "Would you deal with it differently now?", cn: "现在会换一种方式处理吗" }
        ]},
      { num: 7, en: "Describe a time when you attended an interview (e.g. job, university etc.)",
        cn: "描述一次你参加面试的经历（工作、升学等）—— 2025.9.10 场次原题出现，重点准备！",
        subs: [
          { en: "What type of interview did you attend?", cn: "什么类型的面试" },
          { en: "Did you do well? Why?", cn: "表现好吗？为什么" },
          { en: "What did you learn from this interview?", cn: "从中学到了什么" },
          { en: "Do you think presentation skills are important for interviews? Why?", cn: "展示/表达技巧对面试重要吗" },
          { en: "How can these skills be improved?", cn: "如何提高这些技巧" },
          { en: "Should universities teach students such skills?", cn: "大学应该教这些技巧吗" }
        ]},
      { num: "附", en: "What can you learn from the Internet?",
        cn: "描述一下你在互联网中能学到什么？（有考生考场抽到的补充题）",
        subs: []}
    ]
  },
  B: {
    name: "往年题库",
    items: [
      { num: 1, en: "How would you explain a technical term to the first-year UG?",
        cn: "你会如何向大一本科生解释一个专业术语？", subs: []},
      { num: 2, en: "Talk about your academic subject and why did you enjoy it?",
        cn: "谈谈你的学科，以及你为什么喜欢它", subs: []},
      { num: 3, en: "Why is interdisciplinary studies so important?",
        cn: "为什么交叉学科研究如此重要？", subs: []},
      { num: 4, en: "As a teaching assistant, how do you plan to guide the UG student to use AI ethically?",
        cn: "作为助教，你计划如何引导学生合乎伦理地使用 AI？", subs: []},
      { num: 5, en: "Explain a core concept or technique in your research in simple terms, give an example of its application, and explain its limitations.",
        cn: "用简而易懂的话解释你研究中的核心概念或技术，举例说明应用并说明它的局限性。", subs: []},
      { num: 6, en: "Briefly introduce the problems encountered in academic research, how you solved them through innovation, what the results were.",
        cn: "简要介绍研究中遇到的问题、你如何通过创新解决、结果如何", subs: []},
      { num: 7, en: "Discuss the challenges of remote learning, and how to overcome it?",
        cn: "讨论远程学习的挑战以及如何克服", subs: []},
      { num: 8, en: "Discuss the role of mentorship in academic success.",
        cn: "讨论导师制在学术成功中的作用", subs: []},
      { num: 9, en: "How can PG students leverage AI to improve their language proficiency?",
        cn: "研究生如何利用 AI 提升语言能力？", subs: []},
      { num: 10, en: "Why is integrity important for your academic discipline?",
        cn: "为什么诚信对你的学科很重要？", subs: []},
      { num: 11, en: "How do PG students leverage digital tools?",
        cn: "研究生如何利用数字工具？", subs: []},
      { num: 12, en: "Talk about the importance of feedback, including receiving and giving feedback.",
        cn: "谈谈反馈的重要性，包括接受和给予反馈", subs: []},
      { num: 13, en: "Describe a time when you used creative approaches to solve a problem in academic research.",
        cn: "描述一个在学术研究中，你应用创造性手段解决什么问题。", subs: []}
    ]
  },
  C: {
    name: "往年题库",
    items: [
      { num: 1, en: "How would you explain a technical term to the first-year undergraduate?",
        cn: "如何向大一新生解释一个专业术语",
        subs: [
          { en: "How to define a technical term", cn: "如何定义这个术语" },
          { en: "Give an example", cn: "举一个例子" },
          { en: "Challenge when explaining to the first-year undergraduate", cn: "向大一新生解释的挑战" },
          { en: "How to get feedback", cn: "如何获得反馈" }
        ]},
      { num: 2, en: "Why is interdisciplinary studies so important?",
        cn: "描述为什么交叉学科（interdisciplinary）很重要",
        subs: [
          { en: "What is interdisciplinary studies?", cn: "介绍交叉学科是什么" },
          { en: "Why is interdisciplinary studies important?", cn: "为什么交叉学科重要？" },
          { en: "Give an example of disciplinary integration related to your subject", cn: "举例学科融合（关于你的 subject）" },
          { en: "What can you gain from collaborating with others? (collaborative creation)", cn: "从 collaborating 中可以得到什么" }
        ]},
      { num: 3, en: "Talk about your academic subject and why you enjoy it.",
        cn: "讲讲你的 academic subject，并说你为什么 enjoy",
        subs: [
          { en: "What subject do you plan to study?", cn: "计划学什么科目" },
          { en: "Why do you like this subject?", cn: "你为什么喜欢这个科目" },
          { en: "How does this subject influence your academic and career choices?", cn: "这个科目对你学术和就业的选择有什么影响" },
          { en: "What are you currently passionate about in this subject?", cn: "这个科目现在热衷什么" }
        ]},
      { num: 4, en: "As a teaching assistant, how do you guide the undergraduate student to use AI ethically?",
        cn: "作为助教，如何引导本科生合乎伦理地使用 AI",
        subs: [
          { en: "How do you distinguish what is ethical?", cn: "怎么区分是否合乎伦理" },
          { en: "How do you tell whether the information provided by AI is true or false?", cn: "怎么分辨 AI 提供信息的真假" },
          { en: "Mainly focus on how to use AI ethically", cn: "主要围绕怎么用才算合乎伦理" }
        ]},
      { num: 5, en: "Explain a core concept or technique in your research field in simple terms, give an example of its application, and explain its limitations.",
        cn: "用简单语言解释研究核心概念、实际应用及局限性",
        subs: []},
      { num: 6, en: "Briefly introduce the problems you encountered in academic research, how you solved them, and what the results were.",
        cn: "简要介绍学术研究遇到的问题，你如何解决，结果怎么样",
        subs: [
          { en: "Briefly describe the problem", cn: "简要描述问题" },
          { en: "How did you implement / approach it?", cn: "你如何实施它" },
          { en: "What were the results?", cn: "结果怎么样" }
        ]},
      { num: 7, en: "Discuss the challenges of remote or blended learning, and how to overcome it?",
        cn: "讨论远程/混合式学习的挑战及克服方法",
        subs: [
          { en: "Describe the challenge", cn: "描述一下这个挑战" },
          { en: "Did this challenge affect you?", cn: "这个挑战是否对你造成了影响" },
          { en: "How did you overcome the difficulty?", cn: "你是怎么克服这个困难的" },
          { en: "Give some advice / methods to people facing the same difficulty", cn: "对和你面临同样困境的人提出一些建议/方法" }
        ]},
      { num: 8, en: "Discuss the role of mentorship in academic success.",
        cn: "讨论导师制在学术成功中的作用",
        subs: [
          { en: "The importance of mentorship", cn: "导师的重要性" },
          { en: "Have you ever had a mentor? How?", cn: "你有没有过 mentor？怎么找的" },
          { en: "What qualities should a good mentor have / what should a good mentor do?", cn: "好的 mentor 需要有什么品质/需要做到什么" },
          { en: "Where can students get mentorship?", cn: "学生可以从哪里获取 mentorship" }
        ]},
      { num: 9, en: "Why is integrity important for your academic discipline?",
        cn: "为什么诚信对你的学科很重要？",
        subs: [
          { en: "Why is integrity important in research and education?", cn: "为什么诚信在研究和教育中很重要" },
          { en: "How to maintain academic integrity?", cn: "如何维护学术诚信" }
        ]},
      { num: 10, en: "How do postgraduate students leverage digital tools (e.g. AI)?", recallTag:"小问未完整记录",
        cn: "研究生如何利用数字工具（如 AI）？", subs: []},
      { num: 11, en: "Importance of feedback, including receiving and giving feedback.",
        cn: "反馈的重要性，包括接受和给予反馈",
        subs: [
          { en: "Why is feedback important?", cn: "为什么重要" },
          { en: "Have you used feedback in your work?", cn: "你的 work 有没有用到 feedback" },
          { en: "What kind of feedback do you think is most important?", cn: "什么反馈最重要" },
          { en: "What is the most effective way to give / receive feedback?", cn: "什么方式的反馈最有效" }
        ]},
      { num: 12, en: "Describe a time when you used creative approaches to solve a problem in academic research.",
        cn: "描述在学术研究中创造性解决问题的经历",
        subs: []},
      { num: 13, en: "Is AI dangerous or helpful?",
        cn: "AI 是危险的还是有益的？", subs: []},
      { num: 14, en: "What are the benefits and challenges of collaborating with people from different fields?",
        cn: "与不同领域的人合作的好处与挑战？", subs: []},
      { num: 15, en: "Talk about your experience of taking online courses.",
        cn: "网课经验", subs: []},
      { num: 16, en: "What can you learn from the Internet?",
        cn: "描述一下你在互联网中能学到什么？（与题库一附加题相同）", subs: []},
      { num: 17, en: "How can AI help language learning?",
        cn: "AI 对语言学习的帮助", subs: []},
      { num: 18, en: "Describe an event or situation where you were required to speak in English as a research postgraduate.",
        cn: "新增题（与往年题库第 3 题相同，重点关注）", subs: []}
    ]
  }
};

/* 2026 Fall 场次回忆：在原 A/B/C 题目 ID 后增补，保留已有进度映射 */
BANKS.D = {
  name: '2026 Fall 新题库',
  items: [
    { num:1, en:'How would you explain a term such as supply chain or fluid dynamics to undergraduates?', cn:'8.24 09:30｜向本科生解释专业术语；考生英文回忆经轻微规范化，非核实原文', subs:[] },
    { num:2, en:'How would you guide students to use AI?', cn:'8.24 09:30｜指导学生使用 AI；考生英文回忆', subs:[] },
    { num:3, en:'What do you think AI can do for your studies?', cn:'8.24 09:30｜AI 如何帮助学习；考生英文回忆经轻微规范化', subs:[] },
    { num:4, en:'Explain one of your projects.', cn:'8.24 09:30｜介绍个人项目；考生英文回忆经轻微规范化', subs:[] },
    { num:5, en:'If you were a teaching assistant and discovered that a student had used AI for an assignment where AI was not permitted, how would you respond?', cn:'8.28 16:40｜如何处理学生违规使用 AI 的情况；考生英文回忆经轻微规范化', subs:[] },
    { num:6, en:'Introduce a term from your field of study and explain it using an analogy.', cn:'8.28 16:40｜用类比解释专业术语；考生英文回忆', subs:[] },
    { num:7, en:'How would you interpret two studies that reach different conclusions on the same issue?', recallTag:'英文为整理译文', cn:'9 月初反馈｜同一问题的两项研究为何结论不同？仅记录中文题意，小问未记录', subs:[] },
    { num:8, en:'How would you explain a difficult academic concept to undergraduates from different cultural and academic backgrounds?', recallTag:'英文为整理译文', cn:'9 月初反馈｜向跨文化、跨专业学生解释复杂学术概念；仅记录中文题意', subs:[] },
    { num:9, en:'What was your first impression of HKUST(GZ) when you arrived?', cn:'9 月初校园题｜初到学校的印象；分享英文问法经轻微规范化', subs:[] },
    { num:10, en:'How could you use the unique platform of HKUST(GZ) to achieve your personal goals?', cn:'9 月初校园题｜如何利用学校资源实现个人目标；分享英文问法经轻微规范化', subs:[] },
    { num:11, en:'What place at HKUST(GZ) would you most like to visit or experience, and why?', cn:'9 月初校园题｜最想参观或体验的校园地点及原因；分享英文问法', subs:[] },
    { num:12, en:'What kind of skills do you hope to develop at HKUST(GZ)?', cn:'9 月初校园题｜希望在学校提升什么技能；分享英文问法', subs:[] }
  ]
};

/* 旧题库内部编号和别名兼容，网页只呈现去重后的往年题库与新题库。 */
const PAST_QUESTION_IDS = ["A-1","A-2","A-3","A-4","A-5","A-6","A-7","C-1","C-2","C-3","C-4","C-5","C-6","C-7","C-8","C-9","C-10","C-11","C-12","C-13","C-14","C-15","C-16","C-17","B-9"];
const LEGACY_QUESTION_ALIASES = {
  "A-附": "C-16",
  "B-1": "C-1",
  "B-2": "C-3",
  "B-3": "C-2",
  "B-4": "C-4",
  "B-5": "C-5",
  "B-6": "C-6",
  "B-7": "C-7",
  "B-8": "C-8",
  "B-10": "C-9",
  "B-11": "C-10",
  "B-12": "C-11",
  "B-13": "C-12",
  "C-18": "A-3"
};
